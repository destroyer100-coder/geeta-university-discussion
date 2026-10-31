import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User } from '../models/User.js';
import {
  EMAIL_VERIFICATION_REQUIRED,
  JWT_SECRET,
  UNIVERSITY_EMAIL_DOMAINS,
} from '../config/env.js';
import { sendVerificationEmail } from '../services/emailService.js';

const EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED';
const GENERIC_RESEND_MESSAGE = 'If the account exists and still needs verification, a verification email will be sent shortly.';

const generateToken = (user) => jwt.sign({ id: user._id, tokenVersion: user.tokenVersion || 0 }, JWT_SECRET, { expiresIn: '30d' });
const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const hashVerificationToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const createVerificationToken = () => crypto.randomBytes(32).toString('hex');
const isUniversityEmail = (email) => {
  const at = email.lastIndexOf('@');
  if (at < 1) return false;
  const domain = email.slice(at + 1).toLowerCase();
  return UNIVERSITY_EMAIL_DOMAINS.some((allowedDomain) => domain === allowedDomain);
};

const publicUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  verified: EMAIL_VERIFICATION_REQUIRED ? Boolean(user.verified && user.emailVerifiedAt) : Boolean(user.verified),
  department: user.department,
  year: user.year,
  avatar: user.avatar,
  bio: user.bio,
});

const sendVerificationForUser = async (user) => {
  const rawToken = createVerificationToken();
  user.emailVerificationTokenHash = hashVerificationToken(rawToken);
  user.emailVerificationExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
  user.emailVerificationSentAt = new Date();
  await user.save();
  await sendVerificationEmail({ to: user.email, name: user.name, token: rawToken });
};

export const register = async (req, res, next) => {
  try {
    const name = req.body.name.trim();
    const email = normalizeEmail(req.body.email);
    const { password, department, year } = req.body;

    if (EMAIL_VERIFICATION_REQUIRED && !isUniversityEmail(email)) {
      return res.status(400).json({
        success: false,
        message: `Use your university email address (${UNIVERSITY_EMAIL_DOMAINS.join(', ')}).`,
      });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      name,
      email,
      passwordHash,
      role: 'student',
      department: department || 'Computer Science & Engineering',
      year: year || '3rd Year',
      verified: !EMAIL_VERIFICATION_REQUIRED,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
    });

    if (EMAIL_VERIFICATION_REQUIRED) {
      try {
        await sendVerificationForUser(user);
      } catch (mailError) {
        console.error('[Email verification] Delivery failed; resend is available:', mailError.message);
        return res.status(503).json({
          success: false,
          verificationRequired: true,
          message: 'Your account was created, but verification email delivery failed. Please try resending the verification email shortly.',
        });
      }

      return res.status(201).json({
        success: true,
        verificationRequired: true,
        message: 'Account created. Check your university inbox for the verification link before signing in.',
        user: publicUser(user),
      });
    }

    const token = generateToken(user);
    return res.status(201).json({ success: true, token, user: publicUser(user) });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;
    const user = await User.findOne({ email, isDeleted: { $ne: true } }).select('+passwordHash +tokenVersion');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (user.isActive === false) {\n      return res.status(403).json({ success: false, message: 'This account has been deactivated. Contact platform administration.' });\n    }\n\n    if (EMAIL_VERIFICATION_REQUIRED && (!user.verified || !user.emailVerifiedAt)) {
      return res.status(403).json({
        success: false,
        message: 'Verify your university email before signing in.',
        error: { code: EMAIL_NOT_VERIFIED, message: 'Verify your university email before signing in.' },
      });
    }

    return res.json({ success: true, token: generateToken(user), user: publicUser(user) });
  } catch (error) {
    next(error);
  }
};

export const verifyEmail = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const tokenHash = hashVerificationToken(req.body.token);
    const user = await User.findOneAndUpdate(
      {
        email,
        emailVerificationTokenHash: tokenHash,
        emailVerificationExpiresAt: { $gt: new Date() },
        isDeleted: { $ne: true },
      },
      {
        $set: { verified: true, emailVerifiedAt: new Date() },
        $unset: {
          emailVerificationTokenHash: 1,
          emailVerificationExpiresAt: 1,
          emailVerificationSentAt: 1,
        },
      },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'This verification link is invalid, expired, or has already been used. Request a new link and try again.',
      });
    }

    return res.json({ success: true, message: 'University email verified. You can now sign in.' });
  } catch (error) {
    next(error);
  }
};

export const resendVerificationEmail = async (req, res, next) => {
  const email = normalizeEmail(req.body.email);
  try {
    if (!EMAIL_VERIFICATION_REQUIRED || !isUniversityEmail(email)) {
      return res.json({ success: true, message: GENERIC_RESEND_MESSAGE });
    }

    const user = await User.findOne({
      email,
      isDeleted: { $ne: true },
      $or: [
        { verified: { $ne: true } },
        { emailVerifiedAt: null },
        { emailVerifiedAt: { $exists: false } },
      ],
    }).select('+emailVerificationTokenHash +emailVerificationExpiresAt +emailVerificationSentAt');

    if (!user) return res.json({ success: true, message: GENERIC_RESEND_MESSAGE });

    const lastSentAt = user.emailVerificationSentAt?.getTime?.() || 0;
    if (Date.now() - lastSentAt < 60 * 1000) {
      return res.status(429).json({ success: false, message: 'Please wait at least one minute before requesting another verification email.' });
    }

    try {
      await sendVerificationForUser(user);
    } catch (mailError) {
      console.error('[Email verification] Resend delivery failed:', mailError.message);
      // Avoid confirming account existence or SMTP details to the requester.
    }

    return res.json({ success: true, message: GENERIC_RESEND_MESSAGE });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user || user.isDeleted) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    return res.json({ success: true, user: publicUser(user) });
  } catch (error) {
    next(error);
  }
};
