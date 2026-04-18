import { beforeAll, afterAll } from 'vitest';

// Global test setup
beforeAll(async () => {
  // Set required environment variables for testing
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-32-chars-long!!!!';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32-chars-long!!!';
  process.env.JWT_ACCESS_TTL_SECONDS = '900';
  process.env.JWT_REFRESH_TTL_DAYS = '30';
  process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
  process.env.REDIS_URL = 'redis://localhost:6379';
  process.env.SMTP_HOST = 'smtp.test.com';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_USER = 'test';
  process.env.SMTP_PASS = 'test';
  process.env.EMAIL_FROM = 'test@example.com';
  process.env.APP_URL = 'http://localhost:3001';
  process.env.CORS_ORIGINS = 'http://localhost:5173';
  process.env.RATE_LIMIT_WINDOW_MS = '900000';
  process.env.RATE_LIMIT_AUTH_MAX = '10';
  process.env.RATE_LIMIT_API_MAX = '100';
});

afterAll(async () => {
  // Cleanup if needed
});
