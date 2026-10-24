import fs from 'fs';
import path from 'path';
import { Post } from '../models/Post.js';
import { Community } from '../models/Community.js';
import { CommunityMember } from '../models/CommunityMember.js';
import { Attachment } from '../models/Attachment.js';
import { Folder } from '../models/Folder.js';
import { Poll } from '../models/Poll.js';
import { PollVote } from '../models/PollVote.js';
import { Comment } from '../models/Comment.js';
import { Block } from '../models/Block.js';
import { Mute } from '../models/Mute.js';
import { AuditLog } from '../models/AuditLog.js';
import { permissionService } from '../services/permissionService.js';
import { notificationService } from '../services/notificationService.js';
import { isValidSafeUrl } from '../utils/linkSafety.js';
import { UPLOAD_DIR } from '../config/env.js';
import {
  CONTENT_STATUS,
  POST_TYPES,
  AUDIT_ACTIONS,
  ERROR_CODES,
  VISIBILITY,
  DELEGATED_PERMISSIONS,
  SHARE_POLICY,
} from '../constants/index.js';

export const getPosts = async (req, res, next) => {
  try {
    const {
      community,
      type,
      sort = 'latest',
      search,
      tag,
      author,
      page = 1,
      limit = 20,
    } = req.query;

    const query = {};

    // Community filter
    let targetCommunity = null;
    if (community) {
      if (community.match(/^[0-9a-fA-F]{24}$/)) {
        targetCommunity = await Community.findById(community);
      } else {
        targetCommunity = await Community.findOne({ slug: community.toLowerCase() });
      }
      if (targetCommunity) {
        // Enforce MEMBERS_ONLY visibility check
        if (targetCommunity.permissions?.visibility === VISIBILITY.MEMBERS_ONLY) {
          const hasAccess = await permissionService.canAccessAttachment(req.user, null, null, targetCommunity);
          if (!hasAccess) {
            return res.status(403).json({
              success: false,
              message: 'This community is members-only. Join the community to view its discussions.',
              error: { code: ERROR_CODES.FORBIDDEN, message: 'Members-only community' },
            });
          }
        }
        query.community = targetCommunity._id;
      }
    } else {
      // Global feed / Trending / Explore: isolate private community posts from non-members
      const privateCommunities = await Community.find({
        'permissions.visibility': VISIBILITY.MEMBERS_ONLY,
      }).select('_id');

      const privateCommIds = privateCommunities.map((c) => c._id);
      if (privateCommIds.length > 0) {
        let allowedPrivateCommIds = [];
        if (req.user) {
          if (req.user.role === 'admin') {
            allowedPrivateCommIds = privateCommIds;
          } else {
            const userMemberships = await CommunityMember.find({
              user: req.user._id,
              community: { $in: privateCommIds },
              status: 'active',
            }).select('community');
            allowedPrivateCommIds = userMemberships.map((m) => m.community.toString());
          }
        }

        const excludedPrivateCommIds = privateCommIds.filter(
          (id) => !allowedPrivateCommIds.some((allowedId) => allowedId.toString() === id.toString())
        );

        if (excludedPrivateCommIds.length > 0) {
          query.community = { $nin: excludedPrivateCommIds };
        }
      }
    }

    // Author query & self-author permissions & moderation status filtering
    const isSelfAuthor = req.user && author && req.user._id.toString() === author.toString();
    // Review queues (pending/rejected of OTHER authors) are only visible to holders of
    // the `manage_requests` delegation for this exact community (rules ??10).
    const canReviewQueue =
      targetCommunity &&
      req.user &&
      (await permissionService.hasDelegatedPermission(
        req.user,
        targetCommunity,
        DELEGATED_PERMISSIONS.MANAGE_REQUESTS
      ));

    if (req.query.status) {
      if (canReviewQueue) {
        query.status = req.query.status;
      } else if (isSelfAuthor) {
        // Authors may query their OWN posts only ??? never another author's
        // pending/rejected queue (rules ??10). Force author scoping so a denied
        // viewer cannot enumerate other authors' pending content.
        query.status = req.query.status;
        query.author = req.user._id;
      } else {
        query.status = { $in: [CONTENT_STATUS.PUBLISHED, CONTENT_STATUS.LOCKED, 'edited'] };
      }
    } else if (isSelfAuthor) {
      query.status = { $nin: [CONTENT_STATUS.DELETED, CONTENT_STATUS.REMOVED, 'archived'] };
    } else {
      query.status = { $in: [CONTENT_STATUS.PUBLISHED, CONTENT_STATUS.LOCKED, 'edited'] };
    }

    if (type && type !== 'undefined' && type !== 'null') query.type = type;
    if (tag && tag !== 'undefined' && tag !== 'null') query.tags = tag;
    if (author && author !== 'undefined' && author !== 'null') query.author = author;

    // Filter out posts from blocked or muting users if user is authenticated (Point 18)
    if (req.user) {
      const blocks = await Block.find({
        $or: [{ blocker: req.user._id }, { blocked: req.user._id }],
      });
      const blockedUserIds = blocks.map((b) =>
        b.blocker.toString() === req.user._id.toString() ? b.blocked.toString() : b.blocker.toString()
      );

      const mutes = await Mute.find({ muter: req.user._id });
      const mutedUserIds = mutes.map((m) => m.muted.toString());

      const excludedUserIds = [...new Set([...blockedUserIds, ...mutedUserIds])];
      if (excludedUserIds.length > 0) {
        if (query.author) {
          if (excludedUserIds.includes(query.author.toString())) {
            query.author = { $in: [] };
          }
        } else {
          query.author = { $nin: excludedUserIds };
        }
      }
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { body: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
      ];
    }

    // Sorting rule (Point 7 & Point 10)
    // Community feeds always prioritize pinned posts
    let sortOption = { isPinned: -1, createdAt: -1 };

    if (sort === 'helpful') {
      sortOption = { isPinned: -1, helpfulCount: -1, createdAt: -1 };
    }

    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

    let posts = await Post.find(query)
      .populate('author', 'name email avatar department year role verified')
      .populate('community', 'name slug avatar type permissions')
      .sort(sortOption)
      .skip(skip)
      .limit(Number(limit))
      .lean();

    // Deterministic Trending Ranking Baseline (Point 10)
    if (sort === 'trending' || sort === 'popular') {
      const now = Date.now();
      posts.sort((a, b) => {
        // Keep pinned on top
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;

        const hoursA = (now - new Date(a.createdAt).getTime()) / (1000 * 60 * 60);
        const hoursB = (now - new Date(b.createdAt).getTime()) / (1000 * 60 * 60);

        const scoreA =
          ((a.likes?.length || 0) * 2 +
            (a.helpfulVotes?.length || 0) * 3 +
            (a.commentsCount || 0) * 2 +
            (a.viewsCount || 0) * 0.1) /
          Math.pow(hoursA + 2, 1.5);

        const scoreB =
          ((b.likes?.length || 0) * 2 +
            (b.helpfulVotes?.length || 0) * 3 +
            (b.commentsCount || 0) * 2 +
            (b.viewsCount || 0) * 0.1) /
          Math.pow(hoursB + 2, 1.5);

        return scoreB - scoreA;
      });
    }

    const total = await Post.countDocuments(query);

    // Populate attachments, polls, folders, and current user's interaction state
    const populatedPosts = await Promise.all(
      posts.map(async (post) => {
        const attachments = await Attachment.find({ post: post._id });
        const folders = await Folder.find({ post: post._id });
        const poll = await Poll.findOne({ post: post._id });

        let userVotedPoll = null;
        if (poll && req.user) {
          const vote = await PollVote.findOne({ poll: poll._id, user: req.user._id });
          if (vote) userVotedPoll = vote.option;
        }

        const isLiked = req.user
          ? (post.likes || []).some((id) => id.toString() === req.user._id.toString())
          : false;
        const isSaved = req.user
          ? (post.saves || []).some((id) => id.toString() === req.user._id.toString())
          : false;
        const isHelpful = req.user
          ? (post.helpfulVotes || []).some((id) => id.toString() === req.user._id.toString())
          : false;

        return {
          ...post,
          likesCount: (post.likes || []).length,
          savesCount: (post.saves || []).length,
          helpfulCount: (post.helpfulVotes || []).length,
          isLiked,
          isSaved,
          isHelpful,
          attachments,
          folders,
          poll: poll ? { ...poll.toObject(), userVotedOption: userVotedPoll } : null,
        };
      })
    );

    res.json({
      success: true,
      data: populatedPosts,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getPostById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const post = await Post.findById(id)
      .populate('author', 'name email avatar department year role verified bio')
      .populate('community', 'name slug avatar type permissions owner moderators');

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found.',
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Post not found.' },
      });
    }

    const isAuthor = req.user && post.author?._id.toString() === req.user._id.toString();
    const isModOrAdmin = req.user && (await permissionService.canModerate(req.user, post.community));
    // Reviewers of pending/rejected content must hold the `manage_requests` delegation
    const canReviewQueue =
      req.user &&
      (await permissionService.hasDelegatedPermission(
        req.user,
        post.community,
        DELEGATED_PERMISSIONS.MANAGE_REQUESTS
      ));
    // Granular flags so the UI renders only actions this user may actually perform
    const moderationPermissions = await permissionService.getModerationPermissions(
      req.user,
      post.community
    );

    // Handle Deleted/Removed Safe Tombstone (Point 4)
    if ([CONTENT_STATUS.DELETED, CONTENT_STATUS.REMOVED].includes(post.status)) {
      if (!isAuthor && !isModOrAdmin) {
        return res.json({
          success: true,
          data: {
            _id: post._id,
            title: '[Discussion Removed]',
            body: '[This content was deleted or removed by community moderation.]',
            status: post.status,
            isDeleted: true,
            createdAt: post.createdAt,
            community: {
              _id: post.community?._id,
              name: post.community?.name,
              slug: post.community?.slug,
            },
            attachments: [],
            folders: [],
            poll: null,
            canComment: false,
            canCommentReason: 'Discussion is removed.',
          },
        });
      }
    }

    // Handle Pending/Rejected Content Authorization (Point 5, rules ??10):
    // visible ONLY to author and holders of the `manage_requests` delegation
    // for this exact community (Head/Platform Admin always; a moderator
    // WITHOUT that delegation ??? even with other delegations ??? is denied).
    if ([CONTENT_STATUS.PENDING, CONTENT_STATUS.REJECTED].includes(post.status)) {
      if (!isAuthor && !canReviewQueue) {
        return res.status(403).json({
          success: false,
          message: 'This post is pending moderator approval.',
          error: { code: ERROR_CODES.FORBIDDEN, message: 'Post is pending approval.' },
        });
      }
    }

    // Check Members-only Community Visibility
    if (post.community?.permissions?.visibility === VISIBILITY.MEMBERS_ONLY) {
      const hasAccess = await permissionService.canAccessAttachment(req.user, null, post, post.community);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'This discussion is in a private community. You must be a member to view it.',
          error: { code: ERROR_CODES.FORBIDDEN, message: 'Members-only discussion' },
        });
      }
    }

    // Increment views atomically
    await Post.updateOne({ _id: post._id }, { $inc: { viewsCount: 1 } });
    post.viewsCount = (post.viewsCount || 0) + 1;

    const attachments = await Attachment.find({ post: post._id }).populate('folder');
    const folders = await Folder.find({ post: post._id });
    const poll = await Poll.findOne({ post: post._id });

    let userVotedPoll = null;
    if (poll && req.user) {
      const vote = await PollVote.findOne({ poll: poll._id, user: req.user._id });
      if (vote) userVotedPoll = vote.option;
    }

    const isLiked = req.user
      ? (post.likes || []).some((uid) => uid.toString() === req.user._id.toString())
      : false;
    const isSaved = req.user
      ? (post.saves || []).some((uid) => uid.toString() === req.user._id.toString())
      : false;
    const isHelpful = req.user
      ? (post.helpfulVotes || []).some((uid) => uid.toString() === req.user._id.toString())
      : false;

    // Check if user can comment
    const commentPermission = await permissionService.canComment(req.user, post.community, post);

    res.json({
      success: true,
      data: {
        ...post.toObject(),
        likesCount: (post.likes || []).length,
        savesCount: (post.saves || []).length,
        helpfulCount: (post.helpfulVotes || []).length,
        isLiked,
        isSaved,
        isHelpful,
        attachments,
        folders,
        poll: poll ? { ...poll.toObject(), userVotedOption: userVotedPoll } : null,
        canComment: commentPermission.allowed,
        canCommentReason: commentPermission.reason,
        canModerate: isModOrAdmin,
        moderationPermissions,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * SHARE a post (repost to another community or global/campus-wide audience).
 * Route: POST /api/posts/:id/share
 * Body: { targetCommunityId? }
 */
export const sharePost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { targetCommunityId } = req.body ?? {};

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Post id is required.',
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Post id required.' },
      });
    }

    const post = await Post.findById(id).populate('community', 'permissions _id');
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found.',
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Post not found.' },
      });
    }

    const sourceCommunity = post.community;
    if (!sourceCommunity) {
      return res.status(400).json({
        success: false,
        message: 'This post is not attached to a community.',
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Post has no community.' },
      });
    }

    // Security: private (members-only) posts must never be shareable.
    const isSourcePrivate =
      sourceCommunity.permissions?.visibility === VISIBILITY.MEMBERS_ONLY;
    if (isSourcePrivate) {
      return res.status(403).json({
        success: false,
        message: 'This discussion is private and cannot be shared.',
        error: { code: ERROR_CODES.FORBIDDEN, message: 'Private post cannot be shared.' },
      });
    }

    // 1. Authorization: source community sharePolicy (backend-authoritative).
    const canSourceShare = await permissionService.canShare(req.user, sourceCommunity, post);
    if (!canSourceShare) {
      const sharePolicy = sourceCommunity.permissions?.sharePolicy || 'EVERYONE';
      if (sharePolicy === SHARE_POLICY.DISABLED) {
        return res.status(403).json({
          success: false,
          message: 'Sharing is disabled in this community.',
          error: { code: ERROR_CODES.FORBIDDEN, message: 'Sharing disabled.' },
        });
      }
      // MEMBERS: caller must be an active member of the SOURCE community.
      const isMember = await CommunityMember.findOne({
        user: req.user._id,
        community: sourceCommunity._id,
        status: 'active',
      });
      if (!isMember) {
        return res.status(403).json({
          success: false,
          message: 'You must be a member of this community to share.',
          error: { code: ERROR_CODES.FORBIDDEN, message: 'Not a member; sharing restricted.' },
        });
      }
    }

    // 2. Choose the target community.
    let targetCommunity;
    if (targetCommunityId) {
      targetCommunity = await Community.findById(targetCommunityId);
      if (!targetCommunity) {
        return res.status(404).json({
          success: false,
          message: 'Target community not found.',
          error: { code: ERROR_CODES.NOT_FOUND, message: 'Target community not found.' },
        });
      }
    } else {
      // Global/campus-wide share: target = null (no community binding).
      targetCommunity = null;
    }

    // 3. Cross-community / target authorization.
    if (targetCommunity) {
      if (targetCommunity._id.toString() === sourceCommunity._id.toString()) {
        return res.status(400).json({
          success: false,
          message: 'Target community must be different from the source community.',
          error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Same community.' },
        });
      }
      if (targetCommunity.permissions?.visibility === VISIBILITY.MEMBERS_ONLY) {
        return res.status(403).json({
          success: false,
          message: 'Sharing into private communities is not allowed.',
          error: { code: ERROR_CODES.FORBIDDEN, message: 'Private target not shareable.' },
        });
      }
      if (targetCommunity.permissions?.sharePolicy === SHARE_POLICY.DISABLED) {
        return res.status(403).json({
          success: false,
          message: 'Sharing into this community is disabled.',
          error: { code: ERROR_CODES.FORBIDDEN, message: 'Target sharing disabled.' },
        });
      }
      if (targetCommunity.permissions?.sharePolicy === SHARE_POLICY.MEMBERS) {
        const isMember = await CommunityMember.findOne({
          user: req.user._id,
          community: targetCommunity._id,
          status: 'active',
        });
        if (!isMember) {
          return res.status(403).json({
            success: false,
            message: 'You must be a member of the target community to share there.',
            error: { code: ERROR_CODES.FORBIDDEN, message: 'Not a member of target community.' },
          });
        }
      }
    }
  } catch (error) {
    next(error);
  }
};

