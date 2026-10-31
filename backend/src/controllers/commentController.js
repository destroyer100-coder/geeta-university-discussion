import { Comment } from '../models/Comment.js';
import { Post } from '../models/Post.js';
import { AuditLog } from '../models/AuditLog.js';
import { permissionService } from '../services/permissionService.js';
import { notificationService } from '../services/notificationService.js';
import { CONTENT_STATUS, AUDIT_ACTIONS, ERROR_CODES, DELEGATED_PERMISSIONS } from '../constants/index.js';

export const getComments = async (req, res, next) => {
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

    
    if ([CONTENT_STATUS.PENDING, CONTENT_STATUS.REJECTED].includes(post.status)) {
      const isAuthor = req.user && post.author.toString() === req.user._id.toString();
      const canReview = req.user && await permissionService.hasDelegatedPermission(
        req.user,
        post.community,
        DELEGATED_PERMISSIONS.MANAGE_REQUESTS
      );

      if (!isAuthor && !canReview) {
        return res.status(403).json({
          success: false,
          message: 'You cannot view comments on this post.',
          error: { code: ERROR_CODES.FORBIDDEN, message: 'Post is not available.' },
        });
      }
    }

    if ([CONTENT_STATUS.DELETED, CONTENT_STATUS.REMOVED].includes(post.status)) {
      return res.json({ success: true, count: 0, data: [] });
    }


    if (post.community?.permissions?.visibility === 'MEMBERS_ONLY') {
      const hasAccess = await permissionService.canAccessAttachment(req.user, null, post, post.community);

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'You must be a member of this community to view comments.',
          error: { code: ERROR_CODES.FORBIDDEN, message: 'Members-only discussion.' },
        });
      }
    }

    const comments = await Comment.find({ post: id })
      .populate('author', 'name avatar department year role verified')
      .sort({ isAccepted: -1, createdAt: 1 })
      .lean();

    // Attach current user's like info and filter out deleted/removed text for unauthorized viewers
    const enriched = comments.map((c) => {
      const isAuthor = req.user && c.author?._id.toString() === req.user._id.toString();
      const isDeleted = c.isDeleted || [CONTENT_STATUS.DELETED, CONTENT_STATUS.REMOVED].includes(c.status);

      return {
        ...c,
        body: isDeleted ? '[Comment deleted]' : c.body,
        likesCount: (c.likes || []).length,
        helpfulCount: (c.helpfulVotes || []).length,
        isLiked: req.user
          ? (c.likes || []).some((uid) => uid.toString() === req.user._id.toString())
          : false,
      };
    });

    // Build hierarchy: root comments with nested replies
    const rootComments = [];
    const commentMap = new Map();

    enriched.forEach((c) => {
      commentMap.set(c._id.toString(), { ...c, replies: [] });
    });

    enriched.forEach((c) => {
      if (c.parentComment) {
        const parent = commentMap.get(c.parentComment.toString());
        if (parent) {
          parent.replies.push(commentMap.get(c._id.toString()));
        } else {
          rootComments.push(commentMap.get(c._id.toString()));
        }
      } else {
        rootComments.push(commentMap.get(c._id.toString()));
      }
    });

    res.json({ success: true, count: comments.length, data: rootComments });
  } catch (error) {
    next(error);
  }
};

