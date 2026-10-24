import { Post } from '../models/Post.js';
import { Community } from '../models/Community.js';
import { CommunityMember } from '../models/CommunityMember.js';
import { User } from '../models/User.js';
import { Block } from '../models/Block.js';
import { Mute } from '../models/Mute.js';
import { CONTENT_STATUS, VISIBILITY, ERROR_CODES } from '../constants/index.js';

const MAX_SEARCH_LENGTH = 120;
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const globalSearch = async (req, res, next) => {
  try {
    const { q } = req.query;

    if (q == null || q === '') {
      return res.json({
        success: true,
        data: { posts: [], communities: [], users: [] },
      });
    }
    if (typeof q !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Search query must be a string.',
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Search query must be a string.' },
      });
    }

    const searchTerm = q.trim();
    if (!searchTerm) {
      return res.json({ success: true, data: { posts: [], communities: [], users: [] } });
    }
    if (searchTerm.length > MAX_SEARCH_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Search query must not exceed ${MAX_SEARCH_LENGTH} characters.`,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Search query is too long.' },
      });
    }

    // Treat user input as literal text, not an executable regular expression.
    const regex = new RegExp(escapeRegex(searchTerm), 'i');

    const postQuery = {
      status: CONTENT_STATUS.PUBLISHED,
      $or: [{ title: regex }, { body: regex }, { tags: regex }],
    };

    // Filter private communities for non-members in search
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
        postQuery.community = { $nin: excludedPrivateCommIds };
      }
    }

    const userQuery = {
      isDeleted: { $ne: true },
      // Public search must not allow private email addresses to be used as a user-discovery oracle.
      $or: [{ name: regex }, { department: regex }],
    };

    // Filter blocked and muted users if authenticated (Point 18)
    if (req.user) {
      const blocks = await Block.find({
        $or: [{ blocker: req.user._id }, { blocked: req.user._id }],
      });
      const blockedUserIds = blocks.map((b) =>
        b.blocker.toString() === req.user._id.toString() ? b.blocked : b.blocker
      );

      const mutes = await Mute.find({ muter: req.user._id });
      const mutedUserIds = mutes.map((m) => m.muted);

      const excludedUserIds = [...new Set([...blockedUserIds, ...mutedUserIds])];
      if (excludedUserIds.length > 0) {
        postQuery.author = { $nin: excludedUserIds };
        userQuery._id = { $nin: excludedUserIds };
      }
    }

    const [rawPosts, communities, users] = await Promise.all([
      Post.find(postQuery)
        .populate('author', 'name avatar department year role verified')
        .populate('community', 'name slug avatar type permissions')
        .limit(15)
        .lean(),

      Community.find({
  'permissions.visibility': { $ne: VISIBILITY.MEMBERS_ONLY },
  $or: [{ name: regex }, { description: regex }, { slug: regex }],
})
  .limit(10)
  .lean(),

      User.find(userQuery)
        .select('name avatar department year role verified bio')
        .limit(10)
        .lean(),
    ]);

    const posts = rawPosts.map((post) => {
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
      };
    });

    res.json({
      success: true,
      data: {
        posts,
        communities,
        users,
      },
    });
  } catch (error) {
    next(error);
  }
};
