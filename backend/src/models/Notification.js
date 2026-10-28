import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['like', 'comment', 'reply', 'accepted_answer', 'post_request', 'join_request', 'request_approved', 'request_rejected', 'request_clarification', 'announcement'],
      required: true,
    },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    target: {
      modelType: { type: String, default: 'Post' },
      id: { type: String },
      title: { type: String, default: '' },
    },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);
