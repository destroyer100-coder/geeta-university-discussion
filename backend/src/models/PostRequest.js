import mongoose from 'mongoose';
import { POST_REQUEST_STATUS } from '../constants/index.js';

const postRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    community: { type: mongoose.Schema.Types.ObjectId, ref: 'Community', required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    reason: { type: String, default: '' },
    tags: [{ type: String }],
    status: {
      type: String,
      enum: Object.values(POST_REQUEST_STATUS),
      default: POST_REQUEST_STATUS.PENDING,
    },
    reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewNote: { type: String, default: '' },
    draftPayload: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

postRequestSchema.index({ community: 1, status: 1 });

export const PostRequest = mongoose.model('PostRequest', postRequestSchema);
