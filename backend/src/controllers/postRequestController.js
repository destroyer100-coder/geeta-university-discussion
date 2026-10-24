import { PostRequest } from '../models/PostRequest.js';
import { Community } from '../models/Community.js';
import { CommunityMember } from '../models/CommunityMember.js';
import { Post } from '../models/Post.js';
import { AuditLog } from '../models/AuditLog.js';
import { notificationService } from '../services/notificationService.js';
import { permissionService } from '../services/permissionService.js';
import {
  POST_REQUEST_STATUS,
  COMMUNITY_MEMBER_ROLES,
  AUDIT_ACTIONS,
  ERROR_CODES,
  CONTENT_STATUS,
  DELEGATED_PERMISSIONS,
} from '../constants/index.js';

export const createPostRequest = async (req, res, next) => {
  try {
    const { id: communityId } = req.params;
    const { title, body, reason, tags = [], draftPayload } = req.body;

    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found.',
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Community not found.' },
      });
    }

    if (!community.permissions?.allowPostRequests) {
      return res.status(400).json({
        success: false,
        message: 'This community does not currently accept posting requests.',
        error: { code: ERROR_CODES.FORBIDDEN, message: 'Post requests disabled.' },
      });
    }

    // Check if user already has an active pending post request in this community (Idempotency / Abuse control)
    const existingPending = await PostRequest.findOne({
      user: req.user._id,
      community: community._id,
      status: POST_REQUEST_STATUS.PENDING,
    });

    if (existingPending) {
      return res.status(409).json({
        success: false,
        message: 'You already have a pending posting request awaiting moderator review in this community.',
        error: { code: ERROR_CODES.CONFLICT, message: 'Existing pending request.' },
      });
    }

    const postReq = await PostRequest.create({
      user: req.user._id,
      community: community._id,
      title: title || 'Request to Post',
      body: body || 'Requesting posting access.',
      reason: reason || '',
      tags,
      draftPayload: draftPayload || {},
      status: POST_REQUEST_STATUS.PENDING,
    });

    // Notify community owner & moderators
    await notificationService.notify({
      userId: community.owner,
      actorId: req.user._id,
      type: 'post_request',
      message: `${req.user.name} submitted a request to post in "${community.name}".`,
      target: { modelType: 'Community', id: community._id.toString(), title: community.name },
    });

    res.status(201).json({
      success: true,
      message: 'Your request to post has been sent to the community moderators for approval.',
      data: postReq,
    });
  } catch (error) {
    next(error);
  }
};

export const getCommunityPostRequests = async (req, res, next) => {
  try {
    // req.community is resolved by checkModeratorPermission(MANAGE_REQUESTS) from
    // either an ObjectId or a slug; use its _id so slugs never reach the query.
    const communityId = req.community?._id || req.params.id;
    const requests = await PostRequest.find({ community: communityId })
      .populate('user', 'name email avatar department year role')
      .populate('reviewer', 'name email')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: requests.length, data: requests });
  } catch (error) {
    next(error);
  }
};

// Review Post Request with Strict Object-Level Community Authorization (Point 2, 3)
export const reviewPostRequest = async (req, res, next) => {
  try {
    const { id } = req.params; // post request id
    const { status, reviewNote } = req.body; // 'approved', 'rejected', 'clarification'

    if (!Object.values(POST_REQUEST_STATUS).includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status provided.',
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Invalid status.' },
      });
    }

    const postReq = await PostRequest.findById(id).populate('community');
    if (!postReq) {
      return res.status(404).json({
        success: false,
        message: 'Post request not found.',
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Post request not found.' },
      });
    }

    // Authoritative check: must hold the `manage_requests` delegation for THIS EXACT
    // community (Head/Platform Admin always; moderators only when delegated) (rules §8, §9).
    const canReview = await permissionService.hasDelegatedPermission(
      req.user,
      postReq.community,
      DELEGATED_PERMISSIONS.MANAGE_REQUESTS
    );
    if (!canReview) {
      return res.status(403).json({
        success: false,
        message: 'You must be the Community Head or a moderator delegated manage_requests permission to review posting requests.',
        error: { code: ERROR_CODES.FORBIDDEN, message: 'Moderator privileges required.' },
      });
    }

    // Prevent non-owner moderator from approving their own request (Point 5)
    const isOwner = postReq.community.owner.toString() === req.user._id.toString();
    const isRequester = postReq.user.toString() === req.user._id.toString();
    if (isRequester && !isOwner && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You cannot approve your own posting request.',
        error: { code: ERROR_CODES.FORBIDDEN, message: 'Self-review disallowed.' },
      });
    }

    postReq.status = status;
    postReq.reviewer = req.user._id;
    postReq.reviewNote = reviewNote || '';
    await postReq.save();

    // If approved, grant user approved posting privileges in CommunityMember
    if (status === POST_REQUEST_STATUS.APPROVED) {
      let member = await CommunityMember.findOne({
        user: postReq.user,
        community: postReq.community._id,
      });

      if (!member) {
        member = await CommunityMember.create({
          user: postReq.user,
          community: postReq.community._id,
          role: COMMUNITY_MEMBER_ROLES.APPROVED_USER,
          status: 'active',
          canPost: true,
          approvedBy: req.user._id,
        });
      } else {
        member.canPost = true;
        member.role = COMMUNITY_MEMBER_ROLES.APPROVED_USER;
        member.approvedBy = req.user._id;
        await member.save();
      }

      // If draft payload exists, publish post
      if (postReq.draftPayload && postReq.draftPayload.title) {
        await Post.create({
          author: postReq.user,
          community: postReq.community._id,
          type: postReq.draftPayload.type || 'discussion',
          title: postReq.draftPayload.title,
          body: postReq.draftPayload.body || postReq.body,
          tags: postReq.draftPayload.tags || [],
          status: CONTENT_STATUS.PUBLISHED,
        });
        await Community.updateOne({ _id: postReq.community._id }, { $inc: { postCount: 1 } });
      }
    }

    // Audit Log entry (Point 8, 25)
    await AuditLog.create({
      actor: req.user._id,
      action: status === POST_REQUEST_STATUS.APPROVED ? AUDIT_ACTIONS.APPROVE_POST : AUDIT_ACTIONS.REJECT_POST,
      targetType: 'post_request',
      targetId: postReq._id.toString(),
      community: postReq.community._id,
      details: { requesterId: postReq.user, status, reviewNote },
      ip: req.ip || '',
    });

    // Send notification to user
    await notificationService.notify({
      userId: postReq.user,
      actorId: req.user._id,
      type: status === POST_REQUEST_STATUS.APPROVED ? 'request_approved' : 'request_rejected',
      message: `Your request to post in "${postReq.community.name}" was ${status}. ${reviewNote ? `Note: ${reviewNote}` : ''}`,
      target: { modelType: 'Community', id: postReq.community._id.toString(), title: postReq.community.name },
    });

    res.json({
      success: true,
      message: `Post request has been marked as ${status}.`,
      data: postReq,
    });
  } catch (error) {
    next(error);
  }
};
