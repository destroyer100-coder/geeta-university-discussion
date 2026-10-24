import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: {
      type: String,
      enum: ['post', 'comment', 'user'],
      required: true,
    },
    targetId: { type: String, required: true },
    reason: { type: String, required: true },
    details: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
      default: 'pending',
    },
    reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    community: { type: mongoose.Schema.Types.ObjectId, ref: 'Community', default: null },
  },
  { timestamps: true }
);

reportSchema.index({ community: 1, createdAt: -1 });
reportSchema.index({ targetId: 1, targetType: 1 });

export const Report = mongoose.model('Report', reportSchema);