export const createPost = async (req, res, next) => {
  try {
    const {
      community: communityId,
      type = 'discussion',
      title,
      body,
      tags = [],
      isAnonymous = false,
      allowComments = true,
      isQuestion = false,
      attachments = [],
      folderPaths = [],
      poll = null,
      linkPreview = null,
    } = req.body;

    if (!title || !title.trim() || !body || !body.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Post title and content body are required.',
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Title and body required.' },
      });
    }

    let community = null;
    let postStatus = CONTENT_STATUS.PUBLISHED;

    // Audience resolution (rules ??37.1): community = null is Global / Campus-Wide
    // and is handled explicitly - it needs no community membership. Any other
    // value must be a real community id or slug; anything else (an object, a
    // number, "[object Object]") is rejected instead of being cast to an ObjectId.
    const GLOBAL_SENTINELS = ['global', 'campus-wide', 'null', 'undefined'];
    const isHexId = (value) => typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);
    const isGlobalValue =
      communityId === null ||
      communityId === undefined ||
      communityId === '' ||
      (typeof communityId === 'string' && GLOBAL_SENTINELS.includes(communityId.toLowerCase()));

    if (!isGlobalValue) {
      if (isHexId(communityId)) {
        community = await Community.findById(communityId);
      } else if (typeof communityId === 'string') {
        community = await Community.findOne({ slug: communityId.toLowerCase() });
      } else {
        // Fail closed: never send a non-id where an ObjectId/null is expected.
        return res.status(400).json({
          success: false,
          message:
            'Invalid community reference. Expected a community id, a community slug, or null for a campus-wide discussion.',
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Invalid community reference.',
          },
        });
      }

      if (!community) {
        // Fail closed so an unresolvable community can never silently publish
        // campus-wide content that was meant for that community.
        return res.status(404).json({
          success: false,
          message: 'Community not found.',
          error: { code: ERROR_CODES.NOT_FOUND, message: 'Community not found.' },
        });
      }

      const permission = await permissionService.canCreatePost(req.user, community);
      if (!permission.allowed) {
        return res.status(403).json({
          success: false,
          message: permission.reason || 'You do not have permission to post in this community.',
          canRequest: permission.canRequest,
          error: {
            code: ERROR_CODES.FORBIDDEN,
            message: permission.reason || 'You do not have permission to post in this community.',
            canRequest: permission.canRequest,
          },
        });
      }
      if (permission.requireApproval) {
        postStatus = CONTENT_STATUS.PENDING;
      }
    }

    // 3. Link Safety Validation
    let safeLinkPreview = null;
    if (linkPreview && linkPreview.url) {
      if (isValidSafeUrl(linkPreview.url)) {
        safeLinkPreview = {
          url: linkPreview.url,
          title: linkPreview.title || '',
          description: linkPreview.description || '',
          image: linkPreview.image && isValidSafeUrl(linkPreview.image) ? linkPreview.image : '',
          siteName: linkPreview.siteName || '',
        };
      }
    }

    // 4. Create the Post record
    const post = await Post.create({
      author: req.user._id,
      community: community ? community._id : null,
      type: Object.values(POST_TYPES).includes(type) ? type : POST_TYPES.DISCUSSION,
      title: title.trim(),
      body: body.trim(),
      tags: Array.isArray(tags) ? tags.map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean) : [],
      status: postStatus,
      isAnonymous: Boolean(isAnonymous),
      allowComments: allowComments !== undefined ? Boolean(allowComments) : true,
      isQuestion: Boolean(isQuestion),
      linkPreview: safeLinkPreview,
      likes: [],
      saves: [],
      helpfulVotes: [],
    });

    // 5. Create Folder records if supplied
    const folderPathMap = new Map();
    if (Array.isArray(folderPaths) && folderPaths.length > 0) {
      for (const relPath of folderPaths) {
        const parts = relPath.split('/').filter(Boolean);
        let cur = '';
        let parentId = null;
        for (const segment of parts) {
          cur = cur ? `${cur}/${segment}` : segment;
          if (!folderPathMap.has(cur)) {
            const folderDoc = await Folder.create({
              post: post._id,
              parentFolder: parentId,
              name: segment,
              relativePath: cur,
            });
            folderPathMap.set(cur, folderDoc._id);
            parentId = folderDoc._id;
          } else {
            parentId = folderPathMap.get(cur);
          }
        }
      }
    }

    // 6. Create Attachment records
    const createdAttachments = [];
    if (Array.isArray(attachments) && attachments.length > 0) {
      for (const att of attachments) {
        let folderId = null;
        if (att.folderRelativePath && folderPathMap.has(att.folderRelativePath)) {
          folderId = folderPathMap.get(att.folderRelativePath);
        }

        const attachmentDoc = await Attachment.create({
          post: post._id,
          folder: folderId,
          type: att.type || 'file',
          originalName: att.originalName || att.name || 'attachment',
          mimeType: att.mimeType || 'application/octet-stream',
          size: att.size || 0,
          storageKey: att.storageKey || att.url || '',
          url: att.url,
          relativePath: att.relativePath || att.originalName,
          metadata: att.metadata || {},
          status: 'ready',
        });
        createdAttachments.push(attachmentDoc);
      }
    }

    // 7. Create Poll if supplied
    let createdPoll = null;
    if (poll && poll.question && Array.isArray(poll.options) && poll.options.length >= 2) {
      createdPoll = await Poll.create({
        post: post._id,
        question: poll.question.trim(),
        options: poll.options.map((opt) => ({
          text: typeof opt === 'string' ? opt.trim() : opt.text.trim(),
          votesCount: 0,
        })),
        expiresAt: poll.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
    }

    // If published, increment community post count
    if (postStatus === CONTENT_STATUS.PUBLISHED && community) {
      await Community.updateOne({ _id: community._id }, { $inc: { postCount: 1 } });
    }

    // If pending approval, notify community owner and moderators (Point 5)
    if (postStatus === CONTENT_STATUS.PENDING && community) {
      await notificationService.notify({
        userId: community.owner,
        actorId: req.user._id,
        type: 'post_request',
        message: `${req.user.name} submitted a post awaiting your approval in "${community.name}".`,
        target: { modelType: 'Post', id: post._id.toString(), title: post.title },
      });
    }

    const populated = await Post.findById(post._id)
      .populate('author', 'name email avatar department year role verified')
      .populate('community', 'name slug avatar type permissions');

    const resultData = populated ? populated.toObject() : post.toObject();

    res.status(201).json({
      success: true,
      message: postStatus === CONTENT_STATUS.PENDING
        ? 'Post submitted for approval by community moderators.'
        : 'Post published successfully!',
      data: {
        ...resultData,
        likesCount: 0,
        savesCount: 0,
        helpfulCount: 0,
        isLiked: false,
        isSaved: false,
        isHelpful: false,
        attachments: createdAttachments,
        folders: Array.from(folderPathMap.values()),
        poll: createdPoll,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Review Pending Post (Point 5)
export const reviewPost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, reviewNote = '' } = req.body; // 'approve' | 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid review action. Must be 'approve' or 'reject'.",
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Invalid action.' },
      });
    }

    const post = await Post.findById(id).populate('community');
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found.',
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Post not found.' },
      });
    }

    // Check exact community review authority: requires `manage_requests` delegation
    // for moderators (Head/Platform Admin always authorized) (rules ??9, ??10).
    const canReview = await permissionService.hasDelegatedPermission(
      req.user,
      post.community,
      DELEGATED_PERMISSIONS.MANAGE_REQUESTS
    );
    if (!canReview) {
      return res.status(403).json({
        success: false,
        message: 'Only the Community Head or a moderator delegated to manage requests can review pending posts.',
        error: { code: ERROR_CODES.FORBIDDEN, message: 'Moderation privileges required.' },
      });
    }

    // Prevent moderator from approving their own content if not community owner (Point 5)
    const isOwner = post.community.owner.toString() === req.user._id.toString();
    const isAuthor = post.author.toString() === req.user._id.toString();
    if (isAuthor && !isOwner && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Moderators cannot approve their own submitted posts.',
        error: { code: ERROR_CODES.FORBIDDEN, message: 'Self-approval prohibited.' },
      });
    }

    if (action === 'approve') {
      post.status = CONTENT_STATUS.PUBLISHED;
      post.reviewedBy = req.user._id;
      post.reviewedAt = new Date();
      post.rejectionReason = '';
      await post.save();

      // Increment community postCount
      await Community.updateOne({ _id: post.community._id }, { $inc: { postCount: 1 } });

      // Notify author
      await notificationService.notify({
        userId: post.author,
        actorId: req.user._id,
        type: 'request_approved',
        message: `Your post "${post.title.substring(0, 35)}..." was approved and published in "${post.community.name}".`,
        target: { modelType: 'Post', id: post._id.toString(), title: post.title },
      });
    } else {
      post.status = CONTENT_STATUS.REJECTED;
      post.reviewedBy = req.user._id;
      post.reviewedAt = new Date();
      post.rejectionReason = reviewNote;
      await post.save();

      // Notify author
      await notificationService.notify({
        userId: post.author,
        actorId: req.user._id,
        type: 'request_rejected',
        message: `Your post "${post.title.substring(0, 35)}..." was rejected in "${post.community.name}". ${reviewNote ? `Reason: ${reviewNote}` : ''}`,
        target: { modelType: 'Post', id: post._id.toString(), title: post.title },
      });
    }

    // Audit log
    await AuditLog.create({
      actor: req.user._id,
      action: action === 'approve' ? AUDIT_ACTIONS.APPROVE_POST : AUDIT_ACTIONS.REJECT_POST,
      targetType: 'post',
      targetId: post._id.toString(),
      community: post.community._id,
      details: { reviewNote, newStatus: post.status },
      ip: req.ip || '',
    });

    res.json({
      success: true,
      message: `Post ${action === 'approve' ? 'approved and published' : 'rejected'}.`,
      data: post,
    });
  } catch (error) {
    next(error);
  }
};

