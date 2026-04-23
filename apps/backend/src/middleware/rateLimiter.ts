import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { env } from '../config/env.js';
import { getRedisClient, isRedisAvailable } from '../config/redis.js';

/**
 * Create Redis store for rate limiting if Redis is available.
 * Falls back to in-memory store if Redis is not available.
 */
function createRedisStore(prefix: string): RedisStore | undefined {
  if (!isRedisAvailable()) {
    return undefined;
  }

  try {
    const client = getRedisClient();
    return new RedisStore({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sendCommand: (...args: [string, ...string[]]) => client.call(...args) as any,
      prefix: `ratelimit:${prefix}:`,
    });
  } catch {
    return undefined;
  }
}

/** Strict limiter for auth endpoints (sign-in, sign-up, forgot-password). */
export const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_AUTH_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore('auth'),
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
  store: createRedisStore('api'),
  message: {
    status: 'fail',
    code: 'RATE_LIMIT',
    message: 'Too many requests, please try again later.',
  },
  skip: () => env.NODE_ENV === 'test',
});

/** Strict limiter for message creation to prevent spam. */
export const messageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 messages per minute per user
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore('message'),
  message: {
    status: 'fail',
    code: 'RATE_LIMIT',
    message: 'Too many messages, please slow down.',
  },
  skip: () => env.NODE_ENV === 'test',
});

/** Rate limiter for session creation to prevent abuse. */
export const sessionCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 sessions per hour per user
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore('session_create'),
  message: {
    status: 'fail',
    code: 'RATE_LIMIT',
    message: 'Session creation limit reached. Please try again later.',
  },
  skip: () => env.NODE_ENV === 'test',
});

/** Rate limiter for search queries. */
export const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 searches per minute per user
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore('search'),
  message: {
    status: 'fail',
    code: 'RATE_LIMIT',
    message: 'Search rate limit exceeded. Please slow down.',
  },
  skip: () => env.NODE_ENV === 'test',
});

/** Rate limiter for file uploads. */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // 100 uploads per hour per user
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore('upload'),
  message: {
    status: 'fail',
    code: 'RATE_LIMIT',
    message: 'Upload limit reached. Please try again later.',
  },
  skip: () => env.NODE_ENV === 'test',
});

/** Limiter for public Stripe webhook endpoint to protect availability. */
export const billingWebhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: env.BILLING_WEBHOOK_RATE_LIMIT_PER_MINUTE,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore('billing_webhook'),
  keyGenerator: (req) => req.ip || 'unknown',
  message: {
    status: 'fail',
    code: 'RATE_LIMIT',
    message: 'Too many webhook requests.',
  },
  skip: () => env.NODE_ENV === 'test',
});

/** Rate limiter for SSE connections to prevent connection exhaustion. */
export const sseConnectionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 SSE connections per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore('sse'),
  keyGenerator: (req) => req.ip || 'unknown',
  message: {
    status: 'fail',
    code: 'RATE_LIMIT',
    message: 'Too many SSE connection attempts. Please try again later.',
  },
  skip: () => env.NODE_ENV === 'test',
});
