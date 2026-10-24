import jwt from 'jsonwebtoken';
import { EMAIL_VERIFICATION_REQUIRED, JWT_SECRET } from '../config/env.js';
import { User } from '../models/User.js';

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await User.findById(decoded.id);
if (!user || user.isDeleted) {
  return res.status(401).json({
    success: false,
    message: 'User not found, account deleted, or token expired.',
  });
}

    if (EMAIL_VERIFICATION_REQUIRED && (!user.verified || !user.emailVerifiedAt)) {
      return res.status(403).json({
        success: false,
        message: 'Verify your university email before accessing the platform.',
        error: { code: 'EMAIL_NOT_VERIFIED', message: 'Verify your university email before accessing the platform.' },
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);
if (user && !user.isDeleted && (!EMAIL_VERIFICATION_REQUIRED || (user.verified && user.emailVerifiedAt))) {
  req.user = user;
}
    }
  } catch (error) {
    // Ignore error for optional auth
  }
  next();
};
