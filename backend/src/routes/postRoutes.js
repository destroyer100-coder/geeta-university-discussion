import express from 'express';
import {
  getPosts,
  getPostById,
  createPost,
  deletePost,
  likePost,
  savePost,
  voteHelpful,
  togglePinPost,
  toggleLockPost,
  reviewPost,
  resubmitPost,
  sharePost,
} from '../controllers/postController.js';
import {
  getComments,
  createComment,
} from '../controllers/commentController.js';
import { getFoldersByPost } from '../controllers/folderController.js';
import { createReport } from '../controllers/reportController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { validateCreatePost } from '../validators/postValidator.js';
import {
  postLimiter,
  commentLimiter,
  reportLimiter,
  preventDuplicateSubmission,
} from '../middleware/rateLimit.js';

const router = express.Router();

router.get('/', optionalAuth, getPosts);
router.get('/:id', optionalAuth, getPostById);
router.post(
  '/',
  authenticate,
  postLimiter,
  preventDuplicateSubmission(15),
  validate(validateCreatePost),
  createPost
);
router.post('/:id/share', authenticate, sharePost);
router.delete('/:id', authenticate, deletePost);

// Moderation & Content Management
router.put('/:id/pin', authenticate, togglePinPost);
router.put('/:id/lock', authenticate, toggleLockPost);
router.put('/:id/review', authenticate, reviewPost);
router.put('/:id/resubmit', authenticate, preventDuplicateSubmission(15), resubmitPost);

// Interactions (no Reddit up/down arrows; Like, Save, Helpful)
router.post('/:id/like', authenticate, likePost);
router.post('/:id/save', authenticate, savePost);
router.post('/:id/helpful', authenticate, voteHelpful);
router.post(
  '/:id/report',
  authenticate,
  reportLimiter,
  preventDuplicateSubmission(30),
  (req, res, next) => {
    req.body.targetType = 'post';
    req.body.targetId = req.params.id;
    createReport(req, res, next);
  }
);

// Nested Comments routes
router.get('/:id/comments', optionalAuth, getComments);
router.post(
  '/:id/comments',
  authenticate,
  commentLimiter,
  preventDuplicateSubmission(10),
  createComment
);

// Folder hierarchy route
router.get('/:id/folders', optionalAuth, getFoldersByPost);

export default router;
