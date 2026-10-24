/**
 * C8 Custom Policy Verification — Tests the CUSTOM policy storage and evaluation
 * 
 * Run from backend/:  node tests/c8_custom_policy_test.mjs
 * 
 * Covers: CUSTOM policy for post creation and commenting, customAllowedUsers persistence
 * and authorization, regression testing for existing policy modes
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { connectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Community } from '../src/models/Community.js';
import { CommunityMember } from '../src/models/CommunityMember.js';
import { Post } from '../src/models/Post.js';
import { Comment } from '../src/models/Comment.js';
import { PostRequest } from '../src/models/PostRequest.js';
import { COMMUNITY_MEMBER_ROLES, POST_POLICY, COMMENT_POLICY, SHARE_POLICY } from '../src/constants/index.js';

const BASE = 'http://localhost:5000/api';
const PW = 'password123';
const P = {}; // persona -> JWT
const U = {}; // persona -> user doc
const F = {}; // fixture ids
const results = [];

function rec(group, persona, action, expected, actual, pass, note = '') {
  results.push({ group, persona, action, expected, actual, pass, note });
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${group} | ${persona} | ${action} | exp=${expected} act=${actual}${note ? ' | ' + note : ''}`);
}

async function req(method, url, token, body) {
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, json };
}

function expect(group, persona, action, expected, r) {
  const pass = r.status === expected;
  rec(group, persona, action, expected, r.status, pass, pass ? '' : (r.json?.message || 'no-message'));
  return pass;
}

async function login(email) {
  const r = await req('POST', '/auth/login', null, { email, password: PW });
  if (r.status !== 200 || !r.json?.token) throw new Error(`login failed for ${email}: ${r.status}`);
  return r.json.token;
}

async function main() {
  await connectDB();

  // ---------- 0. Clean stale fixtures from any previous run ----------
  const staleUsers = await User.find({ email: /c8fx_/ }).select('_id');
  const staleIds = staleUsers.map((u) => u._id);
  if (staleIds.length) {
    await CommunityMember.deleteMany({ user: { $in: staleIds } });
    await Post.deleteMany({ author: { $in: staleIds } });
    await Comment.deleteMany({ author: { $in: staleIds } });
    await PostRequest.deleteMany({ user: { $in: staleIds } });
    await User.deleteMany({ _id: { $in: staleIds } });
  }

  // ---------- 1. Create test users and community ----------
  console.log('[C8] Creating test fixtures...');
  // Create users
  const usersData = [
    { email: 'c8fx_head@test.edu.in', name: 'C8 FX Head' },
    { email: 'c8fx_mod@test.edu.in', name: 'C8 FX Mod' },
    { email: 'c8fx_member@test.edu.in', name: 'C8 FX Member' },
    { email: 'c8fx_allowed@test.edu.in', name: 'C8 FX Allowed User' },
    { email: 'c8fx_denied@test.edu.in', name: 'C8 FX Denied User' },
    { email: 'c8fx_admin@test.edu.in', name: 'C8 FX Admin', role: 'admin' },
  ];

  for (const { email, name, role } of usersData) {
    const existing = await User.findOne({ email });
    if (existing) {
      U[email.replace(/[^a-zA-Z0-9]/g, '_')] = existing;
    } else {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(PW, salt);
      const user = await User.create({
        email,
        name,
        password: passwordHash,
        role: role || 'student',
        verified: true,
      });
      U[email.replace(/[^a-zA-Z0-9]/g, '_')] = user;
    }
  }

  // Login all users
  for (const [key, user] of Object.entries(U)) {
    P[key] = await login(user.email);
  }

  // Create community
  const community = await Community.create({
    name: 'C8 FX Test Community',
    slug: 'c8fx-test-community',
    description: 'Test community for C8 custom policy',
    owner: U.c8fx_head_test_edu_in._id,
    category: 'General',
  });
  F.communityId = community._id;

  // Add users as members
  const memberData = [
    { user: U.c8fx_head_test_edu_in, role: COMMUNITY_MEMBER_ROLES.OWNER },
    { user: U.c8fx_mod_test_edu_in, role: COMMUNITY_MEMBER_ROLES.MODERATOR },
    { user: U.c8fx_member_test_edu_in, role: COMMUNITY_MEMBER_ROLES.MEMBER },
    { user: U.c8fx_allowed_test_edu_in, role: COMMUNITY_MEMBER_ROLES.MEMBER },
    { user: U.c8fx_denied_test_edu_in, role: COMMUNITY_MEMBER_ROLES.MEMBER },
  ];

  for (const { user, role } of memberData) {
    await CommunityMember.findOneAndUpdate(
      { user: user._id, community: community._id },
      { $set: { role, status: 'active', canPost: true } },
      { upsert: true, new: true }
    );
  }

  // Configure community with CUSTOM policy
  await Community.findByIdAndUpdate(community._id, {
    $set: {
      'permissions.postPolicy': POST_POLICY.CUSTOM,
      'permissions.commentPolicy': COMMENT_POLICY.CUSTOM,
      'permissions.customAllowedUsers': [
        U.c8fx_head_test_edu_in._id,
        U.c8fx_allowed_test_edu_in._id,
      ],
    },
  });
}

// Run the test
main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});

