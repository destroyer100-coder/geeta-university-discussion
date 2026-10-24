import express from 'express';
import { votePoll } from '../controllers/pollController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.post('/:id/vote', authenticate, votePoll);

export default router;
