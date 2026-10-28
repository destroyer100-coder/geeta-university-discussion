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

const MAX_POST_PAGE_SIZE = 100;
const MAX_POST_SEARCH_LENGTH = 120;
const ATTACHMENT_NAME_PATTERN = /^u-([a-f0-9]{24})-([a-f0-9]{32})(\.[a-z0-9]{1,10})$/i;

const UPLOAD_FILE_SPECS = {
  '.jpg': { type: 'image', mimeType: 'image/jpeg', directory: 'images' },
  '.jpeg': { type: 'image', mimeType: 'image/jpeg', directory: 'images' },
  '.png': { type: 'image', mimeType: 'image/png', directory: 'images' },
  '.gif': { type: 'image', mimeType: 'image/gif', directory: 'images' },
  '.webp': { type: 'image', mimeType: 'image/webp', directory: 'images' },
  '.mp4': { type: 'video', mimeType: 'video/mp4', directory: 'videos' },
  '.webm': { type: 'video', mimeType: 'video/webm', directory: 'videos' },
  '.mov': { type: 'video', mimeType: 'video/quicktime', directory: 'videos' },
  '.pdf': { type: 'file', mimeType: 'application/pdf', directory: 'files' },
  '.txt': { type: 'file', mimeType: 'text/plain', directory: 'files' },
  '.csv': { type: 'file', mimeType: 'text/csv', directory: 'files' },
  '.doc': { type: 'file', mimeType: 'application/msword', directory: 'files' },
  '.docx': {
    type: 'file',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    directory: 'files',
  },
  '.xls': { type: 'file', mimeType: 'application/vnd.ms-excel', directory: 'files' },
  '.xlsx': {
    type: 'file',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    directory: 'files',
  },
  '.ppt': { type: 'file', mimeType: 'application/vnd.ms-powerpoint', directory: 'files' },
  '.pptx': {
    type: 'file',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    directory: 'files',
  },
  '.zip': { type: 'file', mimeType: 'application/zip', directory: 'files' },
};

const parsePositiveInteger = (value, defaultValue) => {
  if (value === undefined) return defaultValue;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value);
  if (!/^\d+$/.test(text)) return null;
  const number = Number(text);
  return Number.isSafeInteger(number) && number >= 1 ? number : null;
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isContainedPath = (root, candidate) => {
  const relative = path.relative(root, candidate);
  return relative !== '' &&
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative);
};

