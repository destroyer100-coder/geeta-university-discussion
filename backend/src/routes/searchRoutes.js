import express from 'express';
import { globalSearch } from '../controllers/searchController.js';
import { optionalAuth } from '../middleware/auth.js';
import { searchLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

router.get('/', optionalAuth, searchLimiter, globalSearch);

export default router;