// Resubmit Rejected Post (Point 5)
export const resubmitPost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, body, tags } = req.body;

    const post = await Post.findById(id).populate('community');
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found.',
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Post not found.' },
      });
    }

    if (post.status === CONTENT_STATUS.DELETED) {
      return res.status(400).json({
        success: false,
        message: 'Cannot resubmit a deleted post.',
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Post is deleted.' },
      });
    }

    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the author can resubmit this post.',
        error: { code: ERROR_CODES.FORBIDDEN, message: 'Unauthorized' },
      });
    }

    if (title) post.title = title.trim();
    if (body) {
      post.editHistory.push({ editedAt: new Date(), previousBody: post.body });
      post.body = body.trim();
    }
    if (tags && Array.isArray(tags)) post.tags = tags;

    post.status = CONTENT_STATUS.PENDING;
    post.rejectionReason = '';
    await post.save();

    // Notify community moderators
    await notificationService.notify({
      userId: post.community.owner,
      actorId: req.user._id,
      type: 'post_request',
      message: `${req.user.name} edited and resubmitted post "${post.title.substring(0, 35)}..." for approval.`,
      target: { modelType: 'Post', id: post._id.toString(), title: post.title },
    });

    res.json({
      success: true,
      message: 'Post updated and resubmitted for review.',
      data: post,
    });
  } catch (error) {
    next(error);
  }
};

