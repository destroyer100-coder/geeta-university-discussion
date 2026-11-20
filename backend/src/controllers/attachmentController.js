import path from 'path';
import { Attachment } from '../models/Attachment.js';
import { permissionService } from '../services/permissionService.js';
import { saveUpload, getUploadInfo, openUploadDownloadStream, deleteUpload, isValidUploadId } from '../services/gridfsStorage.js';
import {
  ERROR_CODES, VISIBILITY, DELEGATED_PERMISSIONS, CONTENT_STATUS,
} from '../constants/index.js';

const PUBLIC_POST_STATUSES = new Set([CONTENT_STATUS.PUBLISHED, CONTENT_STATUS.EDITED, CONTENT_STATUS.LOCKED]);
const REMOVED_POST_STATUSES = new Set([CONTENT_STATUS.DELETED, CONTENT_STATUS.REMOVED]);
const isSafeFilename = (value) => typeof value === 'string' && value.length > 0 &&
  value === path.basename(value) && !value.includes('/') && !value.includes('\\') && !value.includes('\0');

const getAttachmentAccessFailure = async (req, attachment) => {
  const post = attachment?.post;
  if (!post || REMOVED_POST_STATUSES.has(post.status)) return 'not_found';
  const isAuthor = Boolean(req.user && post.author && post.author.toString() === req.user._id.toString());
  const isAdmin = req.user?.role === 'admin';
  if (!PUBLIC_POST_STATUSES.has(post.status)) {
    const canReview = await permissionService.hasDelegatedPermission(req.user, post.community, DELEGATED_PERMISSIONS.MANAGE_REQUESTS);
    if (!isAuthor && !isAdmin && !canReview) return 'not_found';
  }
  if (post.community?.permissions?.visibility === VISIBILITY.MEMBERS_ONLY) {
    const hasAccess = await permissionService.canAccessAttachment(req.user, attachment, post, post.community);
    if (!hasAccess) return 'forbidden';
  }
  return null;
};

const respondToAttachmentAccessFailure = (res, failure) => {
  if (failure === 'forbidden') return res.status(403).json({
    success: false,
    message: 'Access denied: This attachment belongs to a private discussion or community.',
    error: { code: ERROR_CODES.FORBIDDEN, message: 'Private attachment' },
  });
  return res.status(404).json({
    success: false,
    message: 'Attachment not found or no longer available.',
    error: { code: ERROR_CODES.NOT_FOUND, message: 'Attachment not found.' },
  });
};

