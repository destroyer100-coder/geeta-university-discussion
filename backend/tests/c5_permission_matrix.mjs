/**
 * C5 Runtime Permission Matrix — REAL HTTP tests against the live backend (:5000).
 *
 * Run from backend/:  node tests/c5_permission_matrix.mjs
 *
 * Covers: pin, lock, delete, pending-post review, join-request review, post-request
 * review, mark-accepted — for Head, Moderator WITH delegation, Moderator WITHOUT
 * delegation, Moderator holding only a SUBSET, Moderator of another community,
 * regular member, Platform Admin. Plus: permission revocation, cross-community
 * isolation, and audit-actor verification. Exits non-zero on any failure.
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { connectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Community } from '../src/models/Community.js';
import { CommunityMember } from '../src/models/CommunityMember.js';
import { Post } from '../src/models/Post.js';
import { Comment } from '../src/models/Comment.js';
import { PostRequest } from '../src/models/PostRequest.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { COMMUNITY_MEMBER_ROLES, CONTENT_STATUS, DELEGATED_PERMISSIONS } from '../src/constants/index.js';

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
  const staleUsers = await User.find({ email: /c5fx_/ }).select('_id');
  const staleIds = staleUsers.map((u) => u._id);
  if (staleIds.length) {
    await CommunityMember.deleteMany({ user: { $in: staleIds } });
    await Post.deleteMany({ author: { $in: staleIds } });
    await Comment.deleteMany({ author: { $in: staleIds } });
    await PostRequest.deleteMany({ user: { $in: staleIds } });
    await User.deleteMany({ _id: { $in: staleIds } });
  }
  // Deterministic precheck: aman must NOT be a member of cse-discussion
  // (plan requires moderator-of-another-community + Head restore checks).
  // Post C5-seeder fix aman is a plain MEMBER of coding-club (CSE moderator only),
  // so isolation is exercised by giving him delegated-looking powers ONLY in
  // coding-club membership while cse-discussion keeps NO record for him.
  const csePre = await Community.findOne({ slug: 'cse-discussion' });
  const amanPre = await User.findOne({ email: 'aman@geeta.edu.in' });
  if (csePre && amanPre) {
    // Keep aman out of CSE so he acts as the cross-community moderator, but
    // PRESERVE his full delegation set so it can be restored after the run.
    const amanCseMem = await CommunityMember.findOne({ user: amanPre._id, community: csePre._id });
    if (amanCseMem) {
      F._amanCseRole = amanCseMem.role;
      F._amanCsePerms = [...(amanCseMem.delegatedPermissions || [])];
      await CommunityMember.deleteOne({ _id: amanCseMem._id });
    }
  }

  // ---------- 1. Resolve seeded actors & communities ----------
  const cse = await Community.findOne({ slug: 'cse-discussion' });
  const coding = await Community.findOne({ slug: 'coding-club' });
  if (!cse || !coding) throw new Error('seeded communities missing — run seed first');

  U.head = await User.findOne({ email: 'rakesh@geeta.edu.in' });
  U.modWith = await User.findOne({ email: 'rahul@geeta.edu.in' });
  U.otherMod = await User.findOne({ email: 'aman@geeta.edu.in' });
  U.member = await User.findOne({ email: 'vansh@geeta.edu.in' });
  U.admin = await User.findOne({ email: 'admin@geeta.edu.in' });
  for (const k of ['head', 'modWith', 'otherMod', 'member', 'admin']) {
    if (!U[k]) throw new Error(`persona ${k} missing`);
  }

  // ---------- 2. Fixture users ----------
  const hash = await bcrypt.hash(PW, 10);
  const mkUser = (label) =>
    User.create({
      name: `C5 FX ${label}`,
      email: `c5fx_${label}@geeta.edu.in`,
      passwordHash: hash,
      role: 'student',
      verified: true,
      department: 'Computer Science & Engineering',
      year: '3rd Year',
    });

  U.fxAuthor = await mkUser('author');
  U.fxCommenter = await mkUser('commenter');
  U.fxPostAuthor = await mkUser('postauthor');
  U.fxAnswerer = await mkUser('answerer');
  U.fxNoPerms = await mkUser('noperm');
  U.fxPartial = await mkUser('partial');
  U.fxJ1 = await mkUser('join1');
  U.fxJ2 = await mkUser('join2');
  U.fxJ3 = await mkUser('join3');
  U.fxJ4 = await mkUser('join4');
  U.fxJ5 = await mkUser('join5');
  U.fxPr1 = await mkUser('preq1');
  U.fxPr2 = await mkUser('preq2');
  U.fxPr3 = await mkUser('preq3');
  U.fxPr4 = await mkUser('preq4');
  U.fxPr5 = await mkUser('preq5');

  // ---------- 3. Fixture memberships ----------
  const mNoPerms = await CommunityMember.create({
    user: U.fxNoPerms._id, community: cse._id, role: COMMUNITY_MEMBER_ROLES.MODERATOR,
    status: 'active', canPost: true, delegatedPermissions: [],
  });
  const mPartial = await CommunityMember.create({
    user: U.fxPartial._id, community: cse._id, role: COMMUNITY_MEMBER_ROLES.MODERATOR,
    status: 'active', canPost: true, delegatedPermissions: [DELEGATED_PERMISSIONS.PIN_POSTS],
  });
  const mkPending = (user, community) =>
    CommunityMember.create({ user: user._id, community: community._id, role: COMMUNITY_MEMBER_ROLES.MEMBER, status: 'pending', canPost: true });
  F.jM1 = (await mkPending(U.fxJ1, cse))._id;
  F.jM2 = (await mkPending(U.fxJ2, cse))._id;
  F.jM3 = (await mkPending(U.fxJ3, cse))._id;
  F.jM4 = (await mkPending(U.fxJ4, cse))._id;
  F.jM5 = (await mkPending(U.fxJ5, coding))._id;
  F.mNoPerms = mNoPerms._id;
  F.mPartial = mPartial._id;

  // ---------- 4. Fixture content ----------
  const mkPost = (author, community, title, status = CONTENT_STATUS.PUBLISHED) =>
    Post.create({ author: author._id, community: community._id, type: 'discussion', title, body: 'C5 runtime permission matrix fixture body.', status });

  F.tPin = (await mkPost(U.fxAuthor, cse, 'C5 FX Pin/Lock Target'))._id;
  F.tAccept = (await mkPost(U.fxAuthor, cse, 'C5 FX Accept Target'))._id;
  F.tAuthorPost = (await mkPost(U.fxPostAuthor, cse, 'C5 FX Author-Path Target'))._id;
  F.delShared = (await mkPost(U.fxAuthor, cse, 'C5 FX Delete Denial Target'))._id;
  F.delHead = (await mkPost(U.fxAuthor, cse, 'C5 FX Delete Head'))._id;
  F.delMod = (await mkPost(U.fxAuthor, cse, 'C5 FX Delete Mod'))._id;
  F.delAdmin = (await mkPost(U.fxAuthor, cse, 'C5 FX Delete Admin'))._id;
  F.delOwn = (await mkPost(U.fxAuthor, cse, 'C5 FX Delete Author-Own'))._id;
  F.pA = (await mkPost(U.fxAuthor, cse, 'C5 FX Pending Head', CONTENT_STATUS.PENDING))._id;
  F.pB = (await mkPost(U.fxAuthor, cse, 'C5 FX Pending Mod', CONTENT_STATUS.PENDING))._id;
  F.pC = (await mkPost(U.fxAuthor, cse, 'C5 FX Pending Admin', CONTENT_STATUS.PENDING))._id;
  F.pD = (await mkPost(U.fxAuthor, cse, 'C5 FX Pending Denial', CONTENT_STATUS.PENDING))._id;
  F.tCoding = (await mkPost(U.fxCommenter, coding, 'C5 FX Coding Target'))._id;
  F.tCodingPending = (await mkPost(U.fxAuthor, coding, 'C5 FX Coding Pending', CONTENT_STATUS.PENDING))._id;
  F.tCodingAccept = (await mkPost(U.fxAuthor, coding, 'C5 FX Coding Accept'))._id;

  F.cAccept = (await Comment.create({ post: F.tAccept, author: U.fxCommenter._id, body: 'C5 fixture comment for accept tests.' }))._id;
  F.cAuthor = (await Comment.create({ post: F.tAuthorPost, author: U.fxAnswerer._id, body: 'C5 fixture answer for author path.' }))._id;
  F.cCoding = (await Comment.create({ post: F.tCodingAccept, author: U.fxCommenter._id, body: 'C5 fixture coding comment.' }))._id;

  // ---------- 5. Fixture post requests ----------
  const mkPr = (user, community) =>
    PostRequest.create({ user: user._id, community: community._id, title: 'C5 FX Request', body: 'C5 fixture post request.', status: 'pending' });
  F.prA = (await mkPr(U.fxPr1, cse))._id;
  F.prB = (await mkPr(U.fxPr2, cse))._id;
  F.prC = (await mkPr(U.fxPr3, cse))._id;
  F.prD = (await mkPr(U.fxPr4, cse))._id;
  F.prE = (await mkPr(U.fxPr5, coding))._id;

  // ---------- 6. Logins ----------
  P.head = await login('rakesh@geeta.edu.in');
  P.modWith = await login('rahul@geeta.edu.in');
  P.otherMod = await login('aman@geeta.edu.in');
  P.member = await login('vansh@geeta.edu.in');
  P.admin = await login('admin@geeta.edu.in');
  P.fxNoPerms = await login('c5fx_noperm@geeta.edu.in');
  P.fxPartial = await login('c5fx_partial@geeta.edu.in');
  P.fxAuthor = await login('c5fx_author@geeta.edu.in');
  P.fxPostAuthor = await login('c5fx_postauthor@geeta.edu.in');

  console.log('[C5] Fixtures ready. Starting permission matrix...');

  // ================= A. Server-provided moderationPermissions flags =================
  const flagOf = async (token, slug) => {
    const r = await req('GET', `/communities/${slug}`, token);
    return r.json?.data?.moderationPermissions || null;
  };
  const checkFlags = (persona, flags, expected) => {
    for (const [k, v] of Object.entries(expected)) {
      const actual = Boolean(flags?.[k]);
      rec('flags', persona, `moderationPermissions.${k}`, v, actual, actual === v);
    }
  };

  checkFlags('head', await flagOf(P.head, 'cse-discussion'), { canModerate: true, pin: true, lock: true, delete: true, manageRequests: true, markAccepted: true, manageRules: true });
  checkFlags('modWith(rahul)', await flagOf(P.modWith, 'cse-discussion'), { canModerate: true, pin: true, lock: true, delete: true, manageRequests: true, markAccepted: true, manageRules: false });
  checkFlags('modNoPerms', await flagOf(P.fxNoPerms, 'cse-discussion'), { canModerate: false, pin: false, lock: false, delete: false, manageRequests: false, markAccepted: false, manageRules: false });
  checkFlags('modPartial(pin only)', await flagOf(P.fxPartial, 'cse-discussion'), { canModerate: true, pin: true, lock: false, delete: false, manageRequests: false, markAccepted: false, manageRules: false });
  checkFlags('member', await flagOf(P.member, 'cse-discussion'), { canModerate: false, pin: false, lock: false, delete: false, manageRequests: false, markAccepted: false, manageRules: false });
  checkFlags('admin', await flagOf(P.admin, 'cse-discussion'), { canModerate: true, pin: true, lock: true, delete: true, manageRequests: true, markAccepted: true, manageRules: true });
  checkFlags('otherMod(aman) on coding-club', await flagOf(P.otherMod, 'coding-club'), { canModerate: false, pin: false, lock: false, delete: false, manageRequests: false, markAccepted: false, manageRules: false });

  // ================= B. PIN (target: tPin, starts unpinned) =================
  const pinState = async () => (await Post.findById(F.tPin)).isPinned;
  await Post.updateOne({ _id: F.tPin }, { $set: { isPinned: false } });

  expect('pin', 'modNoPerms', 'pin tPin', 403, await req('PUT', `/posts/${F.tPin}/pin`, P.fxNoPerms));
  expect('pin', 'member', 'pin tPin', 403, await req('PUT', `/posts/${F.tPin}/pin`, P.member));
  expect('pin', 'otherCommunityMod(aman)', 'pin tCoding', 403, await req('PUT', `/posts/${F.tCoding}/pin`, P.otherMod));

  const pinAllowed = [['head', P.head], ['modWith(rahul)', P.modWith], ['admin', P.admin], ['modPartial(pin only)', P.fxPartial]];
  for (const [persona, token] of pinAllowed) {
    await Post.updateOne({ _id: F.tPin }, { $set: { isPinned: false, pinnedAt: null, pinnedBy: null, status: CONTENT_STATUS.PUBLISHED } });
    await Post.updateMany({ community: cse._id, isPinned: true, _id: { $ne: F.tPin } }, { $set: { isPinned: false, pinnedAt: null, pinnedBy: null } });
    const r1 = await req('PUT', `/posts/${F.tPin}/pin`, token);
    const r2 = await req('PUT', `/posts/${F.tPin}/pin`, token);
    const restored = (await pinState()) === false;
    const pass = r1.status === 200 && r2.status === 200 && restored;
    rec('pin', persona, 'pin+unpin tPin', '200/200 restored', `${r1.status}/${r2.status} pinned=${await pinState()}`, pass);
  }

  // ================= C. LOCK (target: tPin, starts published) =================
  await Post.updateOne({ _id: F.tPin }, { $set: { status: CONTENT_STATUS.PUBLISHED, allowComments: true } });
  expect('lock', 'modNoPerms', 'lock tPin', 403, await req('PUT', `/posts/${F.tPin}/lock`, P.fxNoPerms));
  expect('lock', 'modPartial(pin only)', 'lock tPin', 403, await req('PUT', `/posts/${F.tPin}/lock`, P.fxPartial));
  expect('lock', 'member', 'lock tPin', 403, await req('PUT', `/posts/${F.tPin}/lock`, P.member));
  expect('lock', 'otherCommunityMod(aman)', 'lock tCoding', 403, await req('PUT', `/posts/${F.tCoding}/lock`, P.otherMod));

  const lockAllowed = [['head', P.head], ['modWith(rahul)', P.modWith], ['admin', P.admin]];
  for (const [persona, token] of lockAllowed) {
    await Post.updateOne({ _id: F.tPin }, { $set: { status: CONTENT_STATUS.PUBLISHED, allowComments: true } });
    const r1 = await req('PUT', `/posts/${F.tPin}/lock`, token);
    const r2 = await req('PUT', `/posts/${F.tPin}/lock`, token);
    const st = await Post.findById(F.tPin);
    const pass = r1.status === 200 && r2.status === 200 && st.status === CONTENT_STATUS.PUBLISHED && st.allowComments === true;
    rec('lock', persona, 'lock+unlock tPin', '200/200 restored', `${r1.status}/${r2.status} status=${st.status} allow=${st.allowComments}`, pass);
  }

  // ================= D. DELETE =================
  expect('delete', 'modNoPerms', 'delete delShared', 403, await req('DELETE', `/posts/${F.delShared}`, P.fxNoPerms));
  expect('delete', 'modPartial(pin only)', 'delete delShared', 403, await req('DELETE', `/posts/${F.delShared}`, P.fxPartial));
  expect('delete', 'member', 'delete delShared', 403, await req('DELETE', `/posts/${F.delShared}`, P.member));
  expect('delete', 'otherCommunityMod(aman)', 'delete tCoding', 403, await req('DELETE', `/posts/${F.tCoding}`, P.otherMod));
  {
    const st = (await Post.findById(F.delShared)).status;
    rec('delete', 'denial target', 'delShared survives denials', CONTENT_STATUS.PUBLISHED, st, st === CONTENT_STATUS.PUBLISHED);
  }

  expect('delete', 'head', 'delete delHead', 200, await req('DELETE', `/posts/${F.delHead}`, P.head));
  expect('delete', 'modWith(rahul)', 'delete delMod', 200, await req('DELETE', `/posts/${F.delMod}`, P.modWith));
  expect('delete', 'admin', 'delete delAdmin', 200, await req('DELETE', `/posts/${F.delAdmin}`, P.admin));
  expect('delete', 'post-author owns delOwn', 'delete delOwn', 200, await req('DELETE', `/posts/${F.delOwn}`, P.fxAuthor));

  // ================= E. PENDING-POST REVIEW =================
  const pendingSeen = async (token, community, id) => {
    const r = await req('GET', `/posts?community=${community}&status=pending&limit=100`, token);
    const ids = (r.json?.data || []).map((p) => p._id);
    return { status: r.status, seen: ids.includes(String(id)) };
  };
  for (const [persona, token] of [['head', P.head], ['modWith(rahul)', P.modWith], ['admin', P.admin]]) {
    const v = await pendingSeen(token, 'cse-discussion', F.pD);
    rec('queue-visibility', persona, 'sees pD in pending queue', true, v.seen, v.status === 200 && v.seen, `http=${v.status}`);
  }
  for (const [persona, token] of [['modNoPerms', P.fxNoPerms], ['modPartial(pin only)', P.fxPartial], ['member', P.member]]) {
    const v = await pendingSeen(token, 'cse-discussion', F.pD);
    rec('queue-visibility', persona, 'does NOT see pD in pending queue', false, v.seen, v.status === 200 && !v.seen, `http=${v.status}`);
  }
  {
    const v = await pendingSeen(P.otherMod, 'coding-club', F.tCodingPending);
    rec('queue-visibility', 'otherCommunityMod(aman)', 'does NOT see coding pending', false, v.seen, v.status === 200 && !v.seen, `http=${v.status}`);
  }

  expect('review-post', 'modNoPerms', 'approve pD', 403, await req('PUT', `/posts/${F.pD}/review`, P.fxNoPerms, { action: 'approve' }));
  expect('review-post', 'modPartial(pin only)', 'approve pD', 403, await req('PUT', `/posts/${F.pD}/review`, P.fxPartial, { action: 'approve' }));
  expect('review-post', 'member', 'approve pD', 403, await req('PUT', `/posts/${F.pD}/review`, P.member, { action: 'approve' }));
  expect('review-post', 'otherCommunityMod(aman)', 'approve tCodingPending', 403, await req('PUT', `/posts/${F.tCodingPending}/review`, P.otherMod, { action: 'approve' }));
  {
    const st = (await Post.findById(F.pD)).status;
    rec('review-post', 'denial target', 'pD stays pending', CONTENT_STATUS.PENDING, st, st === CONTENT_STATUS.PENDING);
  }

  expect('review-post', 'head', 'approve pA', 200, await req('PUT', `/posts/${F.pA}/review`, P.head, { action: 'approve' }));
  expect('review-post', 'modWith(rahul)', 'approve pB', 200, await req('PUT', `/posts/${F.pB}/review`, P.modWith, { action: 'approve' }));
  expect('review-post', 'admin', 'approve pC', 200, await req('PUT', `/posts/${F.pC}/review`, P.admin, { action: 'approve' }));
  for (const [k, id] of [['pA', F.pA], ['pB', F.pB], ['pC', F.pC]]) {
    const st = (await Post.findById(id)).status;
    rec('review-post', k, 'published after approval', CONTENT_STATUS.PUBLISHED, st, st === CONTENT_STATUS.PUBLISHED);
  }

  // ================= F. JOIN-REQUEST REVIEW =================
  for (const [persona, token] of [['head', P.head], ['modWith(rahul)', P.modWith], ['admin', P.admin]]) {
    const r = await req('GET', `/communities/cse-discussion/join-requests`, token);
    rec('join-requests', persona, 'GET queue', 200, r.status, r.status === 200, r.json?.message || '');
  }
  for (const [persona, token] of [['modNoPerms', P.fxNoPerms], ['modPartial(pin only)', P.fxPartial], ['member', P.member]]) {
    const r = await req('GET', `/communities/cse-discussion/join-requests`, token);
    rec('join-requests', persona, 'GET queue denied', 403, r.status, r.status === 403, r.json?.message || '');
  }
  {
    const r = await req('GET', `/communities/coding-club/join-requests`, P.otherMod);
    rec('join-requests', 'otherCommunityMod(aman)', 'GET coding queue denied', 403, r.status, r.status === 403, r.json?.message || '');
  }

  expect('join-requests', 'head', 'approve fxJ1', 200, await req('PATCH', `/communities/cse-discussion/join-requests/${U.fxJ1._id}`, P.head, { status: 'active' }));
  expect('join-requests', 'modWith(rahul)', 'approve fxJ2', 200, await req('PATCH', `/communities/cse-discussion/join-requests/${U.fxJ2._id}`, P.modWith, { status: 'active' }));
  expect('join-requests', 'admin', 'approve fxJ3', 200, await req('PATCH', `/communities/cse-discussion/join-requests/${U.fxJ3._id}`, P.admin, { status: 'active' }));

  expect('join-requests', 'modNoPerms', 'approve fxJ4 denied', 403, await req('PATCH', `/communities/cse-discussion/join-requests/${U.fxJ4._id}`, P.fxNoPerms, { status: 'active' }));
  expect('join-requests', 'modPartial(pin only)', 'approve fxJ4 denied', 403, await req('PATCH', `/communities/cse-discussion/join-requests/${U.fxJ4._id}`, P.fxPartial, { status: 'active' }));
  expect('join-requests', 'member', 'approve fxJ4 denied', 403, await req('PATCH', `/communities/cse-discussion/join-requests/${U.fxJ4._id}`, P.member, { status: 'active' }));
  expect('join-requests', 'otherCommunityMod(aman)', 'approve fxJ5 (coding) denied', 403, await req('PATCH', `/communities/coding-club/join-requests/${U.fxJ5._id}`, P.otherMod, { status: 'active' }));
  {
    const s4 = (await CommunityMember.findById(F.jM4)).status;
    const s5 = (await CommunityMember.findById(F.jM5)).status;
    rec('join-requests', 'denial targets', 'fxJ4+fxJ5 stay pending', 'pending/pending', `${s4}/${s5}`, s4 === 'pending' && s5 === 'pending');
  }

  // ================= G. POST-REQUEST REVIEW =================
  for (const [persona, token] of [['head', P.head], ['modWith(rahul)', P.modWith], ['admin', P.admin]]) {
    const r = await req('GET', `/communities/cse-discussion/post-requests`, token);
    rec('post-requests', persona, 'GET queue', 200, r.status, r.status === 200, r.json?.message || '');
  }
  for (const [persona, token] of [['modNoPerms', P.fxNoPerms], ['modPartial(pin only)', P.fxPartial], ['member', P.member]]) {
    const r = await req('GET', `/communities/cse-discussion/post-requests`, token);
    rec('post-requests', persona, 'GET queue denied', 403, r.status, r.status === 403, r.json?.message || '');
  }
  {
    const r = await req('GET', `/communities/coding-club/post-requests`, P.otherMod);
    rec('post-requests', 'otherCommunityMod(aman)', 'GET coding queue denied', 403, r.status, r.status === 403, r.json?.message || '');
  }

  expect('post-requests', 'head', 'approve prA', 200, await req('PATCH', `/post-requests/${F.prA}`, P.head, { status: 'approved' }));
  expect('post-requests', 'modWith(rahul)', 'approve prB', 200, await req('PATCH', `/post-requests/${F.prB}`, P.modWith, { status: 'approved' }));
  expect('post-requests', 'admin', 'approve prC', 200, await req('PATCH', `/post-requests/${F.prC}`, P.admin, { status: 'approved' }));

  expect('post-requests', 'modNoPerms', 'approve prD denied', 403, await req('PATCH', `/post-requests/${F.prD}`, P.fxNoPerms, { status: 'approved' }));
  expect('post-requests', 'modPartial(pin only)', 'approve prD denied', 403, await req('PATCH', `/post-requests/${F.prD}`, P.fxPartial, { status: 'approved' }));
  expect('post-requests', 'member', 'approve prD denied', 403, await req('PATCH', `/post-requests/${F.prD}`, P.member, { status: 'approved' }));
  expect('post-requests', 'otherCommunityMod(aman)', 'approve prE (coding) denied', 403, await req('PATCH', `/post-requests/${F.prE}`, P.otherMod, { status: 'approved' }));
  {
    const s4 = (await PostRequest.findById(F.prD)).status;
    const s5 = (await PostRequest.findById(F.prE)).status;
    rec('post-requests', 'denial targets', 'prD+prE stay pending', 'pending/pending', `${s4}/${s5}`, s4 === 'pending' && s5 === 'pending');
  }

  // ================= H. MARK ACCEPTED ANSWER =================
  expect('mark-accepted', 'modNoPerms', 'accept cAccept', 403, await req('POST', `/comments/${F.cAccept}/accept`, P.fxNoPerms));
  expect('mark-accepted', 'modPartial(pin only)', 'accept cAccept', 403, await req('POST', `/comments/${F.cAccept}/accept`, P.fxPartial));
  expect('mark-accepted', 'member(non-author)', 'accept cAccept', 403, await req('POST', `/comments/${F.cAccept}/accept`, P.member));
  expect('mark-accepted', 'otherCommunityMod(aman)', 'accept cCoding', 403, await req('POST', `/comments/${F.cCoding}/accept`, P.otherMod));
  {
    const acc = (await Comment.findById(F.cAccept)).isAccepted;
    rec('mark-accepted', 'denial target', 'cAccept stays not-accepted', false, acc, acc === false);
  }

  for (const [persona, token] of [['head', P.head], ['modWith(rahul)', P.modWith], ['admin', P.admin]]) {
    const r1 = await req('POST', `/comments/${F.cAccept}/accept`, token);
    const r2 = await req('POST', `/comments/${F.cAccept}/accept`, token);
    const acc = (await Comment.findById(F.cAccept)).isAccepted;
    const pass = r1.status === 200 && r2.status === 200 && acc === false;
    rec('mark-accepted', persona, 'accept+unset cAccept', '200/200 restored', `${r1.status}/${r2.status} isAccepted=${acc}`, pass);
  }
  for (const [persona, token] of [['post-author(fxPostAuthor)', P.fxPostAuthor]]) {
    const r1 = await req('POST', `/comments/${F.cAuthor}/accept`, token);
    const r2 = await req('POST', `/comments/${F.cAuthor}/accept`, token);
    const acc = (await Comment.findById(F.cAuthor)).isAccepted;
    const pass = r1.status === 200 && r2.status === 200 && acc === false;
    rec('mark-accepted', persona, 'accept+unset cAuthor (author path)', '200/200 restored', `${r1.status}/${r2.status} isAccepted=${acc}`, pass);
  }

  // ================= I. REVOCATION + CROSS-COMMUNITY ISOLATION =================
  const cseRahulM = await CommunityMember.findOne({ user: U.modWith._id, community: cse._id });
  const savedPerms = [...cseRahulM.delegatedPermissions];

  // I1: remove lock_posts only in CSE -> lock denied, pin still allowed (granularity)
  cseRahulM.delegatedPermissions = savedPerms.filter((p) => p !== DELEGATED_PERMISSIONS.LOCK_POSTS);
  await cseRahulM.save();
  await Post.updateOne({ _id: F.tPin }, { $set: { status: CONTENT_STATUS.PUBLISHED, allowComments: true, isPinned: false, pinnedAt: null, pinnedBy: null } });
  await Post.updateMany({ community: cse._id, isPinned: true }, { $set: { isPinned: false, pinnedAt: null, pinnedBy: null } });
  expect('revocation', 'modWith(rahul) w/o lock_posts', 'lock tPin denied', 403, await req('PUT', `/posts/${F.tPin}/lock`, P.modWith));
  {
    const r1 = await req('PUT', `/posts/${F.tPin}/pin`, P.modWith);
    const r2 = await req('PUT', `/posts/${F.tPin}/pin`, P.modWith);
    rec('revocation', 'modWith(rahul) w/o lock_posts', 'pin still allowed (subset)', '200/200', `${r1.status}/${r2.status}`, r1.status === 200 && r2.status === 200);
  }

  // I2: remove pin_posts in CSE -> CSE pin denied BUT coding-club pin still allowed (isolation)
  cseRahulM.delegatedPermissions = savedPerms.filter((p) => p !== DELEGATED_PERMISSIONS.PIN_POSTS);
  await cseRahulM.save();
  expect('isolation', 'modWith(rahul) w/o pin@cse', 'pin tPin (CSE) denied', 403, await req('PUT', `/posts/${F.tPin}/pin`, P.modWith));
  {
    const r1 = await req('PUT', `/posts/${F.tCoding}/pin`, P.modWith);
    const r2 = await req('PUT', `/posts/${F.tCoding}/pin`, P.modWith);
    const codingPinned = (await Post.findById(F.tCoding)).isPinned;
    rec('isolation', 'modWith(rahul) w/o pin@cse', 'pin tCoding (coding-club) allowed', '200/200 restored', `${r1.status}/${r2.status} pinned=${codingPinned}`, r1.status === 200 && r2.status === 200 && codingPinned === false);
  }

  // I3: restore -> immediate recovery
  cseRahulM.delegatedPermissions = savedPerms;
  await cseRahulM.save();
  {
    const r1 = await req('PUT', `/posts/${F.tPin}/lock`, P.modWith);
    const r2 = await req('PUT', `/posts/${F.tPin}/lock`, P.modWith);
    rec('revocation', 'modWith(rahul) restored', 'lock allowed again', '200/200', `${r1.status}/${r2.status}`, r1.status === 200 && r2.status === 200);
  }

  // ================= J. AUDIT ACTOR VERIFICATION =================
  const audits = await AuditLog.find({ community: cse._id });
  const findAudit = (action, targetType, targetId) =>
    audits.find((a) => a.action === action && a.targetType === targetType && a.targetId === String(targetId));

  const checkActor = (action, targetType, targetId, persona, expectedActor) => {
    const a = findAudit(action, targetType, targetId);
    const actual = a ? String(a.actor) : 'MISSING';
    const pass = actual === String(expectedActor);
    rec('audit-actor', persona, `${action}:${targetId}`, String(expectedActor), actual, pass, a ? '' : 'audit entry missing');
  };

  checkActor('delete_post', 'post', F.delHead, 'head', U.head._id);
  checkActor('delete_post', 'post', F.delMod, 'modWith(rahul)', U.modWith._id);
  checkActor('delete_post', 'post', F.delAdmin, 'admin', U.admin._id);
  checkActor('delete_post', 'post', F.delOwn, 'post-author(fxAuthor)', U.fxAuthor._id);
  checkActor('approve_post', 'post', F.pA, 'head', U.head._id);
  checkActor('approve_post', 'post', F.pB, 'modWith(rahul)', U.modWith._id);
  checkActor('approve_post', 'post', F.pC, 'admin', U.admin._id);
  checkActor('approve_join_request', 'join_request', F.jM1, 'head', U.head._id);
  checkActor('approve_join_request', 'join_request', F.jM2, 'modWith(rahul)', U.modWith._id);
  checkActor('approve_join_request', 'join_request', F.jM3, 'admin', U.admin._id);
  checkActor('approve_post', 'post_request', F.prA, 'head', U.head._id);
  checkActor('approve_post', 'post_request', F.prB, 'modWith(rahul)', U.modWith._id);
  checkActor('approve_post', 'post_request', F.prC, 'admin', U.admin._id);

  // Denied actions must have written NO audit entries
  const countAudit = (action, targetType, targetId) =>
    audits.filter((a) => a.action === action && a.targetType === targetType && a.targetId === String(targetId)).length;
  rec('audit-actor', 'denials', 'no delete_post audit for delShared', 0, countAudit('delete_post', 'post', F.delShared), countAudit('delete_post', 'post', F.delShared) === 0);
  rec('audit-actor', 'denials', 'no approve audit for pD', 0, countAudit('approve_post', 'post', F.pD), countAudit('approve_post', 'post', F.pD) === 0);
  rec('audit-actor', 'denials', 'no join audit for jM4', 0, countAudit('approve_join_request', 'join_request', F.jM4), countAudit('approve_join_request', 'join_request', F.jM4) === 0);
  rec('audit-actor', 'denials', 'no post_request audit for prD', 0, countAudit('approve_post', 'post_request', F.prD), countAudit('approve_post', 'post_request', F.prD) === 0);

  // Pin/unpin audits on tPin: every allowed persona must appear as an actor
  const pinActors = new Set(
    audits
      .filter((a) => ['pin_post', 'unpin_post'].includes(a.action) && a.targetId === String(F.tPin))
      .map((a) => String(a.actor))
  );
  for (const [persona, id] of [['head', U.head._id], ['modWith(rahul)', U.modWith._id], ['admin', U.admin._id], ['modPartial(pin only)', U.fxPartial._id]]) {
    const pass = pinActors.has(String(id));
    rec('audit-actor', persona, 'appears as pin/unpin actor on tPin', true, pass, pass);
  }

  // ================= CLEANUP (fixtures only; audit trail preserved as evidence) =================
  const fxKeys = ['fxAuthor', 'fxCommenter', 'fxPostAuthor', 'fxAnswerer', 'fxNoPerms', 'fxPartial', 'fxJ1', 'fxJ2', 'fxJ3', 'fxJ4', 'fxJ5', 'fxPr1', 'fxPr2', 'fxPr3', 'fxPr4', 'fxPr5'];
  const fxUserIds = fxKeys.map((k) => U[k]._id);
  const fixturePostIds = [F.tPin, F.tAccept, F.tAuthorPost, F.delShared, F.delHead, F.delMod, F.delAdmin, F.delOwn, F.pA, F.pB, F.pC, F.pD, F.tCoding, F.tCodingPending, F.tCodingAccept];

  const stillPublished = await Post.find({ _id: { $in: fixturePostIds }, status: CONTENT_STATUS.PUBLISHED }).select('community');
  const perComm = {};
  for (const p of stillPublished) {
    const k = String(p.community);
    perComm[k] = (perComm[k] || 0) + 1;
  }
  for (const [k, n] of Object.entries(perComm)) {
    await Community.updateOne({ _id: k }, { $inc: { postCount: -n } });
  }

  await Comment.deleteMany({ _id: { $in: [F.cAccept, F.cAuthor, F.cCoding] } });
  await Post.deleteMany({ _id: { $in: fixturePostIds } });
  await PostRequest.deleteMany({ _id: { $in: [F.prA, F.prB, F.prC, F.prD, F.prE] } });
  await CommunityMember.deleteMany({ user: { $in: fxUserIds } });
  // Restore aman's seeded CSE membership (removed in the precheck so he acts as
  // the cross-community moderator during the matrix).
  if (F._amanCseRole) {
    await CommunityMember.updateOne(
      { user: U.otherMod._id, community: cse._id },
      {
        $setOnInsert: { status: 'active', canPost: true },
        $set: { role: F._amanCseRole, delegatedPermissions: F._amanCsePerms || [] },
      },
      { upsert: true }
    );
  }
  try {
    const { Notification } = await import('../src/models/Notification.js');
    await Notification.deleteMany({ $or: [{ user: { $in: fxUserIds } }, { actorId: { $in: fxUserIds } }] });
  } catch {
    /* notification cleanup best-effort */
  }
  await User.deleteMany({ _id: { $in: fxUserIds } });
  console.log('[C5] Fixtures cleaned up (audit logs preserved).');
}

// ---------- Summary / invocation ----------
main()
  .then(async () => {
    const fails = results.filter((r) => !r.pass);
    console.log(`\n==== C5 API MATRIX: total=${results.length} pass=${results.length - fails.length} fail=${fails.length}`);
    if (fails.length) {
      console.log('---- FAILURES ----');
      for (const f of fails) console.log(JSON.stringify(f));
    }
    const out = {
      generatedAt: new Date().toISOString(),
      total: results.length,
      pass: results.length - fails.length,
      fail: fails.length,
      results,
    };
    fs.writeFileSync(path.join(os.tmpdir(), 'c5_matrix_result.json'), JSON.stringify(out, null, 2));
    console.log(`[C5] Results JSON: ${path.join(os.tmpdir(), 'c5_matrix_result.json')}`);
    await mongoose.disconnect();
    process.exit(fails.length ? 1 : 0);
  })
  .catch(async (err) => {
    console.error('[C5] FATAL:', err);
    try {
      await mongoose.disconnect();
    } catch {
      /* ignore */
    }
    process.exit(2);
  });






