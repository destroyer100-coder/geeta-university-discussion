import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { Community } from '../models/Community.js';
import { CommunityMember } from '../models/CommunityMember.js';
import { DELEGATED_PERMISSIONS } from '../constants/index.js';

/**
 * C5 one-time migration: normalize seeded moderator delegations.
 *
 * Before C5, moderation authorization treated every active moderator as fully
 * authorized without consulting `delegatedPermissions`. This migration gives the
 * seeded moderators exactly the capabilities they exercised before C5, expressed
 * as explicit delegations:
 *
 *   pin_posts             -> pin/unpin (rules §26)
 *   lock_posts            -> lock/unlock (rules §26)
 *   delete_posts          -> remove posts/comments/attachments (rules §25)
 *   manage_requests       -> join/post request review + pending-post approval (§9, §10, §13)
 *   mark_accepted_answers -> mark accepted answers on others' discussions (existing behavior)
 *
 * `manage_rules` is intentionally NOT granted: community settings/rules updates
 * remain Head/Platform-Admin only (no moderator path exists).
 *
 * Scope (smallest safe): ONLY moderator memberships that (a) belong to the seeded
 * moderators — rahul/aman — in seeded communities, AND (b) currently have an empty
 * or missing delegatedPermissions array. Records that already carry delegations are
 * never modified. Any other moderator records found are reported but left untouched.
 *
 * Idempotent: re-running makes no changes once delegations exist.
 */
const SEEDED_MODERATOR_GRANT = [
  DELEGATED_PERMISSIONS.PIN_POSTS,
  DELEGATED_PERMISSIONS.LOCK_POSTS,
  DELEGATED_PERMISSIONS.DELETE_POSTS,
  DELEGATED_PERMISSIONS.MANAGE_REQUESTS,
  DELEGATED_PERMISSIONS.MARK_ACCEPTED_ANSWERS,
];

const SEEDED_MODERATOR_EMAILS = ['rahul@geeta.edu.in', 'aman@geeta.edu.in'];
const SEEDED_COMMUNITY_SLUGS = ['cse-discussion', 'coding-club', 'general-discussion', 'placement-updates', 'university-announcements'];

export const migrateDelegatedPermissions = async () => {
  console.log('[Migration] C5 moderator delegation normalization starting...');

  const seededUsers = await User.find({ email: { $in: SEEDED_MODERATOR_EMAILS } }).select('_id email');
  const seededCommunities = await Community.find({ slug: { $in: SEEDED_COMMUNITY_SLUGS } }).select('_id slug name');
  const seededUserIds = seededUsers.map((u) => u._id);
  const seededCommunityIds = seededCommunities.map((c) => c._id);

  const allMods = await CommunityMember.find({ role: 'moderator' })
    .populate('user', 'email name')
    .populate('community', 'slug name');

  if (allMods.length === 0) {
    console.log('[Migration] No moderator memberships found. Nothing to do.');
    return { granted: 0, skipped: 0, untouched: [] };
  }

  console.log(`[Migration] Found ${allMods.length} moderator membership(s):`);
  for (const m of allMods) {
    console.log(
      `  - ${m.user?.email || m.user} @ ${m.community?.slug || m.community} | status=${m.status} | delegatedPermissions=[${(m.delegatedPermissions || []).join(', ')}]`
    );
  }

  let granted = 0;
  let skipped = 0;
  const untouched = [];

  for (const m of allMods) {
    const existing = m.delegatedPermissions || [];
    const isSeededModerator =
      seededUserIds.some((id) => id.toString() === (m.user?._id || m.user).toString()) &&
      seededCommunityIds.some((id) => id.toString() === (m.community?._id || m.community).toString());

    if (existing.length > 0) {
      console.log(`[Migration] SKIP (already has delegations): ${m.user?.email} @ ${m.community?.slug}`);
      skipped += 1;
      continue;
    }

    if (!isSeededModerator) {
      console.log(
        `[Migration] UNTOUCHED (non-seeded moderator with empty delegations — reported, NOT granted): ${m.user?.email} @ ${m.community?.slug}`
      );
      untouched.push({ user: m.user?.email, community: m.community?.slug, status: m.status });
      skipped += 1;
      continue;
    }

    m.delegatedPermissions = [...SEEDED_MODERATOR_GRANT];
    await m.save();
    granted += 1;
    console.log(
      `[Migration] GRANTED [${SEEDED_MODERATOR_GRANT.join(', ')}] -> ${m.user?.email} @ ${m.community?.slug}`
    );
  }

  console.log(`[Migration] Done. granted=${granted} skipped=${skipped} untouchedNonSeeded=${untouched.length}`);
  return { granted, skipped, untouched };
};

// Allow running directly: node src/utils/migrateDelegatedPermissions.js
if (process.argv[1] && process.argv[1].endsWith('migrateDelegatedPermissions.js')) {
  (async () => {
    try {
      await connectDB();
      const result = await migrateDelegatedPermissions();
      console.log('[Migration] Result:', JSON.stringify(result));
      await mongoose.disconnect();
      process.exit(0);
    } catch (err) {
      console.error('[Migration] Failed:', err);
      await mongoose.disconnect();
      process.exit(1);
    }
  })();
}