const detectFileType = (buffer, ext) => {
  const starts = (...bytes) => bytes.every((byte, index) => buffer[index] === byte);
  if (['.jpg', '.jpeg'].includes(ext) && starts(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (ext === '.png' && starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (ext === '.gif' && (buffer.subarray(0, 6).toString() === 'GIF87a' || buffer.subarray(0, 6).toString() === 'GIF89a')) return 'image/gif';
  if (ext === '.webp' && buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  if (ext === '.pdf' && buffer.subarray(0, 5).toString() === '%PDF-') return 'application/pdf';
  if (['.zip', '.docx', '.xlsx', '.pptx'].includes(ext) && starts(0x50, 0x4b, 0x03, 0x04)) return 'application/zip';
  if (['.doc', '.xls', '.ppt'].includes(ext) && starts(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)) return 'application/ole';
  if (['.txt', '.csv'].includes(ext) && !buffer.includes(0)) return ext === '.txt' ? 'text/plain' : 'text/csv';
  return null;
};

const MIME_BY_EXTENSION = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp',
  '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8', '.csv': 'text/csv; charset=utf-8',
  '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.zip': 'application/zip',
};

export const uploadFiles = async (req, res, next) => {
  const storedIds = [];
  try {
    if (!Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded.', error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'No files provided.' } });
    }
    const uploaded = [];
    for (const file of req.files) {
      const ext = path.extname(file.originalname).toLowerCase();
      const detectedMime = detectFileType(file.buffer, ext);
      const officeZip = detectedMime === 'application/zip' && ['.docx', '.xlsx', '.pptx'].includes(ext);\n      const legacyOffice = detectedMime === 'application/ole' && ['.doc', '.xls', '.ppt'].includes(ext);\n      const csvMime = ext === '.csv' && ['text/csv', 'application/vnd.ms-excel'].includes(file.mimetype);\n      if (!detectedMime || (detectedMime !== file.mimetype && !officeZip && !legacyOffice && !csvMime)) {
        const error = new Error('The uploaded file content does not match an allowed file type.');
        error.statusCode = 400;
        throw error;
      }
      const type = detectedMime.startsWith('image/') ? 'image' : 'file';
      const safeOriginalName = file.originalname.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 255);
      const storageKey = await saveUpload({
        buffer: file.buffer,
        filename: `u-${req.user._id}-${Date.now()}-${uploaded.length}${ext}`,
        contentType: file.mimetype,
        ownerId: req.user._id,
        originalName: safeOriginalName,
      });
      storedIds.push(storageKey);
      uploaded.push({
        originalName: safeOriginalName,
        filename: storageKey,
        storageKey,
        mimeType: file.mimetype,
        size: file.size,
        type,
        url: `/api/uploads/${storageKey}`,
        relativePath: req.body.relativePaths?.[file.originalname] || safeOriginalName,
        folderRelativePath: req.body.folderRelativePaths?.[file.originalname] || '',
      });
    }
    return res.status(201).json({ success: true, message: `${uploaded.length} file(s) uploaded successfully.`, data: uploaded });
  } catch (error) {
    await Promise.allSettled(storedIds.map(deleteUpload));
    return next(error);
  }
};

export const serveFile = async (req, res, next) => {
  try {
    const { filename } = req.params;
    if (!isSafeFilename(filename) || !isValidUploadId(filename)) {
      return res.status(404).json({ success: false, message: 'File not found.', error: { code: ERROR_CODES.NOT_FOUND, message: 'File not found.' } });
    }
    const attachment = await Attachment.findOne({ storageKey: filename }).populate({ path: 'post', populate: { path: 'community' } });
    const accessFailure = await getAttachmentAccessFailure(req, attachment);
    if (accessFailure) return respondToAttachmentAccessFailure(res, accessFailure);
    const fileInfo = await getUploadInfo(filename);
    if (!fileInfo) return res.status(404).json({ success: false, message: 'File not found in storage.', error: { code: ERROR_CODES.NOT_FOUND, message: 'File not found.' } });

    const fileSize = fileInfo.length;
    const ext = path.extname(fileInfo.filename || '').toLowerCase();
    const mimeType = MIME_BY_EXTENSION[ext] || 'application/octet-stream';
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', mimeType);
    const range = req.headers.range;
    let options = {};
    if (range) {
      const match = typeof range === 'string' ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
      if (!match || (!match[1] && !match[2]) || range.includes(',')) {
        res.setHeader('Content-Range', `bytes */${fileSize}`);
        return res.status(416).end();
      }
      let start = match[1] ? Number(match[1]) : Math.max(fileSize - Number(match[2]), 0);
      let end = match[2] && match[1] ? Number(match[2]) : fileSize - 1;
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= fileSize || end >= fileSize) {
        res.setHeader('Content-Range', `bytes */${fileSize}`);
        return res.status(416).end();
      }
      options = { start, end };
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Content-Length', end - start + 1);
    } else {
      res.status(200);
      res.setHeader('Content-Length', fileSize);
    }
    const stream = openUploadDownloadStream(filename, options);
    stream.on('error', (error) => {
      if (!res.headersSent) next(error);
      else res.destroy(error);
    });
    return stream.pipe(res);
  } catch (error) {
    next(error);
  }
};

export const getAttachmentById = async (req, res, next) => {
  try {
    const attachment = await Attachment.findById(req.params.id).populate({ path: 'post', populate: { path: 'community' } });
    if (!attachment) return res.status(404).json({ success: false, message: 'Attachment not found.', error: { code: ERROR_CODES.NOT_FOUND, message: 'Attachment not found.' } });
    const failure = await getAttachmentAccessFailure(req, attachment);
    if (failure) return respondToAttachmentAccessFailure(res, failure);
    return res.json({ success: true, data: attachment });
  } catch (error) { next(error); }
};

export const deleteAttachment = async (req, res, next) => {
  try {
    const attachment = await Attachment.findById(req.params.id).populate({ path: 'post', populate: { path: 'community' } });
    if (!attachment) return res.status(404).json({ success: false, message: 'Attachment not found.', error: { code: ERROR_CODES.NOT_FOUND, message: 'Attachment not found.' } });
    const isAuthor = attachment.post && req.user && attachment.post.author.toString() === req.user._id.toString();
    const isMod = attachment.post && await permissionService.hasDelegatedPermission(req.user, attachment.post.community, DELEGATED_PERMISSIONS.DELETE_POSTS);
    const isAdmin = req.user?.role === 'admin';
    if (!isAuthor && !isMod && !isAdmin) return res.status(403).json({ success: false, message: 'Unauthorized to delete this attachment.', error: { code: ERROR_CODES.FORBIDDEN, message: 'Unauthorized' } });
    if (isValidUploadId(attachment.storageKey)) await deleteUpload(attachment.storageKey);
    await Attachment.deleteOne({ _id: attachment._id });
    return res.json({ success: true, message: 'Attachment removed successfully.' });
  } catch (error) { next(error); }
};