// Pin / Unpin Post (Point 7)
export const togglePinPost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const post = await Post.findById(id).populate('community');
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found.',
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Post not found.' },
      });
    }

    if (post.status === CONTENT_STATUS.DELETED) {
      return res.status(400).json({
        success: false,
        message: 'Cannot pin a deleted post.',
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Post is deleted.' },
      });
    }

    const canPin = await permissionService.hasDelegatedPermission(
      req.user,
      post.community,
      DELEGATED_PERMISSIONS.PIN_POSTS
    );
    if (!canPin) {
      return res.status(403).json({
        success: false,
        message: 'Only the Community Head or a moderator delegated pin_posts permission can pin discussions.',
        error: { code: ERROR_CODES.FORBIDDEN, message: 'Moderation privileges required.' },
      });
    }

    if (!post.isPinned) {
      // Check maximum pinned posts limit (Point 7)
      const maxPinned = post.community.maxPinnedPosts || 3;
      const currentPinnedCount = await Post.countDocuments({
        community: post.community._id,
        isPinned: true,
        status: CONTENT_STATUS.PUBLISHED,
      });

      if (currentPinnedCount >= maxPinned) {
        return res.status(400).json({
          success: false,
          message: `Maximum limit of ${maxPinned} pinned posts reached for this community. Unpin a post first.`,
          error: { code: ERROR_CODES.CONFLICT, message: 'Maximum pinned posts reached.' },
        });
      }

      post.isPinned = true;
      post.pinnedAt = new Date();
      post.pinnedBy = req.user._id;
    } else {
      post.isPinned = false;
      post.pinnedAt = null;
      post.pinnedBy = null;
    }

    await post.save();

    // Audit Log
    await AuditLog.create({
      actor: req.user._id,
      action: post.isPinned ? AUDIT_ACTIONS.PIN_POST : AUDIT_ACTIONS.UNPIN_POST,
      targetType: 'post',
      targetId: post._id.toString(),
      community: post.community._id,
      details: { isPinned: post.isPinned },
      ip: req.ip || '',
    });

    res.json({
      success: true,
      message: post.isPinned ? 'Post pinned to top of community.' : 'Post unpinned.',
      isPinned: post.isPinned,
    });
  } catch (error) {
    next(error);
  }
};

