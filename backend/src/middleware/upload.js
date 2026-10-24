import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { UPLOAD_DIR } from '../config/env.js';
import { sanitizeFileName } from '../config/storage.js';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let subfolder = 'files';
    if (file.mimetype.startsWith('image/')) {
      subfolder = 'images';
    } else if (file.mimetype.startsWith('video/')) {
      subfolder = 'videos';
    }
    cb(null, path.join(UPLOAD_DIR, subfolder));
  },
  filename: (req, file, cb) => {
    const cleanName = sanitizeFileName(file.originalname);
    const ext = path.extname(cleanName).toLowerCase();
    const ownerId = req.user?._id?.toString();

    if (!/^[a-f0-9]{24}$/i.test(ownerId || '') || !ext) {
      return cb(new Error('Authenticated uploader and a valid file extension are required.'));
    }

    // A server-generated, owner-bound storage key allows createPost to reject
    // another user's staged upload without trusting client-provided metadata.
    const uniqueSuffix = crypto.randomBytes(16).toString('hex');
    cb(null, `u-${ownerId}-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = {
    '.jpg': ['image/jpeg'],
    '.jpeg': ['image/jpeg'],
    '.png': ['image/png'],
    '.gif': ['image/gif'],
    '.webp': ['image/webp'],
    '.mp4': ['video/mp4'],
    '.webm': ['video/webm'],
    '.mov': ['video/quicktime'],
    '.pdf': ['application/pdf'],
    '.txt': ['text/plain'],
    '.csv': ['text/csv', 'application/vnd.ms-excel'],
    '.doc': ['application/msword'],
    '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    '.xls': ['application/vnd.ms-excel'],
    '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    '.ppt': ['application/vnd.ms-powerpoint'],
    '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    '.zip': ['application/zip', 'application/x-zip-compressed'],
  };

  const ext = path.extname(file.originalname).toLowerCase();
  const allowedMimes = allowedTypes[ext];

  if (!allowedMimes || !allowedMimes.includes(file.mimetype)) {
    return cb(new Error('This file type is not permitted for upload.'), false);
  }

  cb(null, true);
};

export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB per file
    files: 5,
    fields: 20,
    parts: 25,
    fieldNameSize: 100,
    fieldSize: 64 * 1024,
    // Supported by the patched Multer 2.2+ line; keep multipart field parsing bounded.
    fieldNestingDepth: 5,
    fieldArrayIndexLimit: 10,
  },
});
