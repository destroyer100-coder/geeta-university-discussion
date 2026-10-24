import { Community } from '../models/Community.js';
import { permissionService } from '../services/permissionService.js';
import { ERROR_CODES } from '../constants/index.js';

export const checkPostingPermission = async (req, res, next) => {
  try {
    const communityId = req.body.community || req.params.communityId || req.params.id;
    if (!communityId) {
      return res.status(400).json({
        success: false,
        message: 'Community ID is required.',
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Community ID is required.' },
      });
    }

    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found.',
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Community not found.' },
      });
    }

    const permission = await permissionService.canCreatePost(req.user, community);

    if (!permission.allowed) {
      return res.status(403).json({
        success: false,
        message: permission.reason || 'You do not have permission to post in this community.',
        canRequest: permission.canRequest,
        requireApproval: permission.requireApproval,
        error: {
          code: ERROR_CODES.FORBIDDEN,
          message: permission.reason || 'You do not have permission to post in this community.',
          canRequest: permission.canRequest,
        },
      });
    }

    req.community = community;
    req.requireApproval = permission.requireApproval;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Moderation gate for community-scoped moderation surfaces.
 * When `permission` is provided, moderators must hold that exact delegated
 * permission for the exact community; Head/Platform Admin always pass.
 */
export const checkModeratorPermission = (permission = null) => async (req, res, next) => {
  try {
    const communityId = req.params.communityId || req.params.id || req.body.communityId;
    if (!communityId) {
      return res.status(400).json({
        success: false,
        message: 'Community identifier is required for moderation action.',
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Community identifier required.' },
      });
    }

    let query = communityId.match(/^[0-9a-fA-F]{24}$/) ? { _id: communityId } : { slug: communityId.toLowerCase() };
    const community = await Community.findOne(query);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found.',
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Community not found.' },
      });
    }

    const isAuthorized = permission
      ? await permissionService.hasDelegatedPermission(req.user, community, permission)
      : await permissionService.canModerate(req.user, community);

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Moderator or Community Head privileges required for this community.',
        error: {
          code: ERROR_CODES.FORBIDDEN,
          message: 'Moderator or Community Head privileges required for this community.',
        },
      });
    }

    req.community = community;
    next();
  } catch (error) {
    next(error);
  }
};
