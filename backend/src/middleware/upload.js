import multer from 'multer';
import path from 'path';

const allowedTypes = {
  '.jpg': ['image/jpeg'], '.jpeg': ['image/jpeg'], '.png': ['image/png'],
  '.mp4': ['video/mp4'], '.webm': ['video/webm'],
  '.gif': ['image/gif'], '.webp': ['image/webp'],
  '.pdf': ['application/pdf'], '.txt': ['text/plain'],
  '.csv': ['text/csv', 'application/vnd.ms-excel'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.ppt': ['application/vnd.ms-powerpoint'],
  '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  '.zip': ['application/zip', 'application/x-zip-compressed'],
};

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mimes = allowedTypes[ext];
  if (!mimes || !mimes.includes(file.mimetype)) {
    return cb(Object.assign(new Error('Only photos and documents are allowed. Video uploads are disabled.'), { statusCode: 400 }));
  }
  cb(null, true);
};

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 5,
    fields: 20,
    parts: 25,
    fieldNameSize: 100,
    fieldSize: 64 * 1024,
    fieldNestingDepth: 5,
    fieldArrayIndexLimit: 10,
  },
});
