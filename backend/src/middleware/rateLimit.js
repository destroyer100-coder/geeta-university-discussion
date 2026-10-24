import { ERROR_CODES } from '../constants/index.js';

// In-memory bucket store for action-specific rate limiting
const store = new Map();

// Periodic cleanup of expired rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of store.entries()) {
    if (now - record.startTime > record.windowMs) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

export const rateLimit = ({
  windowMs = 60 * 1000,
  max = 120,
  message = 'Too many requests, please slow down and try again later.',
  actionKey = 'global',
} = {}) => {
  return (req, res, next) => {
    const identifier = req.user ? req.user._id.toString() : (req.ip || req.connection.remoteAddress || '127.0.0.1');
    const bucketKey = `${actionKey}:${identifier}`;
    const now = Date.now();

    let record = store.get(bucketKey);
    if (!record || now - record.startTime > windowMs) {
      record = { startTime: now, count: 1, windowMs };
      store.set(bucketKey, record);
      return next();
    }

    record.count++;
    if (record.count > max) {
      return res.status(429).json({
        success: false,
        message,
        error: {
          code: ERROR_CODES.RATE_LIMITED,
          message,
          retryAfterMs: Math.max(0, record.windowMs - (now - record.startTime)),
        },
      });
    }

    next();
  };
};

// Action-specific rate limiters
export const postLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  actionKey: 'create_post',
  message: 'Posting rate limit reached. You can publish up to 10 posts every 10 minutes.',
});

export const commentLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 25,
  actionKey: 'create_comment',
  message: 'Comment rate limit reached. Please wait a few minutes before commenting again.',
});

export const messageLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  actionKey: 'send_message',
  message: 'Messaging rate limit reached to prevent spam. Please slow down.',
});

export const reportLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  actionKey: 'submit_report',
  message: 'Report submission limit reached. Please wait before submitting additional reports.',
});

export const uploadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  actionKey: 'file_upload',
  message: 'Upload rate limit reached. Max 20 files per 5 minutes.',
});

export const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  actionKey: 'search_query',
  message: 'Search query rate limit reached. Please try again shortly.',
});

// Duplicate action protection (Point 12)
const recentSubmissions = new Map();

export const preventDuplicateSubmission = (windowSeconds = 15) => {
  return (req, res, next) => {
    if (!req.user || !req.body) return next();

    const textToFingerprint = [req.body.title, req.body.body, req.body.targetId]
      .filter(Boolean)
      .join('::')
      .trim();

    if (!textToFingerprint) return next();

    const userKey = `${req.user._id.toString()}:${req.baseUrl + req.path}:${textToFingerprint}`;
    const now = Date.now();
    const lastSubmission = recentSubmissions.get(userKey);

    if (lastSubmission && now - lastSubmission < windowSeconds * 1000) {
      return res.status(409).json({
        success: false,
        message: 'Duplicate submission detected. Please wait a moment before resubmitting.',
        error: {
          code: ERROR_CODES.CONFLICT,
          message: 'Duplicate submission detected. Please wait a moment before resubmitting.',
        },
      });
    }

    recentSubmissions.set(userKey, now);

    // Prune entries older than 60s
    setTimeout(() => {
      recentSubmissions.delete(userKey);
    }, windowSeconds * 1000);

    next();
  };
};
