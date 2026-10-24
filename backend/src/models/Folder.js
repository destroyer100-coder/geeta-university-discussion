import mongoose from 'mongoose';

const folderSchema = new mongoose.Schema(
  {
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
    parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
    name: { type: String, required: true },
    relativePath: { type: String, required: true },
  },
  { timestamps: true }
);

export const Folder = mongoose.model('Folder', folderSchema);
