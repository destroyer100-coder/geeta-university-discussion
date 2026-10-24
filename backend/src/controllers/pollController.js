import { Poll } from '../models/Poll.js';
import { PollVote } from '../models/PollVote.js';
import { Post } from '../models/Post.js';
import { CONTENT_STATUS, VISIBILITY } from '../constants/index.js';
import { permissionService } from '../services/permissionService.js';

export const votePoll = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { option } = req.body;

    if (typeof option !== 'number' || !Number.isInteger(option)) {
      return res.status(400).json({
        success: false,
        message: 'Valid option index is required.',
      });
    }

    const poll = await Poll.findById(id);

    if (!poll) {
      return res.status(404).json({
        success: false,
        message: 'Poll not found.',
      });
    }

    const post = await Post.findById(poll.post).populate('community');

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Parent post not found.',
      });
    }

    if (
      ![
        CONTENT_STATUS.PUBLISHED,
        CONTENT_STATUS.LOCKED,
      ].includes(post.status)
    ) {
      return res.status(403).json({
        success: false,
        message: 'Voting is not allowed on this post.',
      });
    }

    if (
      post.community?.permissions?.visibility === VISIBILITY.MEMBERS_ONLY
    ) {
      const hasAccess = await permissionService.canAccessAttachment(
        req.user,
        null,
        post,
        post.community
      );

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied.',
        });
      }
    }

    if (poll.expiresAt && new Date() > new Date(poll.expiresAt)) {
      return res.status(400).json({
        success: false,
        message: 'This poll has expired.',
      });
    }

    if (option < 0 || option >= poll.options.length) {
      return res.status(400).json({
        success: false,
        message: 'Option index out of range.',
      });
    }

    const userId = req.user._id;

    const existingVote = await PollVote.findOne({
      poll: poll._id,
      user: userId,
    });

    if (existingVote) {
      if (existingVote.option === option) {
        poll.options[existingVote.option].votesCount = Math.max(
          0,
          poll.options[existingVote.option].votesCount - 1
        );

        await PollVote.deleteOne({ _id: existingVote._id });
        await poll.save();

        return res.json({
          success: true,
          message: 'Vote retracted.',
          data: {
            ...poll.toObject(),
            userVotedOption: null,
          },
        });
      }

      poll.options[existingVote.option].votesCount = Math.max(
        0,
        poll.options[existingVote.option].votesCount - 1
      );

      poll.options[option].votesCount += 1;
      existingVote.option = option;

      await existingVote.save();
      await poll.save();

      return res.json({
        success: true,
        message: 'Vote updated.',
        data: {
          ...poll.toObject(),
          userVotedOption: option,
        },
      });
    }

    poll.options[option].votesCount += 1;
    await poll.save();

    await PollVote.create({
      poll: poll._id,
      user: userId,
      option,
    });

    return res.json({
      success: true,
      message: 'Vote recorded successfully!',
      data: {
        ...poll.toObject(),
        userVotedOption: option,
      },
    });
  } catch (error) {
    next(error);
  }
};
