import fs from 'fs/promises';
import path from 'path';
import { UPLOAD_DIR } from '../config/env.js';
import { Attachment } from '../models/Attachment.js';

const STAGED_UPLOAD_PATTERN = /^u-[a-f0-9]{24}-[a-f0-9]{32}\.[a-z0-9]{1,10}$/i;
const UPLOAD_SUBDIRECTORIES = ['images', 'videos', 'files'];
const STAGED_UPLOAD_MAX_AGE_MS = 24 * 60 * 60 * 1000;

// Remove only old, server-generated uploads that have never been attached to a post.
// Referenced files (including tombstoned posts) are retained for audit/history policy.
export const cleanupStagedUploads = async () => {
  const cutoff = Date.now() - STAGED_UPLOAD_MAX_AGE_MS;
  let removed = 0;

  for (const directory of UPLOAD_SUBDIRECTORIES) {
    const absoluteDirectory = path.resolve(UPLOAD_DIR, directory);
    let entries;

    try {
      entries = await fs.readdir(absoluteDirectory, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }

    const candidates = [];
    for (const entry of entries) {
      if (!entry.isFile() || !STAGED_UPLOAD_PATTERN.test(entry.name)) continue;
      const filePath = path.resolve(absoluteDirectory, entry.name);
      if (path.dirname(filePath) !== absoluteDirectory) continue;

      try {
        const stats = await fs.lstat(filePath);
        if (stats.isFile() && !stats.isSymbolicLink() && stats.mtimeMs < cutoff) {
          candidates.push({ name: entry.name, filePath });
        }
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }

    if (candidates.length === 0) continue;

    const referenced = new Set(
      await Attachment.distinct('storageKey', {
        storageKey: { $in: candidates.map((item) => item.name) },
      })
    );

    for (const candidate of candidates) {
      if (referenced.has(candidate.name)) continue;
      try {
        await fs.unlink(candidate.filePath);
        removed += 1;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
  }

  if (removed > 0) {
    console.info(`[Storage] Removed ${removed} expired unclaimed staged upload(s).`);
  }
  return removed;
};
