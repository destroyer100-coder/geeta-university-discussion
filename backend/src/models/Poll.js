import mongoose from 'mongoose';

const pollOptionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  votesCount: { type: Number, default: 0 },
});

const pollSchema = new mongoose.Schema(
  {
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true, unique: true },
    question: { type: String, required: true },
    options: [pollOptionSchema],
    expiresAt: { type: Date, default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
  },
  { timestamps: true }
);

export const Poll = mongoose.model('Poll', pollSchema);
