import path from 'path';
import fs from 'fs';
import { Attachment } from '../models/Attachment.js';
import { permissionService } from '../services/permissionService.js';
import { UPLOAD_DIR } from '../config/env.js';
import {
  ERROR_CODES,
  VISIBILITY,
  DELEGATED_PERMISSIONS,
  CONTENT_STATUS,
} from '../constants/index.js';

const PUBLIC_POST_STATUSES = new Set([
  CONTENT_STATUS.PUBLISHED,
  CONTENT_STATUS.EDITED,
  CONTENT_STATUS.LOCKED,
]);
const REMOVED_POST_STATUSES = new Set([CONTENT_STATUS.DELETED, CONTENT_STATUS.REMOVED]);
const UPLOAD_DIRECTORY_BY_TYPE = { image: 'images', video: 'videos', file: 'files' };

const isSafeFilename = (filename) =>
  typeof filename === 'string' &&
  filename.length > 0 &&
  filename === path.basename(filename) &&
  !filename.includes('/') &&
  !filename.includes('\\') &&
  !filename.includes('\0') &&
  filename !== '.' &&
  filename !== '..';

// Support legacy records where a URL was mistakenly stored as storageKey, but
// accept only the exact local upload URL shape and never arbitrary paths.
const normalizeStorageKey = (value) => {
  if (isSafeFilename(value)) return value;
  if (typeof value !== 'string') return null;
  const legacyMatch = /^\/api\/uploads\/([^/\\\0]+)$/.exec(value);
  return legacyMatch && isSafeFilename(legacyMatch[1]) ? legacyMatch[1] : null;
};

const isContainedPath = (root, candidate) => {
  const relative = path.relative(root, candidate);
  return relative !== '' &&
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative);
};

const findRegularUploadFile = (filename, type) => {
  const uploadRoot = path.resolve(UPLOAD_DIR);
  const preferredDirectory = UPLOAD_DIRECTORY_BY_TYPE[type];
  const roots = preferredDirectory
    ? [path.resolve(uploadRoot, preferredDirectory), uploadRoot]
    : [uploadRoot];

  for (const root of roots) {
    const candidate = path.resolve(root, filename);
    if (!isContainedPath(root, candidate) || path.dirname(candidate) !== root) continue;

    try {
      const stats = fs.lstatSync(candidate);
      if (stats.isFile() && !stats.isSymbolicLink()) return { path: candidate, stats };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  return null;
};

const getAttachmentAccessFailure = async (req, attachment) => {
  const post = attachment?.post;
  if (!post || REMOVED_POST_STATUSES.has(post.status)) return 'not_found';

  const isAuthor = Boolean(
    req.user && post.author && post.author.toString() === req.user._id.toString()
  );
  const isAdmin = req.user?.role === 'admin';

  // Hidden, pending, rejected, archived, and unknown states are not public.
  if (!PUBLIC_POST_STATUSES.has(post.status)) {
    const canReview = await permissionService.hasDelegatedPermission(
      req.user,
      post.community,
      DELEGATED_PERMISSIONS.MANAGE_REQUESTS
    );
    if (!isAuthor && !isAdmin && !canReview) return 'not_found';
  }

  if (post.community?.permissions?.visibility === VISIBILITY.MEMBERS_ONLY) {
    const hasAccess = await permissionService.canAccessAttachment(
      req.user,
      attachment,
      post,
      post.community
    );
    if (!hasAccess) return 'forbidden';
  }

  return null;
};

const respondToAttachmentAccessFailure = (res, failure) => {
  if (failure === 'forbidden') {
    return res.status(403).json({
      success: false,
      message: 'Access denied: This attachment belongs to a private discussion or community.',
      error: { code: ERROR_CODES.FORBIDDEN, message: 'Private attachment' },
    });
  }
  return res.status(404).json({
    success: false,
    message: 'Attachment not found or no longer available.',
    error: { code: ERROR_CODES.NOT_FOUND, message: 'Attachment not found.' },
  });
};

export const uploadFiles = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded.',
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'No files provided.' },
      });
    }

    const uploaded = req.files.map((file) => {
      let type = 'file';
      if (file.mimetype.startsWith('image/')) type = 'image';
      else if (file.mimetype.startsWith('video/')) type = 'video';

      return {
        originalName: file.originalname,
        filename: file.filename, // Generated secure key from multer
        storageKey: file.filename,
        mimeType: file.mimetype,
        size: file.size,
        type,
        url: `/api/uploads/${file.filename}`,
        relativePath: req.body.relativePaths?.[file.originalname] || file.originalname,
        folderRelativePath: req.body.folderRelativePaths?.[file.originalname] || '',
      };
    });

    res.status(201).json({
      success: true,
      message: `${uploaded.length} file(s) uploaded successfully.`,
      data: uploaded,
    });
  } catch (error) {
    next(error);
  }
};

// Derive response content types from a server-controlled extension allowlist;
// never trust a MIME type persisted from client-supplied attachment metadata.
const MIME_MAP = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

