import express from 'express';
import {
  acceptCommentAnswer,
  toggleLikeComment,
  updateComment,
  deleteComment,
} from '../controllers/commentController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.post('/:id/accept', authenticate, acceptCommentAnswer);
router.post('/:id/like', authenticate, toggleLikeComment);
router.put('/:id', authenticate, updateComment);
router.delete('/:id', authenticate, deleteComment);

export default router;
