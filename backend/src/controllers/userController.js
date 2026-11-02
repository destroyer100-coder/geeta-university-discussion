import { User } from '../models/User.js';
import { Post } from '../models/Post.js';
import { Comment } from '../models/Comment.js';
import { Community } from '../models/Community.js';
import { CommunityMember } from '../models/CommunityMember.js';
import { Attachment } from '../models/Attachment.js';
import { Folder } from '../models/Folder.js';
import { Poll } from '../models/Poll.js';
import { PollVote } from '../models/PollVote.js';
import { Follow } from '../models/Follow.js';
import { Block } from '../models/Block.js';
import { Mute } from '../models/Mute.js';
import { AuditLog } from '../models/AuditLog.js';
import { permissionService } from '../services/permissionService.js';
import { ERROR_CODES, AUDIT_ACTIONS, VISIBILITY, CONTENT_STATUS } from '../constants/index.js';

const MAX_USER_SEARCH_LENGTH = 120;
const MAX_USER_PAGE_SIZE = 100;
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const getUserProfile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select('-passwordHash -email');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
        error: { code: ERROR_CODES.NOT_FOUND, message: 'User not found.' },
      });
    }

    // Check if target user has deleted their account (Point 28)
    if (user.isDeleted) {
      return res.json({
        success: true,
        data: {
          _id: user._id,
          name: '[Deleted User]',
          department: 'Former University Member',
          year: '',
          bio: 'This account has been deleted.',
          avatar: '',
          isDeleted: true,
          posts: [],
          comments: [],
          communities: [],
          followersCount: 0,
          followingCount: 0,
        },
      });
    }

    // Check if current user is blocked by or has blocked target user (Point 18)
    if (req.user) {
      const isBlocked = await permissionService.isBlocked(req.user._id, user._id);
      if (isBlocked) {
        return res.status(403).json({
          success: false,
          message: 'Profile unavailable due to user block settings.',
          error: { code: ERROR_CODES.FORBIDDEN, message: 'User is blocked.' },
        });
      }
    }

    const isSelf = req.user && req.user._id.toString() === user._id.toString();
    const isAdmin = req.user && req.user.role === 'admin';

    // Isolate private community posts, comments and memberships from non-members (QA Privacy Fix)
    const privateCommunities = await Community.find({
      'permissions.visibility': VISIBILITY.MEMBERS_ONLY,
    }).select('_id');

    const privateCommIds = privateCommunities.map((c) => c._id);
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
      (pId) => !allowedPrivateCommIds.some((allowedId) => allowedId.toString() === pId.toString())
    );

    const postQuery = { author: user._id };

    if (isSelf || isAdmin) {
      postQuery.status = { $nin: [CONTENT_STATUS.DELETED, CONTENT_STATUS.REMOVED, 'archived'] };
    } else {
      postQuery.status = { $in: [CONTENT_STATUS.PUBLISHED, CONTENT_STATUS.LOCKED, 'edited'] };
    }

    if (excludedPrivateCommIds.length > 0) {
      postQuery.community = { $nin: excludedPrivateCommIds };
    }

    const rawPosts = await Post.find(postQuery)
      .populate('author', 'name avatar department year role verified')
      .populate('community', 'name slug avatar type permissions')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const posts = await Promise.all(
      rawPosts.map(async (post) => {
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

    const rawComments = await Comment.find({ author: user._id, isDeleted: false })
      .populate({
        path: 'post',
        select: 'title slug community status',
        populate: { path: 'community', select: 'name slug avatar permissions' },
      })
      .sort({ createdAt: -1 })
      .limit(30);

    const comments = rawComments
      .filter((c) => {
        if (!c.post) return false;
        if (!isSelf && !isAdmin) {
          if (
            [
              CONTENT_STATUS.PENDING,
              CONTENT_STATUS.REJECTED,
              CONTENT_STATUS.DELETED,
              CONTENT_STATUS.REMOVED,
            ].includes(c.post.status)
          ) {
            return false;
          }
        }
        if (c.post.community?.permissions?.visibility === VISIBILITY.MEMBERS_ONLY) {
          const commId = (c.post.community._id || c.post.community).toString();
          if (excludedPrivateCommIds.some((id) => id.toString() === commId)) {
            return false;
          }
        }
        return true;
      })
      .slice(0, 20);

    const communityMemberships = await CommunityMember.find({ user: user._id, status: 'active' })
      .populate('community', 'name slug avatar description memberCount owner moderators permissions')
      .limit(20);

    const userCommunities = communityMemberships
      .filter((m) => {
        if (!m.community) return false;
        if (m.community.permissions?.visibility === VISIBILITY.MEMBERS_ONLY) {
          if (!isSelf && !isAdmin) {
            const commId = m.community._id.toString();
            if (excludedPrivateCommIds.some((id) => id.toString() === commId)) {
              return false;
            }
          }
        }
        return true;
      })
      .map((m) => {
        let role = 'member';
        if (m.community.owner && m.community.owner.toString() === user._id.toString()) {
          role = 'owner';
        } else if (m.role === 'moderator') {
          role = 'moderator';
        } else if (['owner', 'moderator', 'member'].includes(m.role)) {
          role = m.role;
        } else {
          role = 'member';
        }
        return {
          _id: m.community._id,
          name: m.community.name,
          slug: m.community.slug,
          avatar: m.community.avatar,
          description: m.community.description,
          memberCount: m.community.memberCount,
          communityRole: role,
          joinedAt: m.createdAt,
        };
      });

    const followersCount = await Follow.countDocuments({ targetType: 'user', targetId: user._id });
    const followingCount = await Follow.countDocuments({ follower: user._id, targetType: 'user' });

    let isFollowing = false;
    let isBlocked = false;
    let isMuted = false;

    if (req.user) {
      const follow = await Follow.findOne({
        follower: req.user._id,
        targetType: 'user',
        targetId: user._id,
      });
      isFollowing = !!follow;

      const block = await Block.findOne({ blocker: req.user._id, blocked: user._id });
      isBlocked = !!block;

      const mute = await Mute.findOne({ muter: req.user._id, muted: user._id });
      isMuted = !!mute;
    }

    res.json({
      success: true,
      data: {
        ...user.toObject(),
        posts,
        comments,
        communities: userCommunities,
        followersCount,
        followingCount,
        isFollowing,
        isBlocked,
        isMuted,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const { name, bio, department, year, avatar } = req.body;
    const user = await User.findById(req.user._id);

    if (name) user.name = name.trim();
    if (bio !== undefined) user.bio = bio;
    if (department) user.department = department;
    if (year) user.year = year;
    if (avatar) user.avatar = avatar;

    await user.save();

    res.json({ success: true, message: 'Profile updated successfully.', data: user });
  } catch (error) {
    next(error);
  }
};

export const getSavedPosts = async (req, res, next) => {
  try {
    // Saved private-community content stays subject to authorization (rules §24, §37.6)
    const privateCommunities = await Community.find({
      'permissions.visibility': VISIBILITY.MEMBERS_ONLY,
    }).select('_id');

    const privateCommIds = privateCommunities.map((c) => c._id);
    let allowedPrivateCommIds = [];
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

    const excludedPrivateCommIds = privateCommIds.filter(
      (pId) => !allowedPrivateCommIds.some((allowedId) => allowedId.toString() === pId.toString())
    );

    const savedQuery = { saves: req.user._id, status: 'published' };
    if (excludedPrivateCommIds.length > 0) {
      savedQuery.community = { $nin: excludedPrivateCommIds };
    }

   const rawPosts = await Post.find(savedQuery)
      .populate('author', 'name avatar department year role verified')
      .populate('community', 'name slug avatar type permissions')
      .sort({ createdAt: -1 })
      .lean();

    const populatedPosts = await Promise.all(
      rawPosts.map(async (post) => {
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
        const isSaved = true;
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

    res.json({ success: true, count: populatedPosts.length, data: populatedPosts });
  } catch (error) {
    next(error);
  }
};

export const toggleFollow = async (req, res, next) => {
  try {
    const { targetType, targetId } = req.body;
    if (!targetType || !targetId) {
      return res.status(400).json({
        success: false,
        message: 'Target type and target ID required.',
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Missing fields.' },
      });
    }

    const existing = await Follow.findOne({
      follower: req.user._id,
      targetType,
      targetId,
    });

    let following = false;
    if (existing) {
      await Follow.deleteOne({ _id: existing._id });
      following = false;
    } else {
      await Follow.create({
        follower: req.user._id,
        targetType,
        targetId,
      });
      following = true;
    }

    res.json({ success: true, following });
  } catch (error) {
    next(error);
  }
};

// Block User (Point 14 & 18)
export const blockUser = async (req, res, next) => {
  try {
    const { id: targetUserId } = req.params;

    if (req.user._id.toString() === targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot block yourself.',
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Cannot block self.' },
      });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User to block not found.',
        error: { code: ERROR_CODES.NOT_FOUND, message: 'User not found.' },
      });
    }

    await Block.findOneAndUpdate(
      { blocker: req.user._id, blocked: targetUserId },
      { blocker: req.user._id, blocked: targetUserId },
      { upsert: true, new: true }
    );

    // Also remove any follow relationships between them
    await Follow.deleteMany({
      $or: [
        { follower: req.user._id, targetType: 'user', targetId: targetUserId },
        { follower: targetUserId, targetType: 'user', targetId: req.user._id },
      ],
    });

    res.json({
      success: true,
      blocked: true,
      message: `You have blocked ${targetUser.name}. They cannot message you or view your direct profile.`,
    });
  } catch (error) {
    next(error);
  }
};

// Unblock User (Point 18)
export const unblockUser = async (req, res, next) => {
  try {
    const { id: targetUserId } = req.params;
    await Block.deleteOne({ blocker: req.user._id, blocked: targetUserId });

    res.json({
      success: true,
      blocked: false,
      message: 'User unblocked successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// Mute User (Point 18)
export const muteUser = async (req, res, next) => {
  try {
    const { id: targetUserId } = req.params;

    if (req.user._id.toString() === targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot mute yourself.',
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Cannot mute self.' },
      });
    }

    await Mute.findOneAndUpdate(
      { muter: req.user._id, muted: targetUserId },
      { muter: req.user._id, muted: targetUserId },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      muted: true,
      message: 'User muted. Their posts will no longer appear in your feeds.',
    });
  } catch (error) {
    next(error);
  }
};

// Unmute User (Point 18)
export const unmuteUser = async (req, res, next) => {
  try {
    const { id: targetUserId } = req.params;
    await Mute.deleteOne({ muter: req.user._id, muted: targetUserId });

    res.json({
      success: true,
      muted: false,
      message: 'User unmuted.',
    });
  } catch (error) {
    next(error);
  }
};

// Get User Restrictions List (Point 18)
export const getMyRestrictions = async (req, res, next) => {
  try {
    const blocks = await Block.find({ blocker: req.user._id }).populate('blocked', 'name avatar department');
    const mutes = await Mute.find({ muter: req.user._id }).populate('muted', 'name avatar department');

    res.json({
      success: true,
      data: {
        blockedUsers: blocks.map((b) => b.blocked).filter(Boolean),
        mutedUsers: mutes.map((m) => m.muted).filter(Boolean),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Account Deletion & Retention Workflow (Point 28)
export const deleteMyAccount = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Check if user is the Owner/Head of any active community
    const ownedCommunities = await Community.find({ owner: userId });
    if (ownedCommunities.length > 0) {
      const names = ownedCommunities.map((c) => `"${c.name}"`).join(', ');
      return res.status(409).json({
        success: false,
        message: `Account cannot be removed because you are the Head of ${names}. You must transfer ownership to another community member before deleting your account.`,
        error: {
          code: ERROR_CODES.CONFLICT,
          message: 'Community ownership transfer required before account deletion.',
          ownedCommunities: ownedCommunities.map((c) => ({ id: c._id, name: c.name })),
        },
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User record not found.',
        error: { code: ERROR_CODES.NOT_FOUND, message: 'User not found.' },
      });
    }

    // Apply anonymization and soft deletion
    user.name = '[Deleted User]';
    user.email = `deleted_${user._id}@geeta.edu.in`;
    user.avatar = '';
    user.bio = '';
    user.isDeleted = true;
    user.deletedAt = new Date();
    await user.save();

    // Clean up community memberships
    await CommunityMember.deleteMany({ user: userId });

    // Clean up followings
    await Follow.deleteMany({ $or: [{ follower: userId }, { targetId: userId }] });

  // Create Audit Log without retaining the original email
await AuditLog.create({
  actor: userId,
  action: AUDIT_ACTIONS.DELETE_ACCOUNT,
  targetType: 'user',
  targetId: userId.toString(),
  details: { deletedAt: new Date() },
  ip: req.ip || '',
});

    res.json({
      success: true,
      message: 'Your account has been deleted and personal data anonymized.',
    });
  } catch (error) {
    next(error);
  }
};

export const getUsers = async (req, res, next) => {
  try {
    const { search, department, role, page = 1, limit = 50 } = req.query;
    const pageNumber = Number(page);
    const pageSize = Number(limit);

    if (!Number.isSafeInteger(pageNumber) || pageNumber < 1 ||
        !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > MAX_USER_PAGE_SIZE) {
      return res.status(400).json({
        success: false,
        message: `Page must be a positive integer and limit must be between 1 and ${MAX_USER_PAGE_SIZE}.`,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Invalid pagination values.' },
      });
    }

    const query = { isDeleted: { $ne: true } };
    if (search != null && search !== '') {
      if (typeof search !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Search query must be a string.',
          error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Search query must be a string.' },
        });
      }

      const searchTerm = search.trim();
      if (searchTerm.length > MAX_USER_SEARCH_LENGTH) {
        return res.status(400).json({
          success: false,
          message: `Search query must not exceed ${MAX_USER_SEARCH_LENGTH} characters.`,
          error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Search query is too long.' },
        });
      }
      if (searchTerm) {
        const regex = new RegExp(escapeRegex(searchTerm), 'i');
        // Do not let public user search reveal accounts by private email address.
        query.$or = [{ name: regex }, { department: regex }, { bio: regex }];
      }
    }
    if (department && department !== 'All') query.department = department;
    if (role && role !== 'All') query.role = role;

    // Filter blocked users if authenticated.
    if (req.user) {
      const blocks = await Block.find({
        $or: [{ blocker: req.user._id }, { blocked: req.user._id }],
      });
      const blockedUserIds = blocks.map((block) =>
        block.blocker.toString() === req.user._id.toString() ? block.blocked : block.blocker
      );
      if (blockedUserIds.length > 0) {
        query._id = { $nin: blockedUserIds };
      }
    }

    const skip = (pageNumber - 1) * pageSize;
    const users = await User.find(query)
      .select('name avatar department year role verified bio')
      .sort({ role: 1, name: 1 })
      .skip(skip)
      .limit(pageSize)
      .lean();

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: users,
      pagination: {
        total,
        page: pageNumber,
        limit: pageSize,
        pages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    next(error);
  }
};
