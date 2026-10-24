import express from 'express';
import {
  uploadFiles,
  serveFile,
  getAttachmentById,
  deleteAttachment,
} from '../controllers/attachmentController.js';
import { uploadMiddleware } from '../middleware/upload.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { uploadLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

// Upload multiple files / media with rate limiting
router.post(
  '/',
  authenticate,
  uploadLimiter,
  uploadMiddleware.array('files', 5),
  uploadFiles
);

// Stream / serve uploaded media file with authorization check (Point 15, 22)
router.get('/:filename', optionalAuth, serveFile);

// Attachment record operations
router.get('/meta/:id', optionalAuth, getAttachmentById);
router.delete('/meta/:id', authenticate, deleteAttachment);

export default router;
