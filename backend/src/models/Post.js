import mongoose from 'mongoose';
import { POST_TYPES, CONTENT_STATUS } from '../constants/index.js';

const postSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    community: { type: mongoose.Schema.Types.ObjectId, ref: 'Community', default: null, required: false },
    type: {
      type: String,
      enum: Object.values(POST_TYPES),
      default: POST_TYPES.DISCUSSION,
    },
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true },
    tags: [{ type: String, trim: true }],
    status: {
      type: String,
      enum: Object.values(CONTENT_STATUS).concat(['archived']),
      default: CONTENT_STATUS.PUBLISHED,
    },
    isPinned: { type: Boolean, default: false },
    pinnedAt: { type: Date, default: null },
    pinnedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isAnnouncement: { type: Boolean, default: false },
    isAnonymous: { type: Boolean, default: false },
    allowComments: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isQuestion: { type: Boolean, default: false },
    rejectionReason: { type: String, default: '' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    editHistory: [
      {
        editedAt: { type: Date, default: Date.now },
        previousBody: { type: String },
      },
    ],
    linkPreview: {
      url: String,
      title: String,
      description: String,
      image: String,
      siteName: String,
    },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    saves: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    helpfulVotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    viewsCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

postSchema.index({ community: 1, isPinned: -1, createdAt: -1 });
postSchema.index({ status: 1, createdAt: -1 });
postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ title: 'text', body: 'text', tags: 'text' });

export const Post = mongoose.model('Post', postSchema);
