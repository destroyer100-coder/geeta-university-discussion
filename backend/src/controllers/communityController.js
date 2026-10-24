import { Community } from '../models/Community.js';
import { CommunityMember } from '../models/CommunityMember.js';
import { Post } from '../models/Post.js';
import { AuditLog } from '../models/AuditLog.js';
import { permissionService } from '../services/permissionService.js';
import { notificationService } from '../services/notificationService.js';
import {
  COMMUNITY_MEMBER_ROLES,
  AUDIT_ACTIONS,
  ERROR_CODES,
  COMMUNITY_CATEGORIES,
  DELEGATED_PERMISSIONS,
  VISIBILITY,
} from '../constants/index.js';

const MAX_SEARCH_LENGTH = 120;
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Create Community — authenticated users only.
// Creator becomes the community owner with an active membership record.
export const createCommunity = async (req, res, next) => {
  try {
    const { name, description, category, visibility } = req.body;

    // Validate required name
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Community name is required.',
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Community name is required.' },
      });
    }

    const communityName = name.trim();
    const slug = communityName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!slug) {
      return res.status(400).json({
        success: false,
        message: 'Invalid community name.',
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Invalid community name.' },
      });
    }

    // Reject duplicate name or slug
    const existing = await Community.findOne({
      $or: [{ name: communityName }, { slug }],
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'A community with this name already exists.',
        error: { code: ERROR_CODES.CONFLICT, message: 'Duplicate community name.' },
      });
    }

    // Normalize visibility
    const visibilityValue =
      visibility && Object.values(VISIBILITY).includes(visibility)
        ? visibility
        : VISIBILITY.PUBLIC;

    const categoryValue = category && category.trim() ? category.trim() : 'General';

    // Create community — owner derived from authenticated user, never from client
    const community = await Community.create({
      name: communityName,
      slug,
      description: description ? description.trim() : '',
      category: categoryValue,
      owner: req.user._id,
      moderators: [],
      type: 'general',
      permissions: {
        visibility: visibilityValue,
        postPolicy: 'MEMBERS',
        commentPolicy: 'EVERYONE',
        sharePolicy: 'EVERYONE',
        allowPostRequests: true,
        requirePostApproval: false,
        allowAnonymousPosts: true,
      },
    });

    // Creator becomes owner with active membership (server-side, trusted)
    await CommunityMember.create({
      user: req.user._id,
      community: community._id,
      role: COMMUNITY_MEMBER_ROLES.OWNER,
      status: 'active',
      canPost: true,
    });

    await community.populate('owner', 'name email avatar department');

    res.status(201).json({
      success: true,
      message: 'Community created successfully.',
      data: community,
    });
  } catch (error) {
    // Handle mongoose duplicate key errors as conflicts
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A community with this name or slug already exists.',
        error: { code: ERROR_CODES.CONFLICT, message: 'Duplicate community name or slug.' },
      });
    }
    next(error);
  }
};

export const getCommunities = async (req, res, next) => {
  try {
    const { category, search, sort = 'members' } = req.query;

    const query = {};
    const conditions = [];

    if (category && category !== 'All' && category !== 'undefined' && category !== 'null') {
      conditions.push({
        $or: [{ category }, { type: category.toLowerCase() }],
      });
    }

    if (search != null && search !== '' && search !== 'undefined' && search !== 'null') {
      if (typeof search !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Search query must be a string.',
          error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Search query must be a string.' },
        });
      }

      const searchTerm = search.trim();
      if (searchTerm.length > MAX_SEARCH_LENGTH) {
        return res.status(400).json({
          success: false,
          message: `Search query must not exceed ${MAX_SEARCH_LENGTH} characters.`,
          error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Search query is too long.' },
        });
      }
      if (searchTerm) {
        const regex = new RegExp(escapeRegex(searchTerm), 'i');
        conditions.push({
          $or: [
            { name: regex },
            { description: regex },
            { slug: regex },
          ],
        });
      }
    }

    if (conditions.length === 1) {
      Object.assign(query, conditions[0]);
    } else if (conditions.length > 1) {
      query.$and = conditions;
    }

    let sortOption = { memberCount: -1 };
    if (sort === 'activity') {
      sortOption = { postCount: -1, memberCount: -1 };
    } else if (sort === 'newest') {
      sortOption = { createdAt: -1 };
    }

   const communities = await Community.find({
  ...query,
  'permissions.visibility': { $ne: VISIBILITY.MEMBERS_ONLY },
})
  .populate('owner', 'name avatar department')
  .populate('moderators', 'name avatar')
  .sort(sortOption);

    // Obey privacy and enrich with membership if user is authenticated
    const enriched = await Promise.all(
      communities.map(async (comm) => {
        let isMember = false;
        let userRole = null;
        let membershipStatus = null;
        if (req.user) {
          const mem = await CommunityMember.findOne({
            user: req.user._id,
            community: comm._id,
          });
          if (mem) {
            membershipStatus = mem.status;
            if (mem.status === 'active') {
              isMember = true;
              userRole = ['owner', 'moderator', 'member'].includes(mem.role) ? mem.role : 'member';
            }
          }
        }

        return {
          ...comm.toObject(),
          isCurrentUserMember: isMember,
          currentUserRole: userRole,
          currentUserMembershipStatus: membershipStatus,
        };
      })
    );

    res.json({
      success: true,
      count: enriched.length,
      categories: ['All', ...COMMUNITY_CATEGORIES],
      data: enriched,
    });
  } catch (error) {
    next(error);
  }
};