export const getPosts = async (req, res, next) => {
  try {
    const {
      community,
      type,
      sort = 'latest',
      search,
      tag,
      author,
    } = req.query;

    const requestedPage = parsePositiveInteger(req.query.page, 1);
    const pageSize = parsePositiveInteger(req.query.limit, 20);
    if (requestedPage === null || pageSize === null || pageSize > MAX_POST_PAGE_SIZE) {
      return res.status(400).json({
        success: false,
        message: `Invalid pagination. Page must be a positive integer and limit must be between 1 and ${MAX_POST_PAGE_SIZE}.`,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Invalid pagination parameters.',
        },
      });
    }

    if (search !== undefined &&
      (typeof search !== 'string' || search.length > MAX_POST_SEARCH_LENGTH)) {
      return res.status(400).json({
        success: false,
        message: `Search must be a string no longer than ${MAX_POST_SEARCH_LENGTH} characters.`,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Invalid search query.',
        },
      });
    }

    if (author && author !== 'undefined' && author !== 'null' &&
      (typeof author !== 'string' || !/^[a-f0-9]{24}$/i.test(author))) {
      return res.status(400).json({
        success: false,
        message: 'Author must be a valid user ID.',
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Invalid author filter.',
        },
      });
    }

    const searchTerm = typeof search === 'string' ? search.trim() : '';
    const query = {};

    // Community filter: an invalid/missing community must never silently fall
    // back to the global feed. Repeated or non-string query parameters are rejected.
    let targetCommunity = null;
    const communityFilter = community === 'undefined' || community === 'null' ? '' : community;
    if (communityFilter !== undefined && communityFilter !== '') {
      if (typeof communityFilter !== 'string' || communityFilter.length > 100) {
        return res.status(400).json({
          success: false,
          message: 'Community must be a valid community ID or slug.',
          error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Invalid community filter.' },
        });
      }
      if (/^[0-9a-fA-F]{24}$/.test(communityFilter)) {
        targetCommunity = await Community.findById(communityFilter);
      } else {
        targetCommunity = await Community.findOne({ slug: communityFilter.toLowerCase() });
      }
      if (!targetCommunity) {
        return res.status(404).json({
          success: false,
          message: 'Community not found.',
          error: { code: ERROR_CODES.NOT_FOUND, message: 'Community not found.' },
        });
      }
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
    // the `manage_requests` delegation for this exact community (rules §10).
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
        // Authors may query their OWN posts only — never another author's
        // pending/rejected queue (rules §10). Force author scoping so a denied
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

    if (searchTerm) {
      const literalSearch = escapeRegex(searchTerm);
      query.$or = [
        { title: { $regex: literalSearch, $options: 'i' } },
        { body: { $regex: literalSearch, $options: 'i' } },
        { tags: { $regex: literalSearch, $options: 'i' } },
      ];
    }

    // Community feeds always prioritize pinned posts. helpfulCount is not a
    // stored Post field, so helpful sorting also ranks from the vote array.
    const sortOption = { isPinned: -1, createdAt: -1, _id: 1 };

    const total = await Post.countDocuments(query);
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(requestedPage, pages);
    const skip = (currentPage - 1) * pageSize;

    let posts;
    if (sort === 'trending' || sort === 'popular' || sort === 'helpful') {
      // Mongoose does not cast aggregation $match values. Cast author ObjectIds
      // (including $nin/$in filters introduced by block/mute filtering) explicitly.
      const aggregateQuery = { ...query };
      const authorFilter = aggregateQuery.author;
      const castAuthorId = (value) => Post.schema.path('author').cast(value);
      if (typeof authorFilter === 'string') {
        aggregateQuery.author = castAuthorId(authorFilter);
      } else if (authorFilter && typeof authorFilter === 'object') {
        aggregateQuery.author = { ...authorFilter };
        for (const operator of ['$in', '$nin', '$eq', '$ne']) {
          if (Array.isArray(authorFilter[operator])) {
            aggregateQuery.author[operator] = authorFilter[operator].map(castAuthorId);
          } else if (authorFilter[operator] !== undefined) {
            aggregateQuery.author[operator] = castAuthorId(authorFilter[operator]);
          }
        }
      }

      // Rank the full eligible set before pagination, not just the first page.
      // Disk-backed sorting avoids the in-memory aggregation sort limit on large feeds.
      const isHelpfulSort = sort === 'helpful';
      const rankingField = isHelpfulSort ? '__helpfulSortCount' : '__trendingScore';
      const rankingExpression = isHelpfulSort
        ? { $size: { $ifNull: ['$helpfulVotes', []] } }
        : {
            $divide: [
              {
                $add: [
                  { $multiply: [{ $size: { $ifNull: ['$likes', []] } }, 2] },
                  { $multiply: [{ $size: { $ifNull: ['$helpfulVotes', []] } }, 3] },
                  { $multiply: [{ $ifNull: ['$commentsCount', 0] }, 2] },
                  { $multiply: [{ $ifNull: ['$viewsCount', 0] }, 0.1] },
                ],
              },
              {
                $pow: [
                  {
                    $add: [
                      {
                        $max: [
                          0,
                          { $divide: [{ $subtract: [new Date(), '$createdAt'] }, 3600000] },
                        ],
                      },
                      2,
                    ],
                  },
                  1.5,
                ],
              },
            ],
          };

      posts = await Post.aggregate([
        { $match: aggregateQuery },
        { $addFields: { [rankingField]: rankingExpression } },
        { $sort: { isPinned: -1, [rankingField]: -1, createdAt: -1, _id: 1 } },
        { $skip: skip },
        { $limit: pageSize },
        { $unset: rankingField },
      ]).allowDiskUse(true);

      posts = await Post.populate(posts, [
        { path: 'author', select: 'name avatar department year role verified' },
        { path: 'community', select: 'name slug avatar type permissions' },
      ]);
    } else {
      posts = await Post.find(query)
        .populate('author', 'name avatar department year role verified')
        .populate('community', 'name slug avatar type permissions')
        .sort(sortOption)
        .skip(skip)
        .limit(pageSize)
        .lean();
    }

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

        const isAuthor =
          req.user &&
          post.author?._id?.toString() === req.user._id.toString();

        const canViewIdentity =
          !post.isAnonymous ||
          isAuthor ||
          (req.user &&
            post.community &&
            await permissionService.canModerate(req.user, post.community));

        return {
          ...post,
          author: canViewIdentity
            ? post.author
            : { name: 'Anonymous', avatar: null },
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
        page: currentPage,
        limit: pageSize,
        total,
        pages: total === 0 ? 0 : pages,
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
      .populate('author', 'name avatar department year role verified bio')
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

    // Handle Pending/Rejected Content Authorization (Point 5, rules §10):
    // visible ONLY to author and holders of the `manage_requests` delegation
    // for this exact community (Head/Platform Admin always; a moderator
    // WITHOUT that delegation — even with other delegations — is denied).
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
        author:
          post.isAnonymous && !isAuthor && !isModOrAdmin
            ? { name: 'Anonymous', avatar: null }
            : post.author,
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

    // 4. Persist the share (create a shared copy bound to the target).
    const sharePayload = {
      author: req.user._id,
      community: targetCommunity?._id,
      type: 'share',
      title: post.title,
      body: `[Shared from ${sourceCommunity.name || 'a community'}] ${post.body || ''}`,
      status: CONTENT_STATUS.PUBLISHED,
      sourcePost: post._id,
      sourceCommunity: sourceCommunity._id,
      sharedBy: req.user._id,
      ...(targetCommunity ? { targetCommunity: targetCommunity._id } : {}),
    };

    const sharedPost = await Post.create(sharePayload);

    // Traceability: audit log for the share.
    await AuditLog.create({
      actor: req.user._id,
      action: AUDIT_ACTIONS.SHARE_POST,
      targetType: 'post',
      targetId: sharedPost._id.toString(),
      community: targetCommunity?._id || sourceCommunity._id,
      details: {
        sourcePost: post._id.toString(),
        targetCommunity: targetCommunity?._id?.toString() || 'global',
      },
      ip: req.ip || '',
    });

    res.status(201).json({
      success: true,
      message: 'Discussion shared successfully.',
      data: {
        _id: sharedPost._id,
        title: sharedPost.title,
        body: sharedPost.body,
        status: sharedPost.status,
        community: targetCommunity
          ? { _id: targetCommunity._id, name: targetCommunity.name }
          : { _id: null, name: 'Global / Campus-wide' },
        source: {
          _id: post._id,
          community: { _id: sourceCommunity._id, name: sourceCommunity.name },
        },
        sharedBy: { _id: req.user._id, name: req.user.name },
        createdAt: sharedPost.createdAt,
      },
    });
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

    // Audience resolution (rules §37.1): community = null is Global / Campus-Wide
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

    // Uploaded files are staged by the authenticated upload route. A post may only
    // link a server-generated storage key belonging to the current uploader.
    if (!Array.isArray(attachments) || attachments.length > 5) {
      return res.status(400).json({
        success: false,
        message: 'Attachments must be an array containing no more than five files.',
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Invalid attachments payload.',
        },
      });
    }

    const ownerId = req.user?._id?.toString();
    const seenStorageKeys = new Set();
    const validatedAttachments = [];
    const uploadRoot = path.resolve(UPLOAD_DIR);

    for (const attachment of attachments) {
      const storageKey = attachment && typeof attachment.storageKey === 'string'
        ? attachment.storageKey
        : '';
      const filenameMatch = ATTACHMENT_NAME_PATTERN.exec(storageKey);

      if (!filenameMatch || filenameMatch[1].toLowerCase() !== ownerId?.toLowerCase()) {
        return res.status(403).json({
          success: false,
          message: 'One or more attachments are invalid or do not belong to you.',
          error: {
            code: ERROR_CODES.FORBIDDEN,
            message: 'Attachment ownership validation failed.',
          },
        });
      }

      if (seenStorageKeys.has(storageKey)) {
        return res.status(400).json({
          success: false,
          message: 'Duplicate attachment storage keys are not permitted.',
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Duplicate attachment.',
          },
        });
      }
      seenStorageKeys.add(storageKey);

      const extension = path.extname(storageKey).toLowerCase();
      const fileSpec = UPLOAD_FILE_SPECS[extension];
      if (!fileSpec || path.basename(storageKey) !== storageKey || storageKey.includes('\\')) {
        return res.status(400).json({
          success: false,
          message: 'Invalid attachment storage key.',
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Invalid attachment storage key.',
          },
        });
      }

      const categoryRoot = path.resolve(uploadRoot, fileSpec.directory);
      const filePath = path.resolve(categoryRoot, storageKey);
      if (!isContainedPath(categoryRoot, filePath) || path.dirname(filePath) !== categoryRoot) {
        return res.status(400).json({
          success: false,
          message: 'Invalid attachment storage path.',
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Invalid attachment storage path.',
          },
        });
      }

      let fileStats;
      try {
        fileStats = fs.lstatSync(filePath);
      } catch (fileError) {
        if (fileError.code === 'ENOENT') {
          return res.status(400).json({
            success: false,
            message: 'An uploaded attachment could not be found. Please upload it again.',
            error: {
              code: ERROR_CODES.VALIDATION_ERROR,
              message: 'Staged attachment not found.',
            },
          });
        }
        throw fileError;
      }

      if (!fileStats.isFile() || fileStats.isSymbolicLink()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid attachment file.',
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Attachment is not a regular file.',
          },
        });
      }

      const originalName = typeof attachment.originalName === 'string'
        ? attachment.originalName.replace(/[\u0000-\u001F\u007F]/g, '').slice(0, 255)
        : '';
      const relativePath = typeof attachment.relativePath === 'string'
        ? attachment.relativePath.slice(0, 1000)
        : '';
      const folderRelativePath = typeof attachment.folderRelativePath === 'string'
        ? attachment.folderRelativePath.slice(0, 1000)
        : '';

      validatedAttachments.push({
        storageKey,
        url: `/api/uploads/${storageKey}`,
        originalName: originalName || `attachment${extension}`,
        mimeType: fileSpec.mimeType,
        size: fileStats.size,
        type: fileSpec.type,
        relativePath,
        folderRelativePath,
        metadata: {},
      });
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
    if (validatedAttachments.length > 0) {
      for (const att of validatedAttachments) {
        let folderId = null;
        if (att.folderRelativePath && folderPathMap.has(att.folderRelativePath)) {
          folderId = folderPathMap.get(att.folderRelativePath);
        }

        const attachmentDoc = await Attachment.create({
          post: post._id,
          folder: folderId,
          type: att.type,
          originalName: att.originalName,
          mimeType: att.mimeType,
          size: att.size,
          storageKey: att.storageKey,
          url: att.url,
          relativePath: att.relativePath || att.originalName,
          metadata: att.metadata,
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
      .populate('author', 'name avatar department year role verified')
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

    let post = await Post.findById(id).populate('community');
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found.',
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Post not found.' },
      });
    }

    // Check exact community review authority: requires `manage_requests` delegation
    // for moderators (Head/Platform Admin always authorized) (rules §9, §10).
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

    const nextStatus =
      action === 'approve' ? CONTENT_STATUS.PUBLISHED : CONTENT_STATUS.REJECTED;
    const reviewedPost = await Post.findOneAndUpdate(
      { _id: post._id, status: CONTENT_STATUS.PENDING },
      {
        $set: {
          status: nextStatus,
          reviewedBy: req.user._id,
          reviewedAt: new Date(),
          rejectionReason: action === 'reject' ? reviewNote : '',
        },
      },
      { new: true, runValidators: true }
    ).populate('community');

    if (!reviewedPost) {
      return res.status(409).json({
        success: false,
        message: 'This post is no longer pending review. Refresh the queue and try again.',
        error: { code: ERROR_CODES.CONFLICT, message: 'Post has already been reviewed.' },
      });
    }

    post = reviewedPost;

    if (action === 'approve') {
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

    if (![CONTENT_STATUS.PUBLISHED, CONTENT_STATUS.EDITED, CONTENT_STATUS.LOCKED].includes(post.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only published, edited, or locked discussions can be pinned.',
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Post state does not permit pinning.' },
      });
    }

    const isGlobalPost = !post.community;
    const canPin = isGlobalPost
      ? req.user?.role === 'admin'
      : await permissionService.hasDelegatedPermission(
          req.user,
          post.community,
          DELEGATED_PERMISSIONS.PIN_POSTS
        );
    if (!canPin) {
      return res.status(403).json({
        success: false,
        message: isGlobalPost
          ? 'Only platform admins can pin or unpin global discussions.'
          : 'Only the Community Head or a moderator delegated pin_posts permission can pin discussions.',
        error: { code: ERROR_CODES.FORBIDDEN, message: 'Moderation privileges required.' },
      });
    }

    if (!post.isPinned) {
      // Community pin limits do not apply to platform-wide discussions.
      if (post.community) {
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
      community: post.community?._id || null,
      details: { isPinned: post.isPinned, globalPost: !post.community },
      ip: req.ip || '',
    });

    res.json({
      success: true,
      message: post.isPinned
        ? (isGlobalPost ? 'Global discussion pinned.' : 'Post pinned to top of community.')
        : (isGlobalPost ? 'Global discussion unpinned.' : 'Post unpinned.'),
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

    if (![CONTENT_STATUS.PUBLISHED, CONTENT_STATUS.EDITED, CONTENT_STATUS.LOCKED].includes(post.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only published, edited, or locked discussions can be locked.',
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Post state does not permit locking.' },
      });
    }

    const isGlobalPost = !post.community;
    const canLock = isGlobalPost
      ? req.user?.role === 'admin'
      : await permissionService.hasDelegatedPermission(
          req.user,
          post.community,
          DELEGATED_PERMISSIONS.LOCK_POSTS
        );
    if (!canLock) {
      return res.status(403).json({
        success: false,
        message: isGlobalPost
          ? 'Only platform admins can lock or unlock global discussions.'
          : 'Only the Community Head or a moderator delegated lock_posts permission can lock discussions.',
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
      community: post.community?._id || null,
      details: { status: post.status, globalPost: !post.community },
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

const post = await Post.findById(id).populate('community');

if (!post) {
  return res.status(404).json({
    success: false,
    message: 'Post not found.',
    error: { code: ERROR_CODES.NOT_FOUND, message: 'Post not found.' },
  });
}

if (
  post.status !== CONTENT_STATUS.PUBLISHED &&
  post.status !== CONTENT_STATUS.LOCKED
) {
  return res.status(403).json({
    success: false,
    message: 'You cannot like this post.',
    error: { code: ERROR_CODES.FORBIDDEN, message: 'Post is not available.' },
  });
}

if (
  post.community?.permissions?.visibility === VISIBILITY.MEMBERS_ONLY &&
  !(await permissionService.canAccessAttachment(req.user, null, post, post.community))
) {
  return res.status(403).json({
    success: false,
    message: 'You cannot access this private community post.',
    error: { code: ERROR_CODES.FORBIDDEN, message: 'Access denied.' },
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

       const post = await Post.findById(id).populate('community');

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found.',
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Post not found.' },
      });
    }

    if (
      post.status !== CONTENT_STATUS.PUBLISHED &&
      post.status !== CONTENT_STATUS.LOCKED
    ) {
      return res.status(403).json({
        success: false,
        message: 'You cannot save this post.',
        error: { code: ERROR_CODES.FORBIDDEN, message: 'Post is not available.' },
      });
    }

    if (
      post.community?.permissions?.visibility === VISIBILITY.MEMBERS_ONLY &&
      !(await permissionService.canAccessAttachment(req.user, null, post, post.community))
    ) {
      return res.status(403).json({
        success: false,
        message: 'You cannot access this private community post.',
        error: { code: ERROR_CODES.FORBIDDEN, message: 'Access denied.' },
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

       const post = await Post.findById(id).populate('community');

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found.',
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Post not found.' },
      });
    }

    if (
      post.status !== CONTENT_STATUS.PUBLISHED &&
      post.status !== CONTENT_STATUS.LOCKED
    ) {
      return res.status(403).json({
        success: false,
        message: 'You cannot vote on this post.',
        error: { code: ERROR_CODES.FORBIDDEN, message: 'Post is not available.' },
      });
    }

    if (
      post.community?.permissions?.visibility === VISIBILITY.MEMBERS_ONLY &&
      !(await permissionService.canAccessAttachment(req.user, null, post, post.community))
    ) {
      return res.status(403).json({
        success: false,
        message: 'You cannot access this private community post.',
        error: { code: ERROR_CODES.FORBIDDEN, message: 'Access denied.' },
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

    const canDelete = await permissionService.canDeletePost(req.user, post, post.community);
    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Only the post author or community moderators can delete this post.',
        error: { code: ERROR_CODES.FORBIDDEN, message: 'Unauthorized to delete post.' },
      });
    }

    // Idempotency without revealing a deleted post to an unauthorized caller.
    if (post.status === CONTENT_STATUS.DELETED) {
      return res.json({ success: true, message: 'Post is already deleted.' });
    }

    const previousStatus = post.status;
    post.status = CONTENT_STATUS.DELETED;
    post.isPinned = false;
    post.pinnedAt = null;
    post.pinnedBy = null;
    post.allowComments = false;
    await post.save();

    // Decrement postCount on community if the post was active/published
    if (previousStatus === CONTENT_STATUS.PUBLISHED && post.community?._id) {
      await Community.updateOne({ _id: post.community._id }, { $inc: { postCount: -1 } });
    }

    // Global posts intentionally have no community; preserve their audit record
    // without dereferencing a null community after the tombstone has been saved.
    await AuditLog.create({
      actor: req.user._id,
      action: AUDIT_ACTIONS.DELETE_POST,
      targetType: 'post',
      targetId: post._id.toString(),
      community: post.community?._id || null,
      details: { title: post.title, originalAuthor: post.author, softDelete: true, globalPost: !post.community },
      ip: req.ip || '',
    });

    res.json({ success: true, message: 'Post deleted successfully.' });
  } catch (error) {
    next(error);
  }
};
