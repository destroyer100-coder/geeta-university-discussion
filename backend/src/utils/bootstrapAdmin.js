import mongoose from 'mongoose';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { pathToFileURL } from 'node:url';
import { connectDB } from '../config/db.js';
import { NODE_ENV } from '../config/env.js';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';
import { AUDIT_ACTIONS } from '../constants/index.js';

const runAdminBootstrap = async () => {
  if (process.env.ALLOW_ADMIN_BOOTSTRAP !== 'true') {
    throw new Error('Blocked. Set ALLOW_ADMIN_BOOTSTRAP=true for this one-time trusted CLI operation.');
  }

  if (!['development', 'production'].includes(NODE_ENV)) {
    throw new Error('Admin bootstrap is not allowed in this environment.');
  }

  const email = String(process.env.ADMIN_BOOTSTRAP_EMAIL || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('ADMIN_BOOTSTRAP_EMAIL must contain a valid existing account email.');
  }

  await connectDB();

  try {
    const target = await User.findOne({ email, isDeleted: { $ne: true } }).select('+passwordHash');
    if (!target) throw new Error('The specified account does not exist. Register it first, then rerun this command.');
    if (target.role === 'admin') throw new Error('This account is already an administrator.');
    if (!target.verified || !target.emailVerifiedAt) {
      throw new Error('The account must have a verified email before it can be promoted.');
    }

    const terminal = readline.createInterface({ input, output });
    try {
      const confirmation = await terminal.question(
        'Promote the verified account to PLATFORM ADMIN? Type the exact email to confirm: '
      );
      if (confirmation.trim().toLowerCase() !== email) {
        throw new Error('Confirmation did not match. No changes were made.');
      }
    } finally {
      terminal.close();
    }

    const previousRole = target.role;
    target.role = 'admin';
    await target.save();

    await AuditLog.create({
      actor: target._id,
      action: AUDIT_ACTIONS.BOOTSTRAP_ADMIN,
      targetType: 'user',
      targetId: target._id.toString(),
      details: { previousRole, newRole: 'admin', method: 'trusted_cli_bootstrap' },
      ip: '127.0.0.1',
    });

    console.log('Administrator role granted successfully. Remove ALLOW_ADMIN_BOOTSTRAP and ADMIN_BOOTSTRAP_EMAIL from the shell environment.');
  } finally {
    await mongoose.disconnect();
  }
};

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (invokedPath === import.meta.url) {
  runAdminBootstrap().catch(async (error) => {
    console.error('[Admin Bootstrap] Aborted:', error.message);
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect().catch(() => {});
    process.exitCode = 1;
  });
}
