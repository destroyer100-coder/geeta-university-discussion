import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import {
  getAdminOverview,
  getAdminUsers,
  updatePlatformRole,
  updateUserAccountStatus,
  getAdminReports,
  getAdminAuditLogs,
} from '../controllers/adminController.js';
import { updateReportStatus } from '../controllers/reportController.js';

const router = express.Router();
router.use(authenticate, requireRole('admin'));
router.get('/overview', getAdminOverview);
router.get('/users', getAdminUsers);
router.patch('/users/:id/role', updatePlatformRole);
router.patch('/users/:id/status', updateUserAccountStatus);
router.get('/reports', getAdminReports);
router.get('/audit-logs', getAdminAuditLogs);
router.patch('/reports/:id', updateReportStatus);

export default router;
