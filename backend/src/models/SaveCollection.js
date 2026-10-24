import mongoose from 'mongoose';

const saveCollectionSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, default: 'All Saved' },
    items: [
      {
        post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
        savedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

saveCollectionSchema.index({ owner: 1 });

export const SaveCollection = mongoose.model('SaveCollection', saveCollectionSchema);
