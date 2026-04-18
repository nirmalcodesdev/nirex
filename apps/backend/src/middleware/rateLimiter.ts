import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

// Note: Redis store is created lazily when Redis is available.
// For development without Redis, the in-memory store is used automatically.

/** Strict limiter for auth endpoints (sign-in, sign-up, forgot-password). */
export const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_AUTH_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  // Uses in-memory store by default; Redis store can be added for production
  message: {
    status: 'fail',
    code: 'RATE_LIMIT',
    message: 'Too many requests, please try again later.',
  },
  skip: () => env.NODE_ENV === 'test',
});

/** Looser limiter for general API routes. */
export const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_API_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  // Uses in-memory store by default; Redis store can be added for production
  message: {
    status: 'fail',
    code: 'RATE_LIMIT',
    message: 'Too many requests, please try again later.',
  },
  skip: () => env.NODE_ENV === 'test',
});