export const createComment = async (req, res, next) => {
  try {
    const { id } = req.params; // post id
    const { body, parentComment } = req.body;

    if (!body || body.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Comment content cannot be empty.',
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Body cannot be empty.' },
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

    // Backend authoritative policy check (Point 2, Point 3, Point 4, Point 18)
    const perm = await permissionService.canComment(req.user, post.community, post);
    if (!perm.allowed) {
      return res.status(403).json({
        success: false,
        message: perm.reason || 'You cannot comment on this post.',
        error: {
          code: ERROR_CODES.FORBIDDEN,
          message: perm.reason || 'You cannot comment on this post.',
        },
      });
    }

    const comment = await Comment.create({
      post: post._id,
      author: req.user._id,
      parentComment: parentComment || null,
      body: body.trim(),
      status: CONTENT_STATUS.PUBLISHED,
      likes: [],
      helpfulVotes: [],
    });

    // Increment post comments count atomically
    await Post.updateOne({ _id: post._id }, { $inc: { commentsCount: 1 } });

    // Send notification to post author (if not self-commenting)
    if (post.author.toString() !== req.user._id.toString()) {
      await notificationService.notify({
        userId: post.author,
        actorId: req.user._id,
        type: parentComment ? 'reply' : 'comment',
        message: `${req.user.name} commented on your post: "${body.substring(0, 30)}..."`,
        target: { modelType: 'Post', id: post._id.toString(), title: post.title },
      });
    }

    const populated = await Comment.findById(comment._id).populate(
      'author',
      'name avatar department year role verified'
    );

    res.status(201).json({
      success: true,
      message: 'Comment added successfully.',
      data: { ...populated.toObject(), replies: [], likesCount: 0, isLiked: false },
    });
  } catch (error) {
    next(error);
  }
};

// Atomic Like Comment (Point 11, 12)
export const toggleLikeComment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

      const comment = await Comment.findById(id).populate({
      path: 'post',
      populate: { path: 'community' },
    });

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found.',
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Comment not found.' },
      });
    }

    const post = comment.post;

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Parent post not found.',
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Parent post not found.' },
      });
    }

    if (
      [CONTENT_STATUS.PENDING, CONTENT_STATUS.REJECTED,
        CONTENT_STATUS.DELETED, CONTENT_STATUS.REMOVED].includes(post.status)
    ) {
      const isPostAuthor = post.author.toString() === userId.toString();
      const canModerate = await permissionService.canModerate(req.user, post.community);
      const canReview = await permissionService.hasDelegatedPermission(
        req.user,
        post.community,
        DELEGATED_PERMISSIONS.MANAGE_REQUESTS
      );

      if (!isPostAuthor && !canModerate && !canReview) {
        return res.status(403).json({
          success: false,
          message: 'You cannot like a comment on this post.',
          error: { code: ERROR_CODES.FORBIDDEN, message: 'Post is not available.' },
        });
      }
    }

    if (post.community?.permissions?.visibility === 'MEMBERS_ONLY') {
      const hasAccess = await permissionService.canAccessAttachment(
        req.user, null, post, post.community
      );

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'You cannot access this private community post.',
          error: { code: ERROR_CODES.FORBIDDEN, message: 'Access denied.' },
        });
      }
    }

    if (
      comment.isDeleted ||
      [CONTENT_STATUS.DELETED, CONTENT_STATUS.REMOVED].includes(comment.status)
    ) {
      return res.status(403).json({
        success: false,
        message: 'You cannot like a deleted comment.',
        error: { code: ERROR_CODES.FORBIDDEN, message: 'Comment is unavailable.' },
      });
    }

    const alreadyLiked = (comment.likes || []).some(
      (uid) => uid.toString() === userId.toString()
    );

    if (alreadyLiked) {
      await Comment.updateOne({ _id: comment._id }, { $pull: { likes: userId } });
    } else {
      await Comment.updateOne({ _id: comment._id }, { $addToSet: { likes: userId } });
    }

    const updated = await Comment.findById(id).select('likes');
    const likesCount = updated.likes.length;
    const liked = !alreadyLiked;

    res.json({ success: true, liked, likesCount });
  } catch (error) {
    next(error);
  }
};

// Accept Comment as Accepted Answer (Point 3)
export const acceptCommentAnswer = async (req, res, next) => {
  try {
    const { id } = req.params; // comment id
    const comment = await Comment.findById(id).populate({
      path: 'post',
      populate: { path: 'community' },
    });

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found.',
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Comment not found.' },
      });
    }

    const post = comment.post;
    if (!post || [CONTENT_STATUS.DELETED, CONTENT_STATUS.REMOVED].includes(post.status) || comment.isDeleted || [CONTENT_STATUS.DELETED, CONTENT_STATUS.REMOVED].includes(comment.status)) {
      return res.status(410).json({ success: false, message: 'This discussion or comment is no longer available.', error: { code: ERROR_CODES.CONFLICT } });
    }
    const isPostAuthor = post.author.toString() === req.user._id.toString();

    // Post author may always mark answers on their own discussion; moderators require
    // the explicit `mark_accepted_answers` delegation for this exact community (rules §3, §8).
    let canMarkAccepted = isPostAuthor;
    if (!canMarkAccepted) {
      canMarkAccepted = await permissionService.hasDelegatedPermission(
        req.user,
        post.community,
        DELEGATED_PERMISSIONS.MARK_ACCEPTED_ANSWERS
      );
    }

    if (!canMarkAccepted) {
      return res.status(403).json({
        success: false,
        message: 'Only the author of the discussion or a moderator delegated mark_accepted_answers permission can mark an accepted answer.',
        error: { code: ERROR_CODES.FORBIDDEN, message: 'Unauthorized action.' },
      });
    }

    const newStatus = !comment.isAccepted;

    if (newStatus) {
      // Unaccept all other comments for this post
      await Comment.updateMany({ post: post._id }, { isAccepted: false });
    }

    comment.isAccepted = newStatus;
    await comment.save();

    if (newStatus && comment.author.toString() !== req.user._id.toString()) {
      await notificationService.notify({
        userId: comment.author,
        actorId: req.user._id,
        type: 'accepted_answer',
        message: 'Your answer was marked as the Accepted Answer!',
        target: { modelType: 'Post', id: post._id.toString(), title: post.title },
      });
    }

    res.json({
      success: true,
      message: newStatus ? 'Comment marked as Accepted Answer!' : 'Accepted Answer status removed.',
      isAccepted: newStatus,
    });
  } catch (error) {
    next(error);
  }
};

