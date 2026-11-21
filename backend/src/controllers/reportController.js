import mongoose from 'mongoose';
import { Report } from '../models/Report.js';
import { AuditLog } from '../models/AuditLog.js';
import { Post } from '../models/Post.js';
import { Comment } from '../models/Comment.js';
import { Community } from '../models/Community.js';
import { User } from '../models/User.js';
import { ERROR_CODES } from '../constants/index.js';

export const createReport = async (req, res, next) => {
  try {
    const { targetType, targetId, reason, details } = req.body || {};

    const allowedTargetTypes = ['post', 'comment', 'user'];
    if (typeof targetType !== 'string' || !allowedTargetTypes.includes(targetType)) {
      return res.status(400).json({
        success: false,
        message: 'Target type must be post, comment, or user.',
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Invalid target type.' },
      });
    }

    if (typeof targetId !== 'string' || !mongoose.isValidObjectId(targetId)) {
      return res.status(400).json({
        success: false,
        message: 'Target ID must be a valid identifier.',
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Invalid target ID.' },
      });
    }

    if (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Reason is required and must be at most 100 characters.',
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Invalid report reason.' },
      });
    }

    if (details !== undefined && (typeof details !== 'string' || details.length > 1000)) {
      return res.status(400).json({
        success: false,
        message: 'Report details must be text and at most 1000 characters.',
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Invalid report details.' },
      });
    }

    const normalizedTargetId = targetId.trim();
    const normalizedReason = reason.trim();
    const normalizedDetails = typeof details === 'string' ? details.trim() : '';

    // Resolve and verify the target before creating a report. Invalid target types
    // or nonexistent IDs must not become platform-level reports with community=null.
    let communityId = null;
    if (targetType === 'post') {
      const post = await Post.findById(normalizedTargetId).select('community');
      if (!post) {
        return res.status(404).json({
          success: false,
          message: 'Reported post not found.',
          error: { code: ERROR_CODES.NOT_FOUND, message: 'Target not found.' },
        });
      }
      communityId = post.community || null;
    } else if (targetType === 'comment') {
      const comment = await Comment.findById(normalizedTargetId).select('post');
      if (!comment) {
        return res.status(404).json({
          success: false,
          message: 'Reported comment not found.',
          error: { code: ERROR_CODES.NOT_FOUND, message: 'Target not found.' },
        });
      }
      const post = await Post.findById(comment.post).select('community');
      if (!post) {
        return res.status(404).json({
          success: false,
          message: 'Parent discussion not found.',
          error: { code: ERROR_CODES.NOT_FOUND, message: 'Parent discussion not found.' },
        });
      }
      communityId = post.community || null;
    } else {
      const user = await User.findById(normalizedTargetId).select('_id');
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Reported user not found.',
          error: { code: ERROR_CODES.NOT_FOUND, message: 'Target not found.' },
        });
      }
    }

    // Check duplicate report within last 10 minutes (Point 13)
    const recentDuplicate = await Report.findOne({
      reporter: req.user._id,
      targetType,
      targetId: normalizedTargetId,
      createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) },
    });

    if (recentDuplicate) {
      return res.status(409).json({
        success: false,
        message: 'You have already submitted a report for this item recently.',
        error: { code: ERROR_CODES.CONFLICT, message: 'Duplicate report.' },
      });
    }

    const report = await Report.create({
      reporter: req.user._id,
      targetType,
      targetId: normalizedTargetId,
      reason: normalizedReason,
      details: normalizedDetails,
      status: 'pending',
      community: communityId,
    });

    // Audit log for report creation (Point 12, 23)
    await AuditLog.create({
      actor: req.user._id,
      action: 'create_report',
      targetType: 'report',
      targetId: report._id.toString(),
      community: communityId,
      details: { targetType, targetId: normalizedTargetId, reason: normalizedReason, communityId, reporter: req.user._id },
      ip: req.ip || '',
    });

    res.status(201).json({
      success: true,
      message: 'Report submitted to moderators for review.',
      data: report,
    });
  } catch (error) {
    next(error);
  }
};
export const getReports = async (req, res, next) => {
  try {
    let reports;
    
    // Platform Admin has platform-wide report access. Faculty and students
    // receive only reports belonging to communities they currently own.
    if (req.user.role === 'admin') {
      reports = await Report.find()
        .populate('reporter', 'name email')
        .populate('reviewer', 'name email')
        .sort({ createdAt: -1 });
    } else {
      const ownedCommunities = await Community.find({ owner: req.user._id }).select('_id');
      const communityIds = ownedCommunities.map((community) => community._id);

      if (communityIds.length === 0) {
        return res.json({ success: true, count: 0, data: [] });
      }

      // Moderator membership alone does not grant report access: the current
      // permission model defines no delegated manage-reports permission.
      reports = await Report.find({ community: { $in: communityIds } })
        .populate('reporter', 'name email')
        .populate('reviewer', 'name email')
        .sort({ createdAt: -1 });
    }

    res.json({ success: true, count: reports.length, data: reports });
  } catch (error) {
    next(error);
  }
};

export const updateReportStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'reviewed', 'resolved', 'dismissed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status provided.',
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Invalid status.' },
      });
    }

    const report = await Report.findById(id);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found.',
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Report not found.' },
      });
    }

    // Only Platform Admin may review platform-level reports. For a
    // community report, the current Head/Owner of that exact community may
    // review it. Faculty role or moderator membership alone grants no bypass.
    if (req.user.role !== 'admin') {
      if (!report.community) {
        return res.status(403).json({
          success: false,
          message: 'Only a Platform Admin can review platform-level reports.',
          error: { code: ERROR_CODES.FORBIDDEN, message: 'Insufficient privileges.' },
        });
      }

      const community = await Community.findById(report.community).select('owner');
      if (!community || community.owner.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Only the Head/Owner of this community or a Platform Admin can review this report.',
          error: { code: ERROR_CODES.FORBIDDEN, message: 'Insufficient privileges.' },
        });
      }
    }

    report.status = status;
    report.reviewer = req.user._id;
    await report.save();

    // Audit log for report review (Point 12, 23)
    await AuditLog.create({
      actor: req.user._id,
      action: 'review_report',
      targetType: 'report',
      targetId: report._id.toString(),
      community: report.community,
      details: { status, targetType: report.targetType, targetId: report.targetId, communityId: report.community, reviewer: req.user._id },
      ip: req.ip || '',
    });

    res.json({ success: true, message: 'Report updated.', data: report });
  } catch (error) {
    next(error);
  }
};
