import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimit } from './middleware/rateLimit.js';
import { correlationIdMiddleware } from './middleware/correlationId.js';
import { initStorage } from './config/storage.js';
import { NODE_ENV, CORS_ORIGINS } from './config/env.js';

const app = express();

// Initialize disk storage for media uploads.
initStorage();

app.disable('x-powered-by');
app.use(correlationIdMiddleware);
app.use(cors({
  origin(origin, callback) {
    // Non-browser clients usually have no Origin header; authentication remains
    // mandatory for protected routes regardless of CORS.
    if (!origin) return callback(null, true);
    if (NODE_ENV !== 'production' && CORS_ORIGINS.length === 0) {
      return callback(null, true);
    }
    if (CORS_ORIGINS.includes(origin)) return callback(null, true);

    const error = new Error('Origin is not allowed by CORS.');
    error.statusCode = 403;
    return callback(error);
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
  exposedHeaders: ['X-Request-Id'],
  maxAge: 600,
}));

// Rate-limit before parsing request bodies to reduce parser-abuse impact.
app.use(rateLimit({ windowMs: 60 * 1000, max: 180, actionKey: 'global_api' }));
app.use(express.json({ limit: '1mb', strict: true }));
app.use(express.urlencoded({ extended: false, limit: '64kb', parameterLimit: 100 }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    platform: 'Geeta University Discussion Platform',
    timestamp: new Date().toISOString(),
    requestId: req.id,
  });
});

// API Routes
app.use('/api', routes);

// Global Error Handler
app.use(errorHandler);

export default app;