export const getCommunityById = async (req, res, next) => {
  try {
    const { id } = req.params;
    let query = id.match(/^[0-9a-fA-F]{24}$/) ? { _id: id } : { slug: id.toLowerCase() };

      const community = await Community.findOne(query)
      .populate('owner', 'name avatar department year role')
      .populate('moderators', 'name avatar department role');

        if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found.',
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Community not found.' },
      });
    }

    if (community.permissions?.visibility === VISIBILITY.MEMBERS_ONLY) {
      const hasAccess = await permissionService.canAccessAttachment(
        req.user,
        null,
        null,
        community
      );

      if (!hasAccess) {
        return res.status(404).json({
          success: false,
          message: 'Community not found.',
          error: { code: ERROR_CODES.NOT_FOUND, message: 'Community not found.' },
        });
      }
    }

    // Determine current user's membership and posting permissions
    let userMembership = null;
    let userPermission = { allowed: false, canRequest: true, reason: 'Log in to interact' };

    if (req.user) {
      userMembership = await CommunityMember.findOne({
        user: req.user._id,
        community: community._id,
      });

      userPermission = await permissionService.canCreatePost(req.user, community);
    }

    // Calculate authoritative counts
    const postCount = await Post.countDocuments({
      community: community._id,
      status: 'published',
    });
    const memberCount = await CommunityMember.countDocuments({
      community: community._id,
      status: 'active',
    });

    // Check if user is community mod or head
    const isModOrHead = req.user ? await permissionService.canModerate(req.user, community) : false;

    // Who may review membership/join requests for this exact community (backend-authoritative)
    const canManageJoinRequests = req.user
      ? await permissionService.canReviewJoinRequests(req.user, community)
      : false;

    // Granular delegated-permission flags for this exact community so the UI only
    // renders moderation actions the server would accept (rules §8).
    const moderationPermissions = req.user
      ? await permissionService.getModerationPermissions(req.user, community)
      : {
          canModerate: false,
          pin: false,
          lock: false,
          delete: false,
          manageRequests: false,
          markAccepted: false,
          manageRules: false,
        };

    res.json({
      success: true,
      data: {
        ...community.toObject(),
        postCount,
        memberCount,
        currentUserMembership: userMembership,
        currentUserPermission: userPermission,
        canModerate: isModOrHead,
        canManageJoinRequests,
        moderationPermissions,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Update Community Settings (Community Head / Owner OR Platform Admin only) (Point 8)
export const updateCommunitySettings = async (req, res, next) => {
  try {
    const { id } = req.params;
    const community = await Community.findById(id);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found.',
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Community not found.' },
      });
    }

    // Authoritative check: must be community owner or platform admin
    const isOwner = community.owner.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only the Community Head or Platform Admin can update community settings.',
        error: { code: ERROR_CODES.FORBIDDEN, message: 'Insufficient privileges.' },
      });
    }

    const {
      name,
      description,
      permissions,
      rules,
      banner,
      avatar,
      category,
      maxPinnedPosts,
    } = req.body;

    const auditChanges = {};

    // Allow managing community-controlled fields (Point 8)
    if (name && name.trim() !== community.name) {
      auditChanges.name = { from: community.name, to: name.trim() };
      community.name = name.trim();
    }
    if (description !== undefined && description !== community.description) {
      auditChanges.description = { from: community.description, to: description };
      community.description = description;
    }
    if (banner !== undefined) community.banner = banner;
    if (avatar !== undefined) community.avatar = avatar;
    if (category && category !== community.category) {
      auditChanges.category = { from: community.category, to: category };
      community.category = category;
    }
    if (maxPinnedPosts !== undefined) {
      community.maxPinnedPosts = Math.max(1, Math.min(10, Number(maxPinnedPosts)));
    }
    if (rules !== undefined) {
      auditChanges.rulesUpdated = true;
      community.rules = rules;
    }

    if (permissions) {
      auditChanges.permissions = { from: community.permissions, to: permissions };
      community.permissions = {
        ...community.permissions.toObject(),
        ...permissions,
      };
    }

    await community.save();

    // Sensitive settings change writes an AuditLog (Point 8, 25)
    await AuditLog.create({
      actor: req.user._id,
      action: AUDIT_ACTIONS.UPDATE_SETTINGS,
      targetType: 'community',
      targetId: community._id.toString(),
      community: community._id,
      details: auditChanges,
      ip: req.ip || '',
    });

    res.json({
      success: true,
      message: 'Community settings updated successfully.',
      data: community,
    });
  } catch (error) {
    next(error);
  }
};

