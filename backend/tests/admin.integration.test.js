import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import { JWT_SECRET } from '../src/config/env.js';
import { User } from '../src/models/User.js';
import { Report } from '../src/models/Report.js';
import { AuditLog } from '../src/models/AuditLog.js';

const suffix = `ci-${process.pid}-${Date.now()}`;
let server;
let baseUrl;
let admin;
let student;
let report;

const tokenFor = (user) => jwt.sign(
  { id: user._id.toString(), tokenVersion: user.tokenVersion || 0 },
  JWT_SECRET,
  { algorithm: 'HS256', expiresIn: '10m' }
);

const request = (path, token, options = {}) => fetch(`${baseUrl}/api${path}`, {
  ...options,
  headers: {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  },
});

test('platform admin endpoints enforce permissions, revoke sessions and write audit logs', async (t) => {
  assert.ok(process.env.MONGODB_URI, 'MONGODB_URI must point to an isolated CI database');
  await mongoose.connect(process.env.MONGODB_URI);

  t.after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    await Promise.all([
      User.deleteMany({ email: { $in: [`admin-${suffix}@example.test`, `student-${suffix}@example.test`] } }),
      Report.deleteMany({ reporter: admin?._id }),
      AuditLog.deleteMany({ actor: admin?._id }),
    ]);
    await mongoose.disconnect();
  });

  admin = await User.create({
    name: 'CI Platform Admin',
    email: `admin-${suffix}@example.test`,
    passwordHash: 'not-used-in-this-test',
    role: 'admin',
    verified: true,
  });
  student = await User.create({
    name: 'CI Student',
    email: `student-${suffix}@example.test`,
    passwordHash: 'not-used-in-this-test',
    role: 'student',
    verified: true,
  });
  report = await Report.create({
    reporter: student._id,
    targetType: 'post',
    targetId: new mongoose.Types.ObjectId().toString(),
    reason: 'CI integration test',
    details: 'Temporary report created by the isolated CI test database.',
  });

  server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const adminToken = tokenFor(admin);
  const studentToken = tokenFor(student);

  await t.test('non-admin cannot access platform administration', async () => {
    const response = await request('/admin/overview', studentToken);
    assert.equal(response.status, 403);
  });

  await t.test('search treats regex metacharacters as literal input', async () => {
    const response = await request('/admin/users?search=%5B', adminToken);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.success, true);
    assert.ok(Array.isArray(payload.data));
  });

  await t.test('admin can change a student role and cannot change own role', async () => {
    const changed = await request(`/admin/users/${student._id}/role`, adminToken, {
      method: 'PATCH',
      body: JSON.stringify({ role: 'faculty' }),
    });
    assert.equal(changed.status, 200);
    assert.equal((await changed.json()).data.role, 'faculty');

    const selfChange = await request(`/admin/users/${admin._id}/role`, adminToken, {
      method: 'PATCH',
      body: JSON.stringify({ role: 'student' }),
    });
    assert.equal(selfChange.status, 409);
  });

  await t.test('admin report moderation persists status and audit record', async () => {
    const response = await request(`/admin/reports/${report._id}`, adminToken, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'resolved' }),
    });
    assert.equal(response.status, 200);
    assert.equal((await Report.findById(report._id)).status, 'resolved');
    const audit = await AuditLog.findOne({
      actor: admin._id,
      action: 'review_report',
      targetId: report._id.toString(),
    });
    assert.ok(audit, 'report moderation must create an audit log');
  });

  await t.test('deactivation revokes the target user session', async () => {
    const response = await request(`/admin/users/${student._id}/status`, adminToken, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: false }),
    });
    assert.equal(response.status, 200);
    const revokedSession = await request('/admin/overview', studentToken);
    assert.equal(revokedSession.status, 401);
  });
});
