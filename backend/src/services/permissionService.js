import { CommunityMember } from '../models/CommunityMember.js';
import { Community } from '../models/Community.js';
import { Block } from '../models/Block.js';
import {
  VISIBILITY,
  POST_POLICY,
  COMMENT_POLICY,
  COMMUNITY_MEMBER_ROLES,
  DELEGATED_PERMISSIONS,
  CONTENT_STATUS,
} from '../constants/index.js';

export const permissionService = {
  /**
   * Helper: Check if either user has blocked the other
   */
  async isBlocked(userAId, userBId) {
    if (!userAId || !userBId) return false;
    const a = userAId._id || userAId;
    const b = userBId._id || userBId;
    if (a.toString() === b.toString()) return false;

    const blockRecord = await Block.findOne({
      $or: [
        { blocker: a, blocked: b },
        { blocker: b, blocked: a },
      ],
    });
    return !!blockRecord;
  },

  /**
   * Helper: resolves a user's membership record for one community.
   */
  async getMembership(userId, communityId) {
    if (!userId || !communityId) return null;
    return CommunityMember.findOne({ user: userId, community: communityId });
  },

  /**
   * Evaluates if a user is an admin/owner/moderator of a community
   */
  async canModerate(user, communityOrId) {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (!communityOrId) return false;

    let community = communityOrId;
    if (!community.owner && (community._id || typeof community === 'string')) {
      community = await Community.findById(community._id || community);
    }
    if (!community) return false;

    const userIdStr = (user._id || user).toString();
    if (community.owner && community.owner.toString() === userIdStr) return true;

    const membership = await CommunityMember.findOne({
      user: user._id || user,
      community: community._id,
      role: { $in: [COMMUNITY_MEMBER_ROLES.OWNER, COMMUNITY_MEMBER_ROLES.MODERATOR] },
      status: 'active',
    });

    return !!membership;
  },

  /**
   * Evaluates whether a user holds ONE specific delegated permission for ONE
   * exact community (rules §3, §8 step 7).
   *
   * - Platform Admin: always authorized (documented platform-level authority).
   * - Community Head/Owner: always authorized (documented Head authority, rules §3).
   * - Moderator: authorized ONLY when their membership in THAT EXACT community is
   *   active AND the required permission is explicitly present in delegatedPermissions.
   *   An empty/missing delegatedPermissions array NEVER grants access.
   * - Moderator status in any other community is irrelevant (rules §3 critical note).
   */
  async hasDelegatedPermission(user, communityOrId, permission) {
    if (!user || !permission) return false;
    if (user.role === 'admin') return true;
    if (!communityOrId) return false;

    let community = communityOrId;
    if (!community.owner && (community._id || typeof community === 'string')) {
      community = await Community.findById(community._id || community);
    }
    if (!community) return false;

    const userIdStr = (user._id || user).toString();
    if (community.owner && community.owner.toString() === userIdStr) return true;

    const membership = await CommunityMember.findOne({
      user: user._id || user,
      community: community._id,
      role: { $in: [COMMUNITY_MEMBER_ROLES.OWNER, COMMUNITY_MEMBER_ROLES.MODERATOR] },
      status: 'active',
    });
    if (!membership) return false;
    if (membership.role === COMMUNITY_MEMBER_ROLES.OWNER) return true;

    return (membership.delegatedPermissions || []).includes(permission);
  },

  /**
   * Granular moderation capability flags for ONE exact community.
   * Returned by API responses so the UI only renders actions the server would accept.
   * Head/Platform Admin receive all flags; moderators receive only delegated ones;
   * everyone else receives all-false.
   */
  async getModerationPermissions(user, communityOrId) {
    const allTrue = {
      canModerate: true,
      pin: true,
      lock: true,
      delete: true,
      manageRequests: true,
      markAccepted: true,
      manageRules: true,
    };
    const allFalse = {
      canModerate: false,
      pin: false,
      lock: false,
      delete: false,
      manageRequests: false,
      markAccepted: false,
      manageRules: false,
    };

    if (!user) return allFalse;
    if (user.role === 'admin') return allTrue;
    if (!communityOrId) return allFalse;

    let community = communityOrId;
    if (!community.owner && (community._id || typeof community === 'string')) {
      community = await Community.findById(community._id || community);
    }
    if (!community) return allFalse;

    const userIdStr = (user._id || user).toString();
    if (community.owner && community.owner.toString() === userIdStr) return allTrue;

    const membership = await CommunityMember.findOne({
      user: user._id || user,
      community: community._id,
      role: { $in: [COMMUNITY_MEMBER_ROLES.OWNER, COMMUNITY_MEMBER_ROLES.MODERATOR] },
      status: 'active',
    });
    if (!membership) return allFalse;
    if (membership.role === COMMUNITY_MEMBER_ROLES.OWNER) return allTrue;

    const perms = membership.delegatedPermissions || [];
    const has = (p) => perms.includes(p);
    return {
      canModerate: perms.length > 0,
      pin: has(DELEGATED_PERMISSIONS.PIN_POSTS),
      lock: has(DELEGATED_PERMISSIONS.LOCK_POSTS),
      delete: has(DELEGATED_PERMISSIONS.DELETE_POSTS),
      manageRequests: has(DELEGATED_PERMISSIONS.MANAGE_REQUESTS),
      markAccepted: has(DELEGATED_PERMISSIONS.MARK_ACCEPTED_ANSWERS),
      manageRules: has(DELEGATED_PERMISSIONS.MANAGE_RULES),
    };
  },

  /**
   * Evaluates who may review membership/join requests for one exact community:
   * - Platform Admin (documented platform-level authority)
   * - Community Head/Owner
   * - A Moderator of THAT community holding the `manage_requests` delegation
   *
   * A moderator of another community, or a moderator without the delegation,
   * is never authorized (rules §3, §8, §13).
   */
  async canReviewJoinRequests(user, communityOrId) {
    return this.hasDelegatedPermission(user, communityOrId, DELEGATED_PERMISSIONS.MANAGE_REQUESTS);
  },

  /**
   * Evaluates if a user can create a post.
   *
   * The community `postPolicy` is authoritative for every community (rules §5,
   * §37.5, §37.8):
   * 1. Global (no community): any authenticated user may post.
   * 2. EVERYONE: any user allowed by the community's privacy rule.
   * 3. MEMBERS: active community members only.
   * 4. APPROVED_USERS: active members whose posting permission is intact.
   * 5. HEAD_MODS: community Head / authorized moderators (and platform admin) only.
   * 6. CUSTOM: no custom configuration is stored yet, so fail closed.
   * Approval is driven by `requirePostApproval`, never by visibility alone (§10).
   */
  async canCreatePost(user, community) {
    if (!user) {
      return {
        allowed: false,
        requireApproval: false,
        canRequest: false,
        reason: 'Authentication is required to post.',
      };
    }

    // Global / Campus-wide post (no community)
    if (!community) {
      return {
        allowed: true,
        requireApproval: false,
        canRequest: false,
        reason: 'Campus-wide discussion: Open to all members.',
      };
    }

    // Platform admin and Community Owner/Moderator post directly without approval
    const isMod = await this.canModerate(user, community);
    if (isMod) {
      return {
        allowed: true,
        requireApproval: false,
        canRequest: false,
        reason: 'Admin / Moderator privileges',
      };
    }

    const permissions = community.permissions || {};
    const isPrivate = permissions.visibility === VISIBILITY.MEMBERS_ONLY;
    const postPolicy = permissions.postPolicy || POST_POLICY.MEMBERS;
    const canRequest = !!permissions.allowPostRequests;

    const membership = await this.getMembership(user._id, community._id);

    if (membership && membership.status === 'banned') {
      return {
        allowed: false,
        requireApproval: false,
        canRequest: false,
        reason: 'You are banned from this community.',
      };
    }

    const isActiveMember = !!membership && membership.status === 'active';
    // `canPost` is authoritative server-side data (never a frontend flag):
    // an explicit revocation removes posting rights even for active members.
    const postingAllowed = !membership || membership.canPost !== false;

    const denied = (reason) => ({
      allowed: false,
      requireApproval: false,
      canRequest,
      reason,
    });

    const privateReason =
      'This is a private community. You must join and be approved by a moderator before posting.';
    const memberReason = 'Only approved members of this community can publish posts.';
    const approvedReason = 'Only community members with approved posting permission can publish posts.';

    // Evaluate the configured posting policy (public and private alike)
    switch (postPolicy) {
      case POST_POLICY.HEAD_MODS:
        return denied('Only community heads and authorized moderators can publish in this community.');

      case POST_POLICY.EVERYONE:
        if (isPrivate && !isActiveMember) return denied(privateReason);
        break;

      case POST_POLICY.MEMBERS:
        if (!isActiveMember) return denied(isPrivate ? privateReason : memberReason);
        if (!postingAllowed) {
          return denied('Your posting permission in this community has been revoked.');
        }
        break;

      case POST_POLICY.APPROVED_USERS:
        if (!isActiveMember) return denied(isPrivate ? privateReason : approvedReason);
        if (!postingAllowed) {
          return denied('Your posting permission in this community has been revoked.');
        }
        break;

      case POST_POLICY.CUSTOM:
        // CUSTOM policy: only users explicitly listed in customAllowedUsers can post.
        // Preserve existing admin/moderator/owner bypass (explicitly allowed in existing code).
        const customAllowedUsers = permissions.customAllowedUsers || [];
        const isAllowedUser = customAllowedUsers.some(uid => uid.toString() === user._id.toString());
        if (!isAllowedUser) {
          return denied(
            'Posting in this community follows a custom policy. Only configured users may post.'
          );
        }
        break;

      default:
        return denied('Posting is restricted in this community.');
    }

    // Allowed. Approval follows the community setting (rules §10), not visibility.
    return {
      allowed: true,
      requireApproval: !!permissions.requirePostApproval,
      canRequest: false,
      reason: permissions.requirePostApproval
        ? 'Your post will be submitted for moderator approval before publishing.'
        : 'You can publish in this community.',
    };
  },

  /**
   * Evaluates if user can comment on a post
   */
  async canComment(user, community, post) {
    if (!user) return { allowed: false, reason: 'Authentication required' };
    if (!post) return { allowed: false, reason: 'Post not found' };

    if (post.status === CONTENT_STATUS.LOCKED || post.allowComments === false) {
      return { allowed: false, reason: 'Comments are locked for this discussion' };
    }
    if ([CONTENT_STATUS.DELETED, CONTENT_STATUS.REMOVED, CONTENT_STATUS.PENDING, CONTENT_STATUS.REJECTED].includes(post.status)) {
      return { allowed: false, reason: 'Cannot comment on inactive or pending content' };
    }

    if (post.author) {
      const blocked = await this.isBlocked(user._id, post.author);
      if (blocked) {
        return { allowed: false, reason: 'You cannot comment due to user block settings.' };
      }
    }

    const permissions = community?.permissions || {};
    const isPrivate = permissions.visibility === VISIBILITY.MEMBERS_ONLY;
    const commentPolicy = permissions.commentPolicy || COMMENT_POLICY.EVERYONE;
    if (!Object.values(COMMENT_POLICY).includes(commentPolicy)) {
      return { allowed: false, reason: 'Commenting is disabled until the community policy is corrected.' };
    }

    // Moderators/Head/admin may always participate
    const isMod = community ? await this.canModerate(user, community) : false;
    if (isMod) return { allowed: true };

    const membership = community ? await this.getMembership(user._id, community._id) : null;

    if (membership && membership.status === 'banned') {
      return { allowed: false, reason: 'You are banned from this community.' };
    }

    const isActiveMember = !!membership && membership.status === 'active';
    const privateReason = 'Must be an approved member to comment in private communities';

    // Enforce the configured comment policy server-side (rules §6, §7)
    switch (commentPolicy) {
      case COMMENT_POLICY.HEAD_MODS:
        return {
          allowed: false,
          reason: 'Only community heads and authorized moderators can comment in this community.',
        };

      case COMMENT_POLICY.MEMBERS:
        if (isActiveMember) return { allowed: true };
        return {
          allowed: false,
          reason: isPrivate ? privateReason : 'Only community members can comment in this community.',
        };

      case COMMENT_POLICY.APPROVED_USERS:
        if (isActiveMember && membership.canPost !== false) return { allowed: true };
        return {
          allowed: false,
          reason: 'Only community members with approved permission can comment in this community.',
        };

      case COMMENT_POLICY.CUSTOM:
        // CUSTOM policy: only users explicitly listed in customAllowedUsers can comment.
        // Preserve existing admin/moderator/owner bypass (explicitly allowed in existing code).
        const customAllowedUsers = permissions.customAllowedUsers || [];
        const isAllowedUser = customAllowedUsers.some(uid => uid.toString() === user._id.toString());
        if (!isAllowedUser) {
          return {
            allowed: false,
            reason: 'Commenting in this community follows a custom policy. Only configured users may comment.',
          };
        }
        return { allowed: true };

      case COMMENT_POLICY.EVERYONE:
      default:
        if (isPrivate && !isActiveMember) {
          return { allowed: false, reason: privateReason };
        }
        return { allowed: true };
    }
  },

  /**
   * Evaluates if a user can share a post (sharePolicy enforcement, authoritative).
   * - DISABLED: sharing is blocked for everyone in this community.
   * - MEMBERS: sharing is allowed only for active community members.
   * - EVERYONE: sharing is allowed for everyone (including non-members).
   * Backend is authoritative; frontend hides/disables the action based on this.
   * user: the authenticated user attempting to share.
   */
  async canShare(user, community, post) {
    if (!user || !community || !community.permissions) return false;
    if (!community._id) return false;
    const sharePolicy = community.permissions.sharePolicy || SHARE_POLICY.EVERYONE;
    if (!Object.values(SHARE_POLICY).includes(sharePolicy)) return false;
    if (post && [CONTENT_STATUS.DELETED, CONTENT_STATUS.REMOVED].includes(post.status)) {
      return false;
    }
    if (sharePolicy === SHARE_POLICY.DISABLED) return false;
    if (sharePolicy === SHARE_POLICY.MEMBERS) {
      const membership = await CommunityMember.findOne({
        user: user._id,
        community: community._id,
        status: 'active',
      });
      return Boolean(membership);
    }
    return sharePolicy === SHARE_POLICY.EVERYONE;
  },

  /**
   * Evaluates if user can delete post
   * (admin, author-of-own-post, or moderator with the `delete_posts` delegation)
   */
  async canDeletePost(user, post, community) {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (post.author && post.author.toString() === user._id.toString()) return true;
    return this.hasDelegatedPermission(user, community, DELEGATED_PERMISSIONS.DELETE_POSTS);
  },

  /**
   * Evaluates if user can delete/moderate comment
   * (admin, comment author, or moderator with the `delete_posts` delegation)
   */
  async canModerateComment(user, comment, post, community) {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (comment.author && comment.author.toString() === user._id.toString()) return true;
    return this.hasDelegatedPermission(user, community, DELEGATED_PERMISSIONS.DELETE_POSTS);
  },

  /**
   * Evaluates if user can pin a post (requires the `pin_posts` delegation for moderators)
   */
  async canPinPost(user, community) {
    return this.hasDelegatedPermission(user, community, DELEGATED_PERMISSIONS.PIN_POSTS);
  },

  /**
   * Evaluates if user can access private attachment
   */
  async canAccessAttachment(user, attachment, post, community) {
    if (!community || community.permissions?.visibility !== VISIBILITY.MEMBERS_ONLY) {
      return true;
    }

    if (!user) return false;
    if (user.role === 'admin' || (post && post.author && post.author.toString() === user._id.toString())) return true;
    const isMod = await this.canModerate(user, community);
    if (isMod) return true;

    const membership = await CommunityMember.findOne({
      user: user._id,
      community: community._id,
      status: 'active',
    });

    return !!membership;
  },
};
