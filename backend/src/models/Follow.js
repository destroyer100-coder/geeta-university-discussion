import mongoose from 'mongoose';

const followSchema = new mongoose.Schema(
  {
    follower: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: {
      type: String,
      enum: ['user', 'community'],
      required: true,
    },
    targetId: { type: String, required: true },
  },
  { timestamps: true }
);

followSchema.index({ follower: 1, targetType: 1, targetId: 1 }, { unique: true });

export const Follow = mongoose.model('Follow', followSchema);
