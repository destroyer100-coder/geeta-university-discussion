import { Report } from '../models/Report.js';
import { AuditLog } from '../models/AuditLog.js';
import { Post } from '../models/Post.js';
import { Comment } from '../models/Comment.js';
import { CommunityMember } from '../models/CommunityMember.js';
import { ERROR_CODES, COMMUNITY_MEMBER_ROLES } from '../constants/index.js';

export const createReport = async (req, res, next) => {
  try {
    const { targetType, targetId, reason, details } = req.body;

    if (!targetType || !targetId || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Target type, target ID, and reason are required.',
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Missing report fields.' },
      });
    }

    // Resolve community context from the reported target (Point 1, 2, 11)
    let communityId = null;
    if (targetType === 'post') {
      const post = await Post.findById(targetId);
      communityId = post ? post.community : null;
    } else if (targetType === 'comment') {
      const comment = await Comment.findById(targetId);
      if (comment) {
        const post = await Post.findById(comment.post);
        communityId = post ? post.community : null;
      }
    }
    // User reports have no community (platform-level, e.g., harassment across communities)

    // Check duplicate report within last 10 minutes (Point 13)
    const recentDuplicate = await Report.findOne({
      reporter: req.user._id,
      targetType,
      targetId,
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
      targetId,
      reason,
      details: details || '',
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
      details: { targetType, targetId, reason, communityId, reporter: req.user._id },
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
    
    // Community-aware report retrieval (Point 8, 16, 17, 18, 19)
    if (req.user.role === 'admin' || req.user.role === 'faculty') {
      // Platform admins and faculty can see ALL reports (platform-level scope)
      reports = await Report.find()
        .populate('reporter', 'name email')
        .populate('reviewer', 'name email')
        .sort({ createdAt: -1 });
    } else {
      // Check if user is a community moderator or owner in any community
      const memberships = await CommunityMember.find({
        user: req.user._id,
        status: 'active',
        role: { $in: [COMMUNITY_MEMBER_ROLES.MODERATOR, COMMUNITY_MEMBER_ROLES.OWNER] },
      }).select('community');
      
      if (memberships.length === 0) {
        // Not a moderator anywhere - return no reports
        res.json({ success: true, count: 0, data: [] });
        return;
      }
      
      // Moderator can see reports from their communities ONLY (exclude platform/global reports)
      const communityIds = memberships.map(m => m.community);
      reports = await Report.find({
        community: { $in: communityIds },
      })
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

    // Authorization check: only users with platform scope or community scope may review
    if (req.user.role !== 'admin' && req.user.role !== 'faculty') {
      // Community moderator: must be an active moderator in the report's community
      // and cannot review platform/global reports (community === null)
      if (!report.community) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to review this report.',
          error: { code: ERROR_CODES.FORBIDDEN, message: 'Insufficient privileges.' },
        });
      }
      const membership = await CommunityMember.findOne({
        user: req.user._id,
        community: report.community,
        status: 'active',
        role: { $in: [COMMUNITY_MEMBER_ROLES.MODERATOR, COMMUNITY_MEMBER_ROLES.OWNER] },
      });
      if (!membership) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to review this report.',
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
