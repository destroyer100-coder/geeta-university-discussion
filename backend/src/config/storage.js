import fs from 'fs';
import path from 'path';
import { UPLOAD_DIR } from './env.js';

export const initStorage = () => {
  const dirs = [
    UPLOAD_DIR,
    path.join(UPLOAD_DIR, 'images'),
    path.join(UPLOAD_DIR, 'videos'),
    path.join(UPLOAD_DIR, 'files'),
    path.join(UPLOAD_DIR, 'folders'),
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  console.log(`[Storage] Storage directories initialized at: ${UPLOAD_DIR}`);
};

export const sanitizeFileName = (fileName) => {
  // Remove any path traversal characters and non-standard symbols
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
};
