import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import passport from 'passport';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import authRoutes from './modules/auth/auth.routes.js';
import chatSessionRoutes from './modules/chat-session/chat-session.routes.js';
import usageRoutes from './modules/usage/usage.routes.js';
import { configurePassport } from './config/passport.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();

// ── Security headers ──────────────────────────────────────────────────────
app.use(helmet());

// ── Request logging ───────────────────────────────────────────────────────
// Must be early to capture all requests, but after helmet for security headers
app.use(requestLogger);

// ── CORS ──────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: env.CORS_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-File-Name',
      'X-Upload-Filename',
      'Last-Event-ID',
    ],
  }),
);

// ── Body parsing ──────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Passport ──────────────────────────────────────────────────────────────
configurePassport();
app.use(passport.initialize());

// ── Global rate limiter ───────────────────────────────────────────────────
app.use('/api', apiLimiter);

// ── Health check ──────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Routes ────────────────────────────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/sessions', chatSessionRoutes);
app.use('/api/usage', usageRoutes);

// ── Static files (auth test interface) ────────────────────────────────────
// Serve from project root public folder (works in both src and dist)
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

// ── 404 handler ───────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ status: 'fail', message: 'Route not found' });
});

// ── Error handler (must be last) ──────────────────────────────────────────
app.use(errorHandler);

export default app;
