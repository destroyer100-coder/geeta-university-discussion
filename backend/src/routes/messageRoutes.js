import express from 'express';
import {
  getConversations,
  getMessagesWithUser,
  sendMessage,
  deleteMessageForMe,
  deleteMessageForEveryone,
} from '../controllers/messageController.js';
import { authenticate } from '../middleware/auth.js';
import { messageLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

router.get('/conversations', authenticate, getConversations);
router.get('/with/:userId', authenticate, getMessagesWithUser);
router.post('/', authenticate, messageLimiter, sendMessage);
router.delete('/:id/me', authenticate, deleteMessageForMe);
router.delete('/:id/everyone', authenticate, deleteMessageForEveryone);

export default router;
