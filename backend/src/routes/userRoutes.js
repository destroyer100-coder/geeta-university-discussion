import express from 'express';
import {
  getUsers,
  getUserProfile,
  updateProfile,
  getSavedPosts,
  toggleFollow,
  blockUser,
  unblockUser,
  muteUser,
  unmuteUser,
  getMyRestrictions,
  deleteMyAccount,
} from '../controllers/userController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/', optionalAuth, getUsers);
router.get('/saved', authenticate, getSavedPosts);
router.get('/me/restrictions', authenticate, getMyRestrictions);
router.post('/follow', authenticate, toggleFollow);
router.patch('/profile', authenticate, updateProfile);
router.delete('/me', authenticate, deleteMyAccount);

// Block & Mute actions (Point 14 & 18)
router.post('/:id/block', authenticate, blockUser);
router.delete('/:id/block', authenticate, unblockUser);
router.post('/:id/mute', authenticate, muteUser);
router.delete('/:id/mute', authenticate, unmuteUser);

router.get('/:id', optionalAuth, getUserProfile);

export default router;
