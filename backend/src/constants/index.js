export const VISIBILITY = {
  PUBLIC: 'PUBLIC',
  MEMBERS_ONLY: 'MEMBERS_ONLY',
};

export const POST_POLICY = {
  EVERYONE: 'EVERYONE',
  MEMBERS: 'MEMBERS',
  APPROVED_USERS: 'APPROVED_USERS',
  HEAD_MODS: 'HEAD_MODS',
  CUSTOM: 'CUSTOM',
};

export const COMMENT_POLICY = {
  EVERYONE: 'EVERYONE',
  MEMBERS: 'MEMBERS',
  APPROVED_USERS: 'APPROVED_USERS',
  HEAD_MODS: 'HEAD_MODS',
  CUSTOM: 'CUSTOM',
};

export const SHARE_POLICY = {
  EVERYONE: 'EVERYONE',
  MEMBERS: 'MEMBERS',
  DISABLED: 'DISABLED',
};

export const USER_ROLES = {
  ADMIN: 'admin',
  FACULTY: 'faculty',
  STUDENT: 'student',
};

export const COMMUNITY_MEMBER_ROLES = {
  OWNER: 'owner',
  MODERATOR: 'moderator',
  MEMBER: 'member',
  APPROVED_USER: 'approved_user',
};

export const POST_TYPES = {
  DISCUSSION: 'discussion',
  RESOURCE: 'resource',
  ANNOUNCEMENT: 'announcement',
  QUESTION: 'question',
};

export const ATTACHMENT_TYPES = {
  IMAGE: 'image',
  VIDEO: 'video',
  FILE: 'file',
  FOLDER: 'folder',
};

export const POST_REQUEST_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CLARIFICATION: 'clarification',
};

export const CONTENT_STATUS = {
  ACTIVE: 'published',
  PUBLISHED: 'published',
  EDITED: 'edited',
  LOCKED: 'locked',
  HIDDEN: 'hidden',
  REMOVED: 'removed',
  DELETED: 'deleted',
  PENDING: 'pending',
  REJECTED: 'rejected',
};

export const COMMUNITY_CATEGORIES = [
  'CSE',
  'ECE',
  'Placement',
  'Clubs',
  'Events',
  'Hostel',
  'Academics',
  'Sports',
  'General',
];

export const AUDIT_ACTIONS = {
  UPDATE_SETTINGS: 'update_settings',
  PIN_POST: 'pin_post',
  UNPIN_POST: 'unpin_post',
  DELETE_POST: 'delete_post',
  LOCK_POST: 'lock_post',
  UNLOCK_POST: 'unlock_post',
  DELETE_COMMENT: 'delete_comment',
  APPROVE_POST: 'approve_post',
  REJECT_POST: 'reject_post',
  REQUEST_CLARIFICATION: 'request_clarification',
  DELETE_ACCOUNT: 'delete_account',
  BAN_MEMBER: 'ban_member',
  UNBAN_MEMBER: 'unban_member',
  CHANGE_ROLE: 'change_role',
  TRANSFER_OWNERSHIP: 'transfer_ownership',
  APPROVE_JOIN_REQUEST: 'approve_join_request',
  REJECT_JOIN_REQUEST: 'reject_join_request',
};

export const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  SERVER_ERROR: 'SERVER_ERROR',
};

export const DELEGATED_PERMISSIONS = {
  PIN_POSTS: 'pin_posts',
  LOCK_POSTS: 'lock_posts',
  MANAGE_REQUESTS: 'manage_requests',
  DELETE_POSTS: 'delete_posts',
  MANAGE_RULES: 'manage_rules',
  MARK_ACCEPTED_ANSWERS: 'mark_accepted_answers',
};
