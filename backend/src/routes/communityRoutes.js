import express from 'express';
import {
  createCommunity,
  getCommunities,
  getCommunityById,
  updateCommunitySettings,
  joinCommunity,
  leaveCommunity,
  getCommunityMembers,
  getCommunityAuditLogs,
  getJoinRequests,
  reviewJoinRequest,
} from '../controllers/communityController.js';
import {
  createPostRequest,
  getCommunityPostRequests,
} from '../controllers/postRequestController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { checkModeratorPermission } from '../middleware/communityPermission.js';
import { DELEGATED_PERMISSIONS } from '../constants/index.js';

const router = express.Router();

router.get('/', optionalAuth, getCommunities);
router.post('/', authenticate, createCommunity);
router.get('/:id', optionalAuth, getCommunityById);
router.patch('/:id/settings', authenticate, updateCommunitySettings);
router.post('/:id/join', authenticate, joinCommunity);
router.post('/:id/leave', authenticate, leaveCommunity);

// Private community join requests (request -> pending -> approve/reject)
router.get('/:id/join-requests', authenticate, getJoinRequests);
router.patch('/:id/join-requests/:userId', authenticate, reviewJoinRequest);
router.get('/:id/members', authenticate, getCommunityMembers);
router.get('/:id/audit-logs', authenticate, getCommunityAuditLogs);

// Community Post Requests (Section 13 & 15)
router.post('/:id/post-requests', authenticate, createPostRequest);
router.get('/:id/post-requests', authenticate, checkModeratorPermission(DELEGATED_PERMISSIONS.MANAGE_REQUESTS), getCommunityPostRequests);

export default router;
