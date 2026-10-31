import jwt from 'jsonwebtoken';
import { EMAIL_VERIFICATION_REQUIRED, JWT_SECRET } from '../config/env.js';
import { User } from '../models/User.js';

const TOKEN_ALGORITHMS = ['HS256'];
const USER_ID_PATTERN = /^[a-f\d]{24}$/i;

const verifyAccessToken = (token) => {
  if (!token || typeof token !== 'string' || token.length > 8192) {
    throw new Error('Invalid access token.');
  }

  const decoded = jwt.verify(token, JWT_SECRET, { algorithms: TOKEN_ALGORITHMS });
  if (!decoded || typeof decoded !== 'object' || !USER_ID_PATTERN.test(decoded.id || '')) {
    throw new Error('Invalid access token subject.');
  }
  return decoded;
};

const isVerifiedForAccess = (user) =>
  !EMAIL_VERIFICATION_REQUIRED || Boolean(user.verified && user.emailVerifiedAt);

const canUseAccount = (user, decoded) =>
  user && !user.isDeleted && user.isActive !== false &&
  Number(decoded.tokenVersion ?? 0) === Number(user.tokenVersion ?? 0);

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
    }

    const decoded = verifyAccessToken(authHeader.slice(7).trim());
    const user = await User.findById(decoded.id).select('+tokenVersion');

    if (!canUseAccount(user, decoded)) {
      return res.status(401).json({
        success: false,
        message: 'Your account is unavailable or your session has been revoked. Please sign in again.',
      });
    }

    if (!isVerifiedForAccess(user)) {
      return res.status(403).json({
        success: false,
        message: 'Verify your university email before accessing the platform.',
        error: { code: 'EMAIL_NOT_VERIFIED', message: 'Verify your university email before accessing the platform.' },
      });
    }

    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const decoded = verifyAccessToken(authHeader.slice(7).trim());
      const user = await User.findById(decoded.id).select('+tokenVersion');
      if (canUseAccount(user, decoded) && isVerifiedForAccess(user)) req.user = user;
    }
  } catch (error) {
    // Public endpoints remain public when an optional token is invalid.
  }
  return next();
};
