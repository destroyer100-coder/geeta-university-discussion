import express from 'express';
import authRoutes from './authRoutes.js';
import communityRoutes from './communityRoutes.js';
import postRoutes from './postRoutes.js';
import commentRoutes from './commentRoutes.js';
import uploadRoutes from './uploadRoutes.js';
import pollRoutes from './pollRoutes.js';
import eventRoutes from './eventRoutes.js';
import notificationRoutes from './notificationRoutes.js';
import messageRoutes from './messageRoutes.js';
import searchRoutes from './searchRoutes.js';
import reportRoutes from './reportRoutes.js';
import postRequestRoutes from './postRequestRoutes.js';
import userRoutes from './userRoutes.js';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/communities', communityRoutes);
router.use('/posts', postRoutes);
router.use('/comments', commentRoutes);
router.use('/uploads', uploadRoutes);
router.use('/polls', pollRoutes);
router.use('/events', eventRoutes);
router.use('/notifications', notificationRoutes);
router.use('/messages', messageRoutes);
router.use('/search', searchRoutes);
router.use('/reports', reportRoutes);
router.use('/post-requests', postRequestRoutes);
router.use('/users', userRoutes);

export default router;
