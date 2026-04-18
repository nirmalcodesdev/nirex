/**
 * Authentication Validation Schemas
 *
 * Zod schemas for validating authentication-related data.
 * These schemas are shared between frontend and backend to ensure
 * consistent validation across the entire application.
 *
 * @example
 * ```ts
 * import { loginSchema, registerSchema } from '@nirex/shared';
 *
 * // Backend
 * const result = loginSchema.safeParse(req.body);
 *
 * // Frontend
 * const formSchema = zodResolver(loginSchema);
 * ```
 */

import { z } from 'zod';

// ============================================================================
// Common Field Schemas
// ============================================================================

/**
 * Email validation schema
 * - Must be valid email format
 * - Max 255 characters
 * - Automatically trimmed and lowercased
 */
export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Invalid email address')
  .max(255, 'Email must be at most 255 characters')
  .trim()
  .toLowerCase();

/**
 * Password validation schema
 * - Min 8 characters (NIST recommendation)
 * - Max 128 characters (prevent DoS)
 * - No complexity requirements (NIST advises against arbitrary complexity)
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters');

/**
 * Full name validation schema
 * - Min 2 characters
 * - Max 100 characters
 * - Automatically trimmed
 */
export const fullNameSchema = z
  .string()
  .min(2, 'Full name must be at least 2 characters')
  .max(100, 'Full name must be at most 100 characters')
  .trim();

/**
 * UUID validation schema
 */
export const uuidSchema = z
  .string()
  .uuid('Invalid UUID format');

/**
 * MongoDB ObjectId validation schema
 * - 24 character hex string
 */
export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId format');

/**
 * Token validation schema
 * - Min 1 character (non-empty)
 */
export const tokenSchema = z
  .string()
  .min(1, 'Token is required');

// ============================================================================
// Authentication Schemas
// ============================================================================

/**
 * Sign in request schema
 * Used for email/password authentication
 */
export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

/**
 * Sign up request schema
 * Used for new user signup
 */
export const signUpSchema = z.object({
  email: emailSchema,
  fullName: fullNameSchema,
  password: passwordSchema,
});

/**
 * Forgot password request schema
 * Used to initiate password reset flow
 */
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

/**
 * Reset password request schema
 * Used to complete password reset with token
 */
export const resetPasswordSchema = z.object({
  token: tokenSchema,
  password: passwordSchema,
});

/**
 * Change password request schema
 * Used when user is already authenticated
 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

/**
 * Refresh token request schema
 * Used to obtain new access token
 */
export const refreshSchema = z.object({
  refreshToken: tokenSchema,
});

/**
 * Update profile request schema
 * Used to update user profile information
 */
export const updateProfileSchema = z.object({
  fullName: fullNameSchema,
});

/**
 * Terminate devices request schema
 * Used for bulk device/session termination
 */
export const terminateDevicesSchema = z.object({
  deviceIds: z
    .array(z.string().min(1, 'Device ID is required'))
    .min(1, 'At least one device ID is required')
    .max(100, 'Cannot terminate more than 100 devices at once'),
  reason: z
    .string()
    .max(500, 'Reason must be at most 500 characters')
    .optional(),
});

/**
 * Email verification query schema
 * Used for verifying email with token
 */
export const verifyEmailSchema = z.object({
  token: tokenSchema,
});

/**
 * OAuth callback query schema
 * Used for handling OAuth provider callbacks
 */
export const oauthCallbackSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  state: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

// ============================================================================
// Session Management Schemas
// ============================================================================

/**
 * Delete session params schema
 */
export const deleteSessionSchema = z.object({
  sessionId: objectIdSchema,
});

/**
 * List sessions query schema
 */
export const listSessionsSchema = z.object({
  includeExpired: z
    .string()
    .transform((val: string) => val === 'true')
    .optional(),
});

// ============================================================================
// Type Exports (for TypeScript inference)
// ============================================================================

export type SignInSchema = z.infer<typeof signInSchema>;
export type SignUpSchema = z.infer<typeof signUpSchema>;
export type ForgotPasswordSchema = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordSchema = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordSchema = z.infer<typeof changePasswordSchema>;
export type RefreshSchema = z.infer<typeof refreshSchema>;
export type UpdateProfileSchema = z.infer<typeof updateProfileSchema>;
export type TerminateDevicesSchema = z.infer<typeof terminateDevicesSchema>;
export type VerifyEmailSchema = z.infer<typeof verifyEmailSchema>;
export type OAuthCallbackSchema = z.infer<typeof oauthCallbackSchema>;
export type DeleteSessionSchema = z.infer<typeof deleteSessionSchema>;
export type ListSessionsSchema = z.infer<typeof listSessionsSchema>;