// Lock / Unlock Comments (Point 4)
export const toggleLockPost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const post = await Post.findById(id).populate('community');
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found.',
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Post not found.' },
      });
    }

    if (post.status === CONTENT_STATUS.DELETED) {
      return res.status(400).json({
        success: false,
        message: 'Cannot lock a deleted post.',
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Post is deleted.' },
      });
    }

    const canLock = await permissionService.hasDelegatedPermission(
      req.user,
      post.community,
      DELEGATED_PERMISSIONS.LOCK_POSTS
    );
    if (!canLock) {
      return res.status(403).json({
        success: false,
        message: 'Only the Community Head or a moderator delegated lock_posts permission can lock discussions.',
        error: { code: ERROR_CODES.FORBIDDEN, message: 'Moderation privileges required.' },
      });
    }

    const willLock = post.status !== CONTENT_STATUS.LOCKED;
    post.status = willLock ? CONTENT_STATUS.LOCKED : CONTENT_STATUS.PUBLISHED;
    post.allowComments = !willLock;
    await post.save();

    await AuditLog.create({
      actor: req.user._id,
      action: willLock ? AUDIT_ACTIONS.LOCK_POST : AUDIT_ACTIONS.UNLOCK_POST,
      targetType: 'post',
      targetId: post._id.toString(),
      community: post.community._id,
      details: { status: post.status },
      ip: req.ip || '',
    });

    res.json({
      success: true,
      message: willLock ? 'Discussion locked. No new comments permitted.' : 'Discussion unlocked.',
      status: post.status,
    });
  } catch (error) {
    next(error);
  }
};

