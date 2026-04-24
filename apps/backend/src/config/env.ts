import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

// Fail fast at startup if required environment variables are missing or malformed.
// This prevents the application from starting in a silently broken state.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z
    .string()
    .default('3001')
    .transform((v) => parseInt(v, 10)),

  // Database
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  // Redis
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  // JWT — secrets must be ≥ 32 chars to satisfy HMAC-SHA256 key size requirements.
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  // Access token TTL in seconds — default 15 minutes
  JWT_ACCESS_TTL_SECONDS: z
    .string()
    .default('900')
    .transform((v) => parseInt(v, 10)),
  // Refresh token TTL in days — default 30 days
  JWT_REFRESH_TTL_DAYS: z
    .string()
    .default('30')
    .transform((v) => parseInt(v, 10)),

  // Cookie domain — leave empty for localhost development
  COOKIE_DOMAIN: z.string().optional(),

  // OAuth — Google (optional)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().url().optional(),

  // OAuth — GitHub (optional)
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_CALLBACK_URL: z.string().url().optional(),

  // Email (SMTP) - optional in development, uses Ethereal Email by default
  SMTP_HOST: z.string().default('smtp.ethereal.email'),
  SMTP_PORT: z
    .string()
    .default('587')
    .transform((v) => parseInt(v, 10)),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  EMAIL_FROM: z.string().default('noreply@localhost'),

  // Public-facing app URL (used to construct verification/reset links)
  APP_URL: z.string().url('APP_URL must be a valid URL'),

  // CORS — comma-separated list of allowed origins
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((v) => v.split(',').map((s) => s.trim())),

  // Billing / Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_API_VERSION: z.string().default('2025-04-30.basil'),
  STRIPE_BILLING_PORTAL_CONFIGURATION_ID: z.string().optional(),
  STRIPE_PRICE_PRO_MONTHLY: z.string().optional(),
  STRIPE_PRICE_PRO_YEARLY: z.string().optional(),
  STRIPE_AUTOMATIC_TAX_ENABLED: z
    .string()
    .default('false')
    .transform((v) => v.toLowerCase() === 'true'),
  STRIPE_WEBHOOK_TOLERANCE_SECONDS: z
    .string()
    .default('300')
    .transform((v) => parseInt(v, 10)),
  BILLING_WEBHOOK_STALE_RETRY_SECONDS: z
    .string()
    .default('900')
    .transform((v) => parseInt(v, 10)),
  BILLING_SYNC_MIN_INTERVAL_SECONDS: z
    .string()
    .default('120')
    .transform((v) => parseInt(v, 10)),
  BILLING_WEBHOOK_RATE_LIMIT_PER_MINUTE: z
    .string()
    .default('600')
    .transform((v) => parseInt(v, 10)),
  BILLING_EMAIL_NOTIFICATIONS_ENABLED: z
    .string()
    .default('true')
    .transform((v) => v.toLowerCase() === 'true'),
  BILLING_DEFAULT_SUCCESS_URL: z.string().url().optional(),
  BILLING_DEFAULT_CANCEL_URL: z.string().url().optional(),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z
    .string()
    .default('900000')
    .transform((v) => parseInt(v, 10)),
  RATE_LIMIT_AUTH_MAX: z
    .string()
    .default('10')
    .transform((v) => parseInt(v, 10)),
  RATE_LIMIT_API_MAX: z
    .string()
    .default('100')
    .transform((v) => parseInt(v, 10)),

  // API keys
  API_KEY_SECRET_PEPPER: z
    .string()
    .min(32, 'API_KEY_SECRET_PEPPER must be at least 32 characters'),
  API_KEY_PREFIX: z
    .string()
    .default('nrx')
    .transform((v) => v.trim().toLowerCase())
    .refine((v) => /^[a-z][a-z0-9]*$/.test(v), {
      message: 'API_KEY_PREFIX must be alphanumeric and start with a letter',
    }),
  API_KEY_DEFAULT_TTL_DAYS: z
    .string()
    .default('365')
    .transform((v) => parseInt(v, 10))
    .refine((v) => Number.isInteger(v) && v > 0 && v <= 3650, {
      message: 'API_KEY_DEFAULT_TTL_DAYS must be between 1 and 3650',
    }),

  // Two-factor authentication (TOTP)
  TWO_FACTOR_ENCRYPTION_KEY: z
    .string()
    .min(32, 'TWO_FACTOR_ENCRYPTION_KEY must be at least 32 characters'),
  TWO_FACTOR_ISSUER: z
    .string()
    .default('Nirex'),
  TWO_FACTOR_SETUP_TTL_MINUTES: z
    .string()
    .default('10')
    .transform((v) => parseInt(v, 10))
    .refine((v) => Number.isInteger(v) && v >= 5 && v <= 30, {
      message: 'TWO_FACTOR_SETUP_TTL_MINUTES must be between 5 and 30',
    }),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error('❌  Invalid environment variables — server cannot start:');
  console.error(JSON.stringify(result.error.flatten().fieldErrors, null, 2));
  // Don't exit in test environment to allow tests to set env vars
  if (process.env.NODE_ENV !== 'test') {
    process.exit(1);
  }
}

export const env = result.success
  ? result.data
  : ({} as z.infer<typeof envSchema>); // Fallback for tests
export type Env = typeof env;