// Notify the Community Head and moderators delegated `manage_requests` for this exact community
const notifyJoinRequestSubmitted = async (community, requester) => {
  const delegatedModerators = await CommunityMember.find({
    community: community._id,
    status: 'active',
    role: COMMUNITY_MEMBER_ROLES.MODERATOR,
    delegatedPermissions: DELEGATED_PERMISSIONS.MANAGE_REQUESTS,
  }).select('user');

  const reviewerIds = [
    community.owner.toString(),
    ...delegatedModerators.map((m) => m.user.toString()),
  ];

  await Promise.all(
    [...new Set(reviewerIds)].map((reviewerId) =>
      notificationService.notify({
        userId: reviewerId,
        actorId: requester._id,
        type: 'join_request',
        message: `${requester.name} requested to join "${community.name}".`,
        target: { modelType: 'Community', id: community._id.toString(), title: community.name },
      })
    )
  );
};

// Idempotent Join Community (Point 11, 12)
export const joinCommunity = async (req, res, next) => {
  try {
    const { id } = req.params;
    // A non-ObjectId param (e.g. a stray "[object Object]" sent by a client)
    // must not reach mongoose casting: it is simply not found.
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(404).json({
        success: false,
        message: 'Community not found.',
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Community not found.' },
      });
    }
    const community = await Community.findById(id);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found.',
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Community not found.' },
      });
    }

    const isPrivate = community.permissions?.visibility === VISIBILITY.MEMBERS_ONLY;

    // Check if membership already exists (Idempotent Join)
    let member = await CommunityMember.findOne({
      user: req.user._id,
      community: community._id,
    });

    if (member && member.status === 'banned') {
      return res.status(403).json({
        success: false,
        message: 'You are banned from this community.',
        error: { code: ERROR_CODES.FORBIDDEN, message: 'Banned from community.' },
      });
    }

    if (member && member.status === 'active') {
      return res.json({
        success: true,
        joined: true,
        pending: false,
        message: 'You are already a member of this community.',
        data: member,
      });
    }

    // PRIVATE / MEMBERS_ONLY: joining creates a PENDING join request.
    // The user must never become active without Head/authorized-moderator approval
    // (rules §4, §13, §37.7).
    if (isPrivate) {
      if (member && member.status === 'pending') {
        return res.status(409).json({
          success: false,
          joined: false,
          pending: true,
          message: 'Your join request is already pending moderator approval.',
          error: { code: ERROR_CODES.CONFLICT, message: 'Join request already pending.' },
          data: member,
        });
      }

      if (member) {
        // Allow a fresh request after a previous rejection
        member.status = 'pending';
        member.role = COMMUNITY_MEMBER_ROLES.MEMBER;
        member.canPost = true;
        member.approvedBy = null;
        await member.save();
      } else {
        member = await CommunityMember.create({
          user: req.user._id,
          community: community._id,
          role: COMMUNITY_MEMBER_ROLES.MEMBER,
          status: 'pending',
          canPost: true,
        });
      }

      await notifyJoinRequestSubmitted(community, req.user);

      // Only active members are counted; a pending request does not change the count
      const pendingMemberCount = await CommunityMember.countDocuments({
        community: community._id,
        status: 'active',
      });

      return res.status(201).json({
        success: true,
        joined: false,
        pending: true,
        message: `Your request to join "${community.name}" has been sent to the Community Head and authorized moderators for approval.`,
        data: member,
        memberCount: pendingMemberCount,
      });
    }

    // PUBLIC: direct join, becomes ACTIVE immediately (existing behaviour preserved)
    if (member) {
      member.status = 'active';
      await member.save();
    } else {
      member = await CommunityMember.create({
        user: req.user._id,
        community: community._id,
        role: COMMUNITY_MEMBER_ROLES.MEMBER,
        status: 'active',
        canPost: true,
      });
    }

    // Derive authoritative count
    const memberCount = await CommunityMember.countDocuments({
      community: community._id,
      status: 'active',
    });
    community.memberCount = memberCount;
    await community.save();

    res.json({
      success: true,
      joined: true,
      pending: false,
      message: `Joined "${community.name}" successfully!`,
      data: member,
      memberCount,
    });
  } catch (error) {
    next(error);
  }
};

