import { Attachment } from '../models/Attachment.js';
import { Folder } from '../models/Folder.js';
import path from 'path';

export const storageService = {
  /**
   * Save attachment records and optionally link them to a folder hierarchy.
   */
  async processAttachments(files, postId) {
    if (!files || files.length === 0) return [];

    const savedAttachments = [];

    for (const file of files) {
      let type = 'file';
      if (file.mimetype.startsWith('image/')) type = 'image';
      else if (file.mimetype.startsWith('video/')) type = 'video';

      const attachment = await Attachment.create({
        post: postId,
        type,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storageKey: file.filename,
        url: `/api/uploads/${file.filename}`,
        status: 'ready',
      });

      savedAttachments.push(attachment);
    }

    return savedAttachments;
  },

  /**
   * Recreate folder tree hierarchy from client folder upload data
   */
  async processFolderHierarchy(postId, folderStructure) {
    if (!folderStructure || !Array.isArray(folderStructure) || folderStructure.length === 0) {
      return null;
    }

    const folderMap = new Map(); // path -> folderDoc

    // First create folder documents
    for (const item of folderStructure) {
      const parts = item.path.split('/').filter(Boolean);
      let currentPath = '';
      let parentId = null;

      for (let i = 0; i < parts.length; i++) {
        const folderName = parts[i];
        currentPath = currentPath ? `${currentPath}/${folderName}` : folderName;

        if (!folderMap.has(currentPath)) {
          let folderDoc = await Folder.findOne({ post: postId, relativePath: currentPath });
          if (!folderDoc) {
            folderDoc = await Folder.create({
              post: postId,
              parentFolder: parentId,
              name: folderName,
              relativePath: currentPath,
            });
          }
          folderMap.set(currentPath, folderDoc._id);
          parentId = folderDoc._id;
        } else {
          parentId = folderMap.get(currentPath);
        }
      }
    }

    return folderMap;
  },
};