// Atomic Like / Unlike (Point 11, 12)
export const likePost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found.',
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Post not found.' },
      });
    }

    if (post.status === CONTENT_STATUS.DELETED) {
      return res.status(400).json({
        success: false,
        message: 'Cannot like a deleted post.',
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Post is deleted.' },
      });
    }

    const alreadyLiked = post.likes.some((uid) => uid.toString() === userId.toString());

    if (alreadyLiked) {
      await Post.updateOne({ _id: post._id }, { $pull: { likes: userId } });
    } else {
      await Post.updateOne({ _id: post._id }, { $addToSet: { likes: userId } });

      // Notify author if not self-liking
      if (post.author.toString() !== userId.toString()) {
        await notificationService.notify({
          userId: post.author,
          actorId: userId,
          type: 'like',
          message: `${req.user.name} liked your post "${post.title.substring(0, 35)}..."`,
          target: { modelType: 'Post', id: post._id.toString(), title: post.title },
        });
      }
    }

    const updated = await Post.findById(id).select('likes');
    const likesCount = updated.likes.length;
    const liked = !alreadyLiked;

    res.json({
      success: true,
      liked,
      likesCount,
    });
  } catch (error) {
    next(error);
  }
};

// Atomic Save / Unsave (Point 11, 12)
export const savePost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found.',
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Post not found.' },
      });
    }

    if (post.status === CONTENT_STATUS.DELETED) {
      return res.status(400).json({
        success: false,
        message: 'Cannot save a deleted post.',
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Post is deleted.' },
      });
    }

    const alreadySaved = post.saves.some((uid) => uid.toString() === userId.toString());

    if (alreadySaved) {
      await Post.updateOne({ _id: post._id }, { $pull: { saves: userId } });
    } else {
      await Post.updateOne({ _id: post._id }, { $addToSet: { saves: userId } });
    }

    const updated = await Post.findById(id).select('saves');
    const savesCount = updated.saves.length;
    const saved = !alreadySaved;

    res.json({
      success: true,
      saved,
      savesCount,
    });
  } catch (error) {
    next(error);
  }
};