// Join Requests queue for a PRIVATE community (Head / Admin / delegated moderator only)
export const getJoinRequests = async (req, res, next) => {
  try {
    const { id } = req.params;
    const query = id.match(/^[0-9a-fA-F]{24}$/) ? { _id: id } : { slug: id.toLowerCase() };
    const community = await Community.findOne(query);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found.',
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Community not found.' },
      });
    }

    const canReview = await permissionService.canReviewJoinRequests(req.user, community);
    if (!canReview) {
      return res.status(403).json({
        success: false,
        message: 'Only the Community Head or an authorized moderator of this community can review join requests.',
        error: { code: ERROR_CODES.FORBIDDEN, message: 'Insufficient privileges.' },
      });
    }

    const requests = await CommunityMember.find({ community: community._id, status: 'pending' })
      .populate('user', 'name email avatar department year role verified')
      .sort({ createdAt: 1 });

    res.json({ success: true, count: requests.length, data: requests });
  } catch (error) {
    next(error);
  }
};

// Approve / Reject a join request (Head / Admin / delegated moderator only)
export const reviewJoinRequest = async (req, res, next) => {
  try {
    const { id, userId } = req.params;
    const { status } = req.body;

    if (!['active', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be "active" (approve) or "rejected" (reject).',
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Invalid status.' },
      });
    }

    const query = id.match(/^[0-9a-fA-F]{24}$/) ? { _id: id } : { slug: id.toLowerCase() };
    const community = await Community.findOne(query);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found.',
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Community not found.' },
      });
    }

    const canReview = await permissionService.canReviewJoinRequests(req.user, community);
    if (!canReview) {
      return res.status(403).json({
        success: false,
        message: 'Only the Community Head or an authorized moderator of this community can review join requests.',
        error: { code: ERROR_CODES.FORBIDDEN, message: 'Insufficient privileges.' },
      });
    }

    const membership = await CommunityMember.findOne({ user: userId, community: community._id });

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: 'Join request not found for this user.',
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Join request not found.' },
      });
    }

    if (membership.status === 'active') {
      return res.status(409).json({
        success: false,
        message: 'This user is already an active member of this community.',
        error: { code: ERROR_CODES.CONFLICT, message: 'Already a member.' },
      });
    }

    if (membership.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'There is no pending join request for this user.',
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'No pending join request.' },
      });
    }

    // Reviewers cannot approve their own request unless they are the Head or Platform Admin
    const isRequester = membership.user.toString() === req.user._id.toString();
    const isOwner = community.owner.toString() === req.user._id.toString();
    if (isRequester && !isOwner && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You cannot review your own join request.',
        error: { code: ERROR_CODES.FORBIDDEN, message: 'Self-review disallowed.' },
      });
    }

    membership.status = status === 'active' ? 'active' : 'rejected';
    membership.approvedBy = status === 'active' ? req.user._id : null;
    await membership.save();

    // Derive authoritative member count (pending/rejected users are never counted)
    const memberCount = await CommunityMember.countDocuments({
      community: community._id,
      status: 'active',
    });
    community.memberCount = memberCount;
    await community.save();

    await AuditLog.create({
      actor: req.user._id,
      action: status === 'active' ? AUDIT_ACTIONS.APPROVE_JOIN_REQUEST : AUDIT_ACTIONS.REJECT_JOIN_REQUEST,
      targetType: 'join_request',
      targetId: membership._id.toString(),
      community: community._id,
      details: { requesterId: membership.user, status: membership.status },
      ip: req.ip || '',
    });

    await notificationService.notify({
      userId: membership.user,
      actorId: req.user._id,
      type: status === 'active' ? 'request_approved' : 'request_rejected',
      message:
        status === 'active'
          ? `Your request to join "${community.name}" was approved. You now have member access.`
          : `Your request to join "${community.name}" was rejected.`,
      target: { modelType: 'Community', id: community._id.toString(), title: community.name },
    });

    res.json({
      success: true,
      message: `Join request ${status === 'active' ? 'approved' : 'rejected'}.`,
      data: membership,
      memberCount,
    });
  } catch (error) {
    next(error);
  }
};

