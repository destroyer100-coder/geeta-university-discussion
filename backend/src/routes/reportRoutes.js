import express from 'express';
import { createReport, getReports, updateReportStatus } from '../controllers/reportController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';

const router = express.Router();

router.post('/', authenticate, createReport);
router.get('/', authenticate, getReports);
router.patch('/:id', authenticate, updateReportStatus);

export default router;
