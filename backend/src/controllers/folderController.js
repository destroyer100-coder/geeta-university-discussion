
import { Folder } from '../models/Folder.js';
import { Attachment } from '../models/Attachment.js';
import { Post } from '../models/Post.js';
import { permissionService } from '../services/permissionService.js';
import {
  CONTENT_STATUS,
  VISIBILITY,
  ERROR_CODES,
  DELEGATED_PERMISSIONS,
} from '../constants/index.js';

export const getFoldersByPost = async (req, res, next) => {
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

    const isAuthor =
      req.user && post.author.toString() === req.user._id.toString();

    if ([CONTENT_STATUS.PENDING, CONTENT_STATUS.REJECTED].includes(post.status)) {
      const canReview =
        req.user &&
        (await permissionService.hasDelegatedPermission(
          req.user,
          post.community,
          DELEGATED_PERMISSIONS.MANAGE_REQUESTS
        ));

      if (!isAuthor && !canReview) {
        return res.status(403).json({
          success: false,
          message: 'You cannot view folders for this post.',
          error: { code: ERROR_CODES.FORBIDDEN, message: 'Post is not available.' },
        });
      }
    }

    if ([CONTENT_STATUS.DELETED, CONTENT_STATUS.REMOVED].includes(post.status)) {
      return res.json({ success: true, data: { folders: [], attachments: [] } });
    }

    if (post.community?.permissions?.visibility === VISIBILITY.MEMBERS_ONLY) {
      const hasAccess = await permissionService.canAccessAttachment(
        req.user,
        null,
        post,
        post.community
      );

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'You must be a community member to view these folders.',
          error: { code: ERROR_CODES.FORBIDDEN, message: 'Members-only discussion.' },
        });
      }
    }

    const folders = await Folder.find({ post: post._id }).lean();

    const attachments = await Attachment.find({ post: post._id })
      .select('_id filename originalName mimetype size folder createdAt')
      .lean();
    
    res.json({
      success: true,
      data: { folders, attachments },
    });
  } catch (error) {
    next(error);
  }
};
