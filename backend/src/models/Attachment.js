import mongoose from 'mongoose';
import { ATTACHMENT_TYPES } from '../constants/index.js';

const attachmentSchema = new mongoose.Schema(
  {
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
    folder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
    type: {
      type: String,
      enum: Object.values(ATTACHMENT_TYPES),
      required: true,
    },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    storageKey: { type: String, required: true },
    url: { type: String, required: true },
    relativePath: { type: String, default: '' },
    metadata: {
      width: Number,
      height: Number,
      duration: Number,
      thumbnail: String,
    },
    status: {
      type: String,
      enum: ['ready', 'processing', 'failed'],
      default: 'ready',
    },
  },
  { timestamps: true }
);

attachmentSchema.index({ post: 1 });

export const Attachment = mongoose.model('Attachment', attachmentSchema);
