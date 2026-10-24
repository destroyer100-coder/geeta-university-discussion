import express from 'express';
import { reviewPostRequest } from '../controllers/postRequestController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.patch('/:id', authenticate, reviewPostRequest);

export default router;
