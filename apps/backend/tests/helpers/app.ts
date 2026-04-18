import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import passport from 'passport';
import { apiLimiter } from '../../src/middleware/rateLimiter.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import authRoutes from '../../src/modules/auth/auth.routes.js';

export function createTestApp(): express.Application {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(cors({ origin: '*', credentials: true }));
  app.use(passport.initialize());

  // Body parsing
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));

  // Rate limiting (enabled in tests for realistic behavior)
  app.use('/api', apiLimiter);

  // Routes
  app.use('/api/v1/auth', authRoutes);

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Error handling
  app.use(errorHandler);

  return app;
}