// Serve / stream uploaded files with Parent-Resource Authorization Check & HTTP Range Streaming (Points 15, 22)
export const serveFile = async (req, res, next) => {
  try {
    const { filename } = req.params;
    if (!isSafeFilename(filename)) {
      return res.status(404).json({
        success: false,
        message: 'File not found on storage.',
        error: { code: ERROR_CODES.NOT_FOUND, message: 'File not found.' },
      });
    }

    // Resolve metadata first so duplicate names in different storage folders
    // cannot cause a different attachment's file to be served.
    const attachment = await Attachment.findOne({
      $or: [{ storageKey: filename }, { storageKey: `/api/uploads/${filename}` }, { url: `/api/uploads/${filename}` }],
    }).populate({
      path: 'post',
      populate: { path: 'community' },
    });

    const accessFailure = await getAttachmentAccessFailure(req, attachment);
    if (accessFailure) return respondToAttachmentAccessFailure(res, accessFailure);

    const foundFile = findRegularUploadFile(filename, attachment.type);
    if (!foundFile) {
      return res.status(404).json({
        success: false,
        message: 'File not found on storage.',
        error: { code: ERROR_CODES.NOT_FOUND, message: 'File not found.' },
      });
    }

    const fileSize = foundFile.stats.size;
    const ext = path.extname(filename).toLowerCase();
    const mimeType = MIME_MAP[ext] || 'application/octet-stream';
    const range = req.headers.range;

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Accept-Ranges', 'bytes');

    if (range) {
      // Support one valid byte range. Malformed, multi-range, and unsatisfiable
      // requests receive 416 instead of reaching createReadStream with bad bounds.
      const match = typeof range === 'string' ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
      if (!match || (!match[1] && !match[2]) || range.includes(',')) {
        res.setHeader('Content-Range', `bytes */${fileSize}`);
        return res.status(416).end();
      }

      let start;
      let end;
      if (!match[1]) {
        const suffixLength = Number(match[2]);
        if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
          res.setHeader('Content-Range', `bytes */${fileSize}`);
          return res.status(416).end();
        }
        start = Math.max(fileSize - suffixLength, 0);
        end = fileSize - 1;
      } else {
        start = Number(match[1]);
        end = match[2] ? Number(match[2]) : fileSize - 1;
      }

      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) ||
        start < 0 || end < start || start >= fileSize || end >= fileSize) {
        res.setHeader('Content-Range', `bytes */${fileSize}`);
        return res.status(416).end();
      }

      const chunkSize = end - start + 1;
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Content-Length', chunkSize);
      res.setHeader('Content-Type', mimeType);
      const stream = fs.createReadStream(foundFile.path, { start, end });
      stream.on('error', next);
      return stream.pipe(res);
    }

    res.status(200);
    res.setHeader('Content-Length', fileSize);
    res.setHeader('Content-Type', mimeType);
    const stream = fs.createReadStream(foundFile.path);
    stream.on('error', next);
    return stream.pipe(res);
  } catch (error) {
    next(error);
  }
};

export const getAttachmentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const attachment = await Attachment.findById(id).populate({
      path: 'post',
      populate: { path: 'community' },
    });

    if (!attachment) {
      return res.status(404).json({
        success: false,
        message: 'Attachment not found.',
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Attachment not found.' },
      });
    }

    const accessFailure = await getAttachmentAccessFailure(req, attachment);
    if (accessFailure) return respondToAttachmentAccessFailure(res, accessFailure);

    res.json({ success: true, data: attachment });
  } catch (error) {
    next(error);
  }
};

export const deleteAttachment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const attachment = await Attachment.findById(id).populate({
      path: 'post',
      populate: { path: 'community' },
    });

    if (!attachment) {
      return res.status(404).json({
        success: false,
        message: 'Attachment not found.',
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Attachment not found.' },
      });
    }

    // Verify ownership or moderation privileges (moderators need the `delete_posts` delegation)
    const isAuthor = attachment.post && req.user && attachment.post.author.toString() === req.user._id.toString();
    const isMod =
      attachment.post &&
      (await permissionService.hasDelegatedPermission(
        req.user,
        attachment.post.community,
        DELEGATED_PERMISSIONS.DELETE_POSTS
      ));
    const isAdmin = req.user && req.user.role === 'admin';

    if (!isAuthor && !isMod && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to delete this attachment.',
        error: { code: ERROR_CODES.FORBIDDEN, message: 'Unauthorized' },
      });
    }

    // Refuse untrusted or legacy-malformed keys before constructing any path.
    const storageKey = normalizeStorageKey(attachment.storageKey);
    if (!storageKey) {
      return res.status(400).json({
        success: false,
        message: 'Attachment has an invalid storage key. No file was deleted.',
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Invalid attachment storage key.',
        },
      });
    }

    const uploadRoot = path.resolve(UPLOAD_DIR);
    const preferredDirectory = UPLOAD_DIRECTORY_BY_TYPE[attachment.type];
    const roots = preferredDirectory
      ? [path.resolve(uploadRoot, preferredDirectory), uploadRoot]
      : [uploadRoot];
    let fileRemoved = false;

    for (const root of roots) {
      const candidate = path.resolve(root, storageKey);
      if (!isContainedPath(root, candidate) || path.dirname(candidate) !== root) continue;

      try {
        const fileStats = fs.lstatSync(candidate);
        // Never unlink directories or symlinks. Unlink at most one exact file.
        if (!fileStats.isFile() || fileStats.isSymbolicLink()) continue;
        fs.unlinkSync(candidate);
        fileRemoved = true;
        break;
      } catch (fileError) {
        if (fileError.code !== 'ENOENT') throw fileError;
      }
    }

    // If the file is already missing, remove the stale database record only.
    await Attachment.deleteOne({ _id: attachment._id });

    res.json({
      success: true,
      message: fileRemoved ? 'Attachment removed successfully.' : 'Attachment record removed; file was already missing.',
    });
  } catch (error) {
    next(error);
  }
};