// Update / Edit Comment (Author only)
export const updateComment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { body } = req.body;

    if (!body || body.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Comment text cannot be empty.',
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Body cannot be empty.' },
      });
    }

    const comment = await Comment.findById(id).populate('post');
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found.',
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Comment not found.' },
      });
    }

    if (comment.isDeleted || [CONTENT_STATUS.DELETED, CONTENT_STATUS.REMOVED].includes(comment.status) || !comment.post || [CONTENT_STATUS.DELETED, CONTENT_STATUS.REMOVED].includes(comment.post.status)) {
      return res.status(410).json({ success: false, message: 'This comment or its discussion is no longer available.', error: { code: ERROR_CODES.CONFLICT } });
    }

    if (comment.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Only the author can edit this comment.',
        error: { code: ERROR_CODES.FORBIDDEN, message: 'Unauthorized to edit comment.' },
      });
    }

    comment.editHistory.push({ editedAt: new Date(), previousBody: comment.body });
    comment.body = body.trim();
    comment.status = CONTENT_STATUS.EDITED;
    comment.isEdited = true;
    comment.editedAt = new Date();
    await comment.save();

    const populated = await Comment.findById(id).populate(
      'author',
      'name avatar department year role verified'
    );

    res.json({
      success: true,
      message: 'Comment updated successfully.',
      data: populated,
    });
  } catch (error) {
    next(error);
  }
};

// Delete Comment (Author OR exact community mod/owner OR platform admin) (Point 3)
export const deleteComment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const comment = await Comment.findById(id).populate({
      path: 'post',
      populate: { path: 'community' },
    });

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found.',
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Comment not found.' },
      });
    }

    const post = comment.post;
    if (comment.isDeleted || [CONTENT_STATUS.DELETED, CONTENT_STATUS.REMOVED].includes(comment.status)) {
      return res.json({ success: true, message: 'Comment is already deleted.' });
    }
    if (!post) return res.status(404).json({ success: false, message: 'Parent post not found.', error: { code: ERROR_CODES.NOT_FOUND } });
    if ([CONTENT_STATUS.DELETED, CONTENT_STATUS.REMOVED].includes(post.status)) return res.status(410).json({ success: false, message: 'This discussion is no longer available.', error: { code: ERROR_CODES.CONFLICT } });
    const canDelete = await permissionService.canModerateComment(req.user, comment, post, post.community);

    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Only comment author or community moderators can delete this comment.',
        error: { code: ERROR_CODES.FORBIDDEN, message: 'Unauthorized to delete comment.' },
      });
    }

    comment.status = CONTENT_STATUS.DELETED;
    comment.isDeleted = true;
    comment.isAccepted = false;
    comment.deletedBy = req.user._id;
    comment.deletedAt = new Date();
    comment.moderationNote = comment.author.toString() === req.user._id.toString() ? '' : 'Removed by moderation';
    await comment.save();

    // Preserve comment count: the tombstone remains part of the discussion history.

    // Audit log if deleted by a moderator/admin rather than author
    if (comment.author.toString() !== req.user._id.toString()) {
      await AuditLog.create({
        actor: req.user._id,
        action: AUDIT_ACTIONS.DELETE_COMMENT,
        targetType: 'comment',
        targetId: comment._id.toString(),
        community: post?.community?._id,
        details: { postTitle: post?.title, deletionType: 'soft_delete' },
        ip: req.ip || '',
      });
    }

    res.json({ success: true, message: 'Comment deleted successfully.' });
  } catch (error) {
    next(error);
  }
};
