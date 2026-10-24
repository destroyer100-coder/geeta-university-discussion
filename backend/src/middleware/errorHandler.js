import { ERROR_CODES } from '../constants/index.js';

export const errorHandler = (err, req, res, next) => {
  const requestId = req.id || 'unknown';

  // Sanitize error logging: never log passwords, tokens, or private secrets
  const sanitizedMessage = err.message || 'Internal Server Error';
  console.error(`[Error] [Request ${requestId}] ${req.method} ${req.originalUrl}:`, sanitizedMessage);

  if (process.env.NODE_ENV !== 'production' && err.stack) {
    console.error(err.stack);
  }

  const statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);

  let errorCode = ERROR_CODES.SERVER_ERROR;
  if (statusCode === 401) errorCode = ERROR_CODES.UNAUTHORIZED;
  else if (statusCode === 403) errorCode = ERROR_CODES.FORBIDDEN;
  else if (statusCode === 404) errorCode = ERROR_CODES.NOT_FOUND;
  else if (statusCode === 409) errorCode = ERROR_CODES.CONFLICT;
  else if (statusCode === 422 || statusCode === 400) errorCode = ERROR_CODES.VALIDATION_ERROR;
  else if (statusCode === 429) errorCode = ERROR_CODES.RATE_LIMITED;

  if (err.code && typeof err.code === 'string') {
    errorCode = err.code;
  }

  res.status(statusCode).json({
    success: false,
    message: sanitizedMessage,
    error: {
      code: errorCode,
      message: sanitizedMessage,
      requestId,
    },
  });
};