// Idempotent Leave Community (Point 1, 12)
export const leaveCommunity = async (req, res, next) => {
  try {
    const { id } = req.params;
    // See joinCommunity: never let a non-ObjectId param reach mongoose casting.
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(404).json({
        success: false,
        message: 'Community not found.',
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Community not found.' },
      });
    }
    const community = await Community.findById(id);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found.',
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Community not found.' },
      });
    }

    // Owner cannot leave without transferring ownership (Point 28)
    if (community.owner.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'As the Community Head, you must transfer ownership to another member before leaving.',
        error: { code: ERROR_CODES.CONFLICT, message: 'Cannot leave owned community.' },
      });
    }

    const member = await CommunityMember.findOne({
      user: req.user._id,
      community: community._id,
    });

    if (member) {
      await CommunityMember.deleteOne({ _id: member._id });
    }

    // Leaving community A does NOT affect user roles in any other community (Point 1)
    const memberCount = await CommunityMember.countDocuments({
      community: community._id,
      status: 'active',
    });
    community.memberCount = memberCount;
    await community.save();

    res.json({
      success: true,
      joined: false,
      message: `You left "${community.name}".`,
      memberCount,
    });
  } catch (error) {
    next(error);
  }
};

export const getCommunityMembers = async (req, res, next) => {
  try {
    const { id } = req.params;
    const query = id.match(/^[0-9a-fA-F]{24}$/) ? { _id: id } : { slug: id.toLowerCase() };
    const community = await Community.findOne(query);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found.',
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Community not found.' },
      });
    }

    const isMod = await permissionService.canModerate(req.user, community);

    // Private community member lists stay inside the community (rules §4, §37.6)
    if (community.permissions?.visibility === VISIBILITY.MEMBERS_ONLY && !isMod) {
      const membership = await CommunityMember.findOne({
        user: req.user._id,
        community: community._id,
        status: 'active',
      });

      if (!membership) {
        return res.status(403).json({
          success: false,
          message: 'This community is members-only. Join the community to view its members.',
          error: { code: ERROR_CODES.FORBIDDEN, message: 'Members-only community' },
        });
      }
    }

    // Personal data (email) is only exposed to Head/Moderators/Platform Admin
    const memberFields = isMod
      ? 'name email avatar department year role verified'
      : 'name avatar department year role';

    const members = await CommunityMember.find({ community: community._id, status: 'active' })
      .populate('user', memberFields)
      .sort({ role: 1 });

    res.json({ success: true, count: members.length, data: members });
  } catch (error) {
    next(error);
  }
};

// Get Community Audit Logs — scoped to the audit trail, not moderation actions.
// Audit visibility does not grant any moderation capability: pass with Head,
// Platform Admin, or any active moderator identity of THIS exact community
// (rules §3 moderator scope, §19 audit). All moderation actions still check
// their own exact delegation.
export const getCommunityAuditLogs = async (req, res, next) => {
  try {
    const { id } = req.params;
    const community = await Community.findById(id);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found.',
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Community not found.' },
      });
    }

    const isMod = await permissionService.canModerate(req.user, community);
    if (!isMod) {
      return res.status(403).json({
        success: false,
        message: 'Only community moderators or heads can view audit logs.',
        error: { code: ERROR_CODES.FORBIDDEN, message: 'Forbidden' },
      });
    }

    const logs = await AuditLog.find({ community: community._id })
      .populate('actor', 'name email avatar role')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ success: true, count: logs.length, data: logs });
  } catch (error) {
    next(error);
  }
};