// Atomic Helpful Vote (Point 11, 12)
export const voteHelpful = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found.',
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Post not found.' },
      });
    }

    if (post.status === CONTENT_STATUS.DELETED) {
      return res.status(400).json({
        success: false,
        message: 'Cannot vote on a deleted post.',
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Post is deleted.' },
      });
    }

    const alreadyHelpful = (post.helpfulVotes || []).some(
      (uid) => uid.toString() === userId.toString()
    );

    if (alreadyHelpful) {
      await Post.updateOne({ _id: post._id }, { $pull: { helpfulVotes: userId } });
    } else {
      await Post.updateOne({ _id: post._id }, { $addToSet: { helpfulVotes: userId } });
    }

    const updated = await Post.findById(id).select('helpfulVotes');
    const helpfulCount = updated.helpfulVotes.length;
    const helpful = !alreadyHelpful;

    res.json({
      success: true,
      helpful,
      helpfulCount,
    });
  } catch (error) {
    next(error);
  }
};

// Soft Delete Post (Author OR exact community mod/head OR admin) (Point 3, 15)
export const deletePost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const post = await Post.findById(id).populate('community');
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found.',
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Post not found.' },
      });
    }

    // Idempotency: If already deleted, return success without duplicate side-effects
    if (post.status === CONTENT_STATUS.DELETED) {
      return res.json({ success: true, message: 'Post is already deleted.' });
    }

    const canDelete = await permissionService.canDeletePost(req.user, post, post.community);
    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Only the post author or community moderators can delete this post.',
        error: { code: ERROR_CODES.FORBIDDEN, message: 'Unauthorized to delete post.' },
      });
    }

    const previousStatus = post.status;
    post.status = CONTENT_STATUS.DELETED;
    post.isPinned = false;
    post.pinnedAt = null;
    post.pinnedBy = null;
    post.allowComments = false;
    await post.save();

    // Decrement postCount on community if the post was active/published
    if (previousStatus === CONTENT_STATUS.PUBLISHED) {
      await Community.updateOne({ _id: post.community._id }, { $inc: { postCount: -1 } });
    }

    // Audit log
    await AuditLog.create({
      actor: req.user._id,
      action: AUDIT_ACTIONS.DELETE_POST,
      targetType: 'post',
      targetId: post._id.toString(),
      community: post.community._id,
      details: { title: post.title, originalAuthor: post.author, softDelete: true },
      ip: req.ip || '',
    });

    res.json({ success: true, message: 'Post deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

