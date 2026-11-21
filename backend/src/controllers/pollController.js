import { Poll } from '../models/Poll.js';
import { PollVote } from '../models/PollVote.js';
import { Post } from '../models/Post.js';
import { CONTENT_STATUS, VISIBILITY, ERROR_CODES } from '../constants/index.js';
import { permissionService } from '../services/permissionService.js';

const getPollWithAuthoritativeCounts = async (pollId, userVotedOption) => {
  const countRows = await PollVote.aggregate([
    { $match: { poll: pollId } },
    { $group: { _id: '$option', votesCount: { $sum: 1 } } },
  ]);
  const poll = await Poll.findById(pollId).lean();
  const options = (poll?.options || []).map((item, index) => ({
    ...item,
    votesCount: countRows.find((row) => row._id === index)?.votesCount || 0,
  }));

  return { ...poll, options, userVotedOption };
};

export const votePoll = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { option } = req.body;

    if (typeof option !== 'number' || !Number.isInteger(option)) {
      return res.status(400).json({
        success: false,
        message: 'Valid option index is required.',
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Invalid option index.' },
      });
    }

    const poll = await Poll.findById(id);
    if (!poll) {
      return res.status(404).json({
        success: false,
        message: 'Poll not found.',
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Poll not found.' },
      });
    }

    const post = await Post.findById(poll.post).populate('community');
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Parent post not found.',
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Parent post not found.' },
      });
    }

    if (![CONTENT_STATUS.PUBLISHED, CONTENT_STATUS.LOCKED].includes(post.status)) {
      return res.status(403).json({
        success: false,
        message: 'Voting is not allowed on this post.',
        error: { code: ERROR_CODES.FORBIDDEN, message: 'Post is not available.' },
      });
    }

    if (post.community?.permissions?.visibility === VISIBILITY.MEMBERS_ONLY) {
      const hasAccess = await permissionService.canAccessAttachment(req.user, null, post, post.community);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied.',
          error: { code: ERROR_CODES.FORBIDDEN, message: 'Access denied.' },
        });
      }
    }

    // Apply block relationships to poll interactions as well as comment interactions.
    if (post.author) {
      const blocked = await permissionService.isBlocked(req.user._id, post.author);
      if (blocked) {
        return res.status(403).json({
          success: false,
          message: 'You cannot interact with this poll due to user block settings.',
          error: { code: ERROR_CODES.FORBIDDEN, message: 'Poll interaction blocked.' },
        });
      }
    }

    if (poll.expiresAt && new Date() > new Date(poll.expiresAt)) {
      return res.status(400).json({
        success: false,
        message: 'This poll has expired.',
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Poll expired.' },
      });
    }

    if (option < 0 || option >= poll.options.length) {
      return res.status(400).json({
        success: false,
        message: 'Option index out of range.',
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Option index out of range.' },
      });
    }

    const userId = req.user._id;
    const existingVote = await PollVote.findOne({ poll: poll._id, user: userId });
    let userVotedOption = option;
    let message;

    if (existingVote && existingVote.option === option) {
      await PollVote.deleteOne({ _id: existingVote._id });
      userVotedOption = null;
      message = 'Vote retracted.';
    } else if (existingVote) {
      // The vote document is the source of truth; update it atomically.
      await PollVote.updateOne(
        { _id: existingVote._id, user: userId, poll: poll._id },
        { $set: { option } }
      );
      message = 'Vote updated.';
    } else {
      try {
        await PollVote.create({ poll: poll._id, user: userId, option });
        message = 'Vote recorded successfully!';
      } catch (error) {
        // The unique (poll, user) index arbitrates simultaneous first votes.
        if (error.code !== 11000) throw error;
        return res.status(409).json({
          success: false,
          message: 'Your vote changed concurrently. Refresh the poll and try again.',
          error: { code: ERROR_CODES.CONFLICT, message: 'Concurrent vote update.' },
        });
      }
    }

    const data = await getPollWithAuthoritativeCounts(poll._id, userVotedOption);
    return res.json({ success: true, message, data });
  } catch (error) {
    next(error);
  }
};
