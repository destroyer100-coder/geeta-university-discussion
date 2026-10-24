import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema(
  {
    community: { type: mongoose.Schema.Types.ObjectId, ref: 'Community', required: true },
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    time: { type: String, default: '10:00 AM' },
    venue: { type: String, required: true },
    description: { type: String, default: '' },
    category: { type: String, default: 'Workshop' },
    attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

export const Event = mongoose.model('Event', eventSchema);
