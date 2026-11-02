/**
 * C8 Custom Policy Verification — exercises server-side policy evaluation.
 * Run from backend/: node tests/c8_custom_policy_test.mjs
 *
 * This script creates and removes only its own c8fx_* fixtures. It refuses
 * production and any database whose configured name does not end with "_test".
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Community } from '../src/models/Community.js';
import { CommunityMember } from '../src/models/CommunityMember.js';
import { Post } from '../src/models/Post.js';
import { Comment } from '../src/models/Comment.js';
import { PostRequest } from '../src/models/PostRequest.js';
import { permissionService } from '../src/services/permissionService.js';
import { COMMUNITY_MEMBER_ROLES, CONTENT_STATUS, POST_POLICY, COMMENT_POLICY } from '../src/constants/index.js';

const FIXTURE_PREFIX = 'c8fx_';
const COMMUNITY_SLUG = 'c8fx-test-community';
const failures = [];

function assertTestDatabase() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run database-mutating tests in production.');
  }

  let databaseName = '';
  try {
    databaseName = new URL(process.env.MONGODB_URI || '').pathname.split('/').filter(Boolean)[0] || '';
  } catch {
    databaseName = '';
  }

  if (!/_test$/i.test(databaseName)) {
    throw new Error(
      'These tests mutate fixture records. Set MONGODB_URI to a disposable database whose name ends in "_test".'
    );
  }
}

function check(label, expected, actual) {
  const passed = expected === actual;
  console.log(`[${passed ? 'PASS' : 'FAIL'}] ${label} — expected ${expected}, got ${actual}`);
  if (!passed) failures.push({ label, expected, actual });
}

async function cleanupFixtures() {
  const fixtureUsers = await User.find({ email: new RegExp(`^${FIXTURE_PREFIX}`, 'i') }).select('_id');
  const userIds = fixtureUsers.map((user) => user._id);
  const community = await Community.findOne({ slug: COMMUNITY_SLUG }).select('_id');
  const communityIds = community ? [community._id] : [];

  const posts = await Post.find({
    $or: [
      { author: { $in: userIds } },
      { community: { $in: communityIds } },
    ],
  }).select('_id');
  const postIds = posts.map((post) => post._id);

  if (postIds.length) {
    await Comment.deleteMany({ post: { $in: postIds } });
    await Post.deleteMany({ _id: { $in: postIds } });
  }
  if (userIds.length) {
    await Comment.deleteMany({ author: { $in: userIds } });
    await PostRequest.deleteMany({ user: { $in: userIds } });
  }
  if (communityIds.length) {
    await PostRequest.deleteMany({ community: { $in: communityIds } });
  }

  await CommunityMember.deleteMany({
    $or: [
      { user: { $in: userIds } },
      { community: { $in: communityIds } },
    ],
  });
  if (community) await Community.deleteOne({ _id: community._id });
  if (userIds.length) await User.deleteMany({ _id: { $in: userIds } });
}

async function main() {
  assertTestDatabase();
  await connectDB();

  try {
    // Make reruns deterministic and avoid duplicate community slugs.
    await cleanupFixtures();

    const passwordHash = await bcrypt.hash('fixture-only-password', 12);
    const usersData = [
      { key: 'head', email: 'c8fx_head@test.edu.in', name: 'C8 FX Head', role: 'student' },
      { key: 'allowed', email: 'c8fx_allowed@test.edu.in', name: 'C8 FX Allowed User', role: 'student' },
      { key: 'denied', email: 'c8fx_denied@test.edu.in', name: 'C8 FX Denied User', role: 'student' },
      { key: 'admin', email: 'c8fx_admin@test.edu.in', name: 'C8 FX Admin', role: 'admin' },
    ];

    const users = {};
    for (const userData of usersData) {
      users[userData.key] = await User.create({
        name: userData.name,
        email: userData.email,
        passwordHash,
        role: userData.role,
        verified: true,
      });
    }

    let community = await Community.create({
      name: 'C8 Custom Policy Test Community',
      slug: COMMUNITY_SLUG,
      description: 'Disposable policy fixture for automated verification.',
      owner: users.head._id,
      category: 'General',
      permissions: {
        postPolicy: POST_POLICY.CUSTOM,
        commentPolicy: COMMENT_POLICY.CUSTOM,
        customAllowedUsers: [users.head._id, users.allowed._id],
      },
    });

    for (const key of ['head', 'allowed', 'denied']) {
      await CommunityMember.create({
        user: users[key]._id,
        community: community._id,
        role: key === 'head' ? COMMUNITY_MEMBER_ROLES.OWNER : COMMUNITY_MEMBER_ROLES.MEMBER,
        status: 'active',
        canPost: true,
      });
    }

    // Reload persisted policy data instead of checking a stale in-memory document.
    community = await Community.findById(community._id);

    const customPostHead = await permissionService.canCreatePost(users.head, community);
    const customPostAllowed = await permissionService.canCreatePost(users.allowed, community);
    const customPostDenied = await permissionService.canCreatePost(users.denied, community);
    const customPostAdmin = await permissionService.canCreatePost(users.admin, community);

    check('CUSTOM posting: community owner is allowed', true, customPostHead.allowed);
    check('CUSTOM posting: explicitly allowed member is allowed', true, customPostAllowed.allowed);
    check('CUSTOM posting: unlisted member is denied', false, customPostDenied.allowed);
    check('CUSTOM posting: platform admin can moderate', true, customPostAdmin.allowed);

    const post = await Post.create({
      author: users.head._id,
      community: community._id,
      title: 'C8 policy test post',
      body: 'Disposable fixture content.',
      status: CONTENT_STATUS.PUBLISHED,
      allowComments: true,
    });

    const customCommentHead = await permissionService.canComment(users.head, community, post);
    const customCommentAllowed = await permissionService.canComment(users.allowed, community, post);
    const customCommentDenied = await permissionService.canComment(users.denied, community, post);
    const customCommentAdmin = await permissionService.canComment(users.admin, community, post);

    check('CUSTOM commenting: community owner is allowed', true, customCommentHead.allowed);
    check('CUSTOM commenting: explicitly allowed member is allowed', true, customCommentAllowed.allowed);
    check('CUSTOM commenting: unlisted member is denied', false, customCommentDenied.allowed);
    check('CUSTOM commenting: platform admin can moderate', true, customCommentAdmin.allowed);

    // Regression: changing back to MEMBERS should not accidentally retain CUSTOM restrictions.
    community.permissions.postPolicy = POST_POLICY.MEMBERS;
    community.permissions.commentPolicy = COMMENT_POLICY.MEMBERS;
    await community.save();
    const membersPolicyPost = await permissionService.canCreatePost(users.denied, community);
    const membersPolicyComment = await permissionService.canComment(users.denied, community, post);
    check('MEMBERS posting: active member remains allowed', true, membersPolicyPost.allowed);
    check('MEMBERS commenting: active member remains allowed', true, membersPolicyComment.allowed);

    console.log(`C8 custom policy checks: ${10 - failures.length} passed, ${failures.length} failed.`);
  } finally {
    await cleanupFixtures();
    await mongoose.disconnect();
  }

  if (failures.length) process.exitCode = 1;
}

main().catch(async (error) => {
  console.error('[C8] FAILED:', error);
  try {
    await mongoose.disconnect();
  } catch {
    // Preserve the original failure.
  }
  process.exitCode = 1;
});
