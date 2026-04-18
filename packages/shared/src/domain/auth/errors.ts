/**
 * Error Codes & Messages
 *
 * Centralized error codes for consistent error handling across the application.
 * These codes can be used for:
 * - API error responses
 * - Client-side error handling
 * - Internationalization (i18n) keys
 * - Logging and monitoring
 */

// ============================================================================
// Authentication Error Codes
// ============================================================================

export const AuthErrorCodes = {
  // Authentication failures
  UNAUTHENTICATED: {
    code: 'UNAUTHENTICATED',
    message: 'Authentication required. Please sign in.',
    statusCode: 401,
  },
  UNAUTHORIZED: {
    code: 'UNAUTHORIZED',
    message: 'You do not have permission to access this resource.',
    statusCode: 403,
  },
  INVALID_CREDENTIALS: {
    code: 'INVALID_CREDENTIALS',
    message: 'Invalid email or password.',
    statusCode: 401,
  },
  USER_NOT_FOUND: {
    code: 'USER_NOT_FOUND',
    message: 'User not found.',
    statusCode: 404,
  },
  EMAIL_NOT_VERIFIED: {
    code: 'EMAIL_NOT_VERIFIED',
    message: 'Please verify your email address before signing in.',
    statusCode: 403,
  },
  ACCOUNT_LOCKED: {
    code: 'ACCOUNT_LOCKED',
    message: 'Account is temporarily locked due to multiple failed attempts.',
    statusCode: 429,
  },

  // Token errors
  INVALID_TOKEN: {
    code: 'INVALID_TOKEN',
    message: 'Invalid authentication token.',
    statusCode: 401,
  },
  TOKEN_EXPIRED: {
    code: 'TOKEN_EXPIRED',
    message: 'Your session has expired. Please sign in again.',
    statusCode: 401,
  },
  TOKEN_REVOKED: {
    code: 'TOKEN_REVOKED',
    message: 'Your session has been revoked. Please sign in again.',
    statusCode: 401,
  },
  SESSION_TERMINATED: {
    code: 'SESSION_TERMINATED',
    message: 'All sessions have been terminated. Please sign in again.',
    statusCode: 401,
  },
  SESSION_REVOKED: {
    code: 'SESSION_REVOKED',
    message: 'This session has been revoked. Please sign in again.',
    statusCode: 401,
  },
  TOKEN_REUSE_DETECTED: {
    code: 'TOKEN_REUSE_DETECTED',
    message: 'Security violation detected. All sessions have been revoked for your protection.',
    statusCode: 401,
  },

  // Registration errors
  EMAIL_ALREADY_EXISTS: {
    code: 'EMAIL_ALREADY_EXISTS',
    message: 'An account with this email already exists.',
    statusCode: 409,
  },
  SIGNUP_FAILED: {
    code: 'SIGNUP_FAILED',
    message: 'Failed to create account. Please try again.',
    statusCode: 500,
  },
  MISSING_TOKEN: {
    code: 'MISSING_TOKEN',
    message: 'Authentication token is required.',
    statusCode: 401,
  },

  // OAuth errors
  OAUTH_NOT_CONFIGURED: {
    code: 'OAUTH_NOT_CONFIGURED',
    message: 'OAuth authentication is not configured.',
    statusCode: 503,
  },
  OAUTH_ERROR: {
    code: 'OAUTH_ERROR',
    message: 'OAuth authentication failed.',
    statusCode: 400,
  },
  OAUTH_NO_EMAIL: {
    code: 'OAUTH_NO_EMAIL',
    message: 'Could not retrieve email from OAuth provider.',
    statusCode: 400,
  },

  // Profile errors
  PROFILE_UPDATE_FAILED: {
    code: 'PROFILE_UPDATE_FAILED',
    message: 'Failed to update profile. Please try again.',
    statusCode: 500,
  },
  NO_CHANGES_PROVIDED: {
    code: 'NO_CHANGES_PROVIDED',
    message: 'No changes were provided.',
    statusCode: 400,
  },

  // Server errors
  INTERNAL_ERROR: {
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred. Please try again later.',
    statusCode: 500,
  },
  VALIDATION_ERROR: {
    code: 'VALIDATION_ERROR',
    message: 'Validation failed. Please check your input.',
    statusCode: 422,
  },
} as const;

// ============================================================================
// Common Error Codes
// ============================================================================

export const CommonErrorCodes = {
  // Resource errors
  NOT_FOUND: {
    code: 'NOT_FOUND',
    message: 'The requested resource was not found.',
    statusCode: 404,
  },
  ALREADY_EXISTS: {
    code: 'ALREADY_EXISTS',
    message: 'The resource already exists.',
    statusCode: 409,
  },

  // Request errors
  BAD_REQUEST: {
    code: 'BAD_REQUEST',
    message: 'Invalid request. Please check your input.',
    statusCode: 400,
  },
  RATE_LIMITED: {
    code: 'RATE_LIMITED',
    message: 'Too many requests. Please try again later.',
    statusCode: 429,
  },

  // Server errors
  SERVICE_UNAVAILABLE: {
    code: 'SERVICE_UNAVAILABLE',
    message: 'Service temporarily unavailable. Please try again later.',
    statusCode: 503,
  },
} as const;

// ============================================================================
// Validation Error Codes
// ============================================================================

export const ValidationErrorCodes = {
  REQUIRED: {
    code: 'REQUIRED',
    message: 'This field is required.',
  },
  INVALID_EMAIL: {
    code: 'INVALID_EMAIL',
    message: 'Please enter a valid email address.',
  },
  INVALID_PASSWORD: {
    code: 'INVALID_PASSWORD',
    message: 'Password must be at least 8 characters.',
  },
  PASSWORDS_DONT_MATCH: {
    code: 'PASSWORDS_DONT_MATCH',
    message: 'Passwords do not match.',
  },
  INVALID_FORMAT: {
    code: 'INVALID_FORMAT',
    message: 'Invalid format.',
  },
  TOO_SHORT: {
    code: 'TOO_SHORT',
    message: 'Input is too short.',
  },
  TOO_LONG: {
    code: 'TOO_LONG',
    message: 'Input is too long.',
  },
} as const;

// ============================================================================
// Type Exports
// ============================================================================

export type AuthErrorCode = keyof typeof AuthErrorCodes;
export type CommonErrorCode = keyof typeof CommonErrorCodes;
export type ValidationErrorCode = keyof typeof ValidationErrorCodes;
