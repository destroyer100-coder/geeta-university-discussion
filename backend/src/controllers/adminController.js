import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Report } from '../models/Report.js';
import { AuditLog } from '../models/AuditLog.js';
import { ERROR_CODES, AUDIT_ACTIONS } from '../constants/index.js';

const MAX_LIMIT = 100;
const USER_FIELDS = 'name email role department year avatar verified isActive bio createdAt updatedAt';

export const getAdminOverview = async (req, res, next) => {
  try {
    const [users, students, faculty, pendingReports, totalReports] = await Promise.all([
      User.countDocuments({ isDeleted: { $ne: true } }),
      User.countDocuments({ role: 'student', isDeleted: { $ne: true } }),
      User.countDocuments({ role: 'faculty', isDeleted: { $ne: true } }),
      Report.countDocuments({ status: 'pending' }),
      Report.countDocuments(),
    ]);
    return res.json({ success: true, data: { users, students, faculty, pendingReports, totalReports } });
  } catch (error) { return next(error); }
};

export const getAdminUsers = async (req, res, next) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 25);
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const role = typeof req.query.role === 'string' ? req.query.role : '';
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT || search.length > 120 || (role && !['admin', 'faculty', 'student'].includes(role))) {
      return res.status(400).json({ success: false, message: 'Invalid search, role, or pagination parameters.', error: { code: ERROR_CODES.VALIDATION_ERROR } });
    }
    const query = { isDeleted: { $ne: true } };
    if (role) query.role = role;
    if (search) {
      const escaped = search.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      query.$or = [{ name: regex }, { email: regex }, { department: regex }];
    }
    const [data, total] = await Promise.all([
      User.find(query).select(USER_FIELDS).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      User.countDocuments(query),
    ]);
    return res.json({ success: true, data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (error) { return next(error); }
};

export const updatePlatformRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const role = req.body?.role;
    if (!mongoose.isValidObjectId(id) || !['student', 'faculty'].includes(role)) {
      return res.status(400).json({ success: false, message: 'A valid user ID and role (student or faculty) are required.', error: { code: ERROR_CODES.VALIDATION_ERROR } });
    }
    if (req.user._id.toString() === id) {
      return res.status(409).json({ success: false, message: 'You cannot change your own platform role.', error: { code: ERROR_CODES.CONFLICT } });
    }
    const target = await User.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!target) return res.status(404).json({ success: false, message: 'User not found.', error: { code: ERROR_CODES.NOT_FOUND } });
    if (target.role === 'admin') {
      return res.status(403).json({ success: false, message: 'Platform administrator roles cannot be changed through this endpoint.', error: { code: ERROR_CODES.FORBIDDEN } });
    }
    const previousRole = target.role;
    if (previousRole === role) return res.json({ success: true, message: 'User already has this role.', data: { _id: target._id, name: target.name, email: target.email, role: target.role } });
    target.role = role;
    await target.save();
    await AuditLog.create({ actor: req.user._id, action: AUDIT_ACTIONS.CHANGE_ROLE, targetType: 'user', targetId: target._id.toString(), details: { previousRole, newRole: role }, ip: req.ip || '' });
    return res.json({ success: true, message: 'Platform role updated.', data: { _id: target._id, name: target.name, email: target.email, role: target.role } });
  } catch (error) { return next(error); }
};

export const getAdminReports = async (req, res, next) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 25);
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    const allowed = ['pending', 'reviewed', 'resolved', 'dismissed'];
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT || (status && !allowed.includes(status))) {
      return res.status(400).json({ success: false, message: 'Invalid report status or pagination parameters.', error: { code: ERROR_CODES.VALIDATION_ERROR } });
    }
    const query = status ? { status } : {};
    const [data, total] = await Promise.all([
      Report.find(query).select('reporter targetType targetId reason details status reviewer community createdAt updatedAt').populate('reporter', 'name email').populate('reviewer', 'name email').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Report.countDocuments(query),
    ]);
    return res.json({ success: true, data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (error) { return next(error); }
};

export const getAdminAuditLogs = async (req, res, next) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 25);
    const action = typeof req.query.action === 'string' ? req.query.action : '';
    const targetType = typeof req.query.targetType === 'string' ? req.query.targetType : '';
    const allowedTargetTypes = ['community', 'post', 'comment', 'user', 'report', 'post_request', 'join_request'];

    if (
      !Number.isSafeInteger(page) || page < 1 ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT ||
      (action && !Object.values(AUDIT_ACTIONS).includes(action)) ||
      (targetType && !allowedTargetTypes.includes(targetType))
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid audit log filters or pagination parameters.',
        error: { code: ERROR_CODES.VALIDATION_ERROR },
      });
    }

    const query = {};
    if (action) query.action = action;
    if (targetType) query.targetType = targetType;

    const [data, total] = await Promise.all([
      AuditLog.find(query)
        .select('actor action targetType targetId community ip createdAt')
        .populate('actor', 'name email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(query),
    ]);

    return res.json({
      success: true,
      data,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return next(error);
  }
};

export const updateUserAccountStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isActive = req.body?.isActive;
    if (!mongoose.isValidObjectId(id) || typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'A valid user ID and boolean isActive value are required.',
        error: { code: ERROR_CODES.VALIDATION_ERROR },
      });
    }

    if (req.user._id.toString() === id) {
      return res.status(409).json({
        success: false,
        message: 'You cannot deactivate your own administrator account.',
        error: { code: ERROR_CODES.CONFLICT },
      });
    }

    const target = await User.findOne({ _id: id, isDeleted: { $ne: true } }).select('+tokenVersion');
    if (!target) {
      return res.status(404).json({ success: false, message: 'User not found.', error: { code: ERROR_CODES.NOT_FOUND } });
    }
    if (target.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Administrator accounts cannot be deactivated through this endpoint.',
        error: { code: ERROR_CODES.FORBIDDEN },
      });
    }

    const previousStatus = target.isActive !== false;
    if (previousStatus === isActive) {
      return res.json({ success: true, message: 'Account already has the requested status.', data: { _id: target._id, isActive: previousStatus } });
    }

    target.isActive = isActive;
    target.tokenVersion = (target.tokenVersion || 0) + 1;
    await target.save();

    await AuditLog.create({
      actor: req.user._id,
      action: AUDIT_ACTIONS.UPDATE_ACCOUNT_STATUS,
      targetType: 'user',
      targetId: target._id.toString(),
      details: { previousStatus, newStatus: isActive, sessionsRevoked: true },
      ip: req.ip || '',
    });

    return res.json({
      success: true,
      message: isActive ? 'Account reactivated. Previous sessions remain revoked.' : 'Account deactivated and all existing sessions revoked.',
      data: { _id: target._id, isActive: target.isActive },
    });
  } catch (error) {
    return next(error);
  }
};
