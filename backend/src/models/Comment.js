import mongoose from 'mongoose';
import { CONTENT_STATUS } from '../constants/index.js';

const commentSchema = new mongoose.Schema(
  {
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    parentComment: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
    body: { type: String, required: true },
    status: {
      type: String,
      enum: ['published', 'edited', 'locked', 'removed', 'deleted'],
      default: 'published',
    },
    isAccepted: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null },
    moderationNote: { type: String, default: '' },
    editHistory: [
      {
        editedAt: { type: Date, default: Date.now },
        previousBody: { type: String },
      },
    ],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    helpfulVotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

commentSchema.index({ post: 1, createdAt: 1 });
commentSchema.index({ author: 1 });

export const Comment = mongoose.model('Comment', commentSchema);
