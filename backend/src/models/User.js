import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ['admin', 'faculty', 'student'],
      default: 'student',
    },
    isActive: { type: Boolean, default: true, index: true },
    tokenVersion: { type: Number, default: 0, min: 0, select: false },
    verified: { type: Boolean, default: false },
    emailVerifiedAt: { type: Date, default: null },
    emailVerificationTokenHash: { type: String, select: false, default: null },
    emailVerificationExpiresAt: { type: Date, select: false, default: null },
    emailVerificationSentAt: { type: Date, select: false, default: null },
    department: { type: String, default: 'Computer Science & Engineering' },
    year: { type: String, default: '3rd Year' },
    bio: { type: String, default: '' },
    avatar: { type: String, default: '' },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

export const User = mongoose.model('User', userSchema);
