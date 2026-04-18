/**
 * @nirex/shared - Shared types, schemas, and utilities for Nirex applications
 *
 * This package contains code that is shared between frontend, backend, and CLI:
 * - TypeScript types and interfaces
 * - Zod validation schemas
 * - Constants and enums
 * - Utility functions (pure, no framework dependencies)
 *
 * @example
 * ```ts
 * import { UserDTO, loginSchema, ApiErrorCode } from '@nirex/shared';
 * ```
 */

// ============================================================================
// Application Constants
// ============================================================================

export const APP_NAME = 'Nirex';
export const APP_NAME_SUFFIX = 'Code';
export const API_VERSION = 'v1';

// ============================================================================
// Domain: Authentication & Authorization
// ============================================================================

// Core types
export type {
  // Token types
  TokenType,
  ProviderType,
  AuthEventType,

  // Core interfaces
  JwtPayload,
  DeviceInfo,
  OAuthProfile,
  TokenPair,

  // Provider data
  LocalProviderData,
  GoogleProviderData,
  GithubProviderData,
  ProviderData,
  IProvider,

  // User types
  IUser,
  UserDTO,
  SessionDTO,
  PublicUserProfile,
  UserProviderInfo,
  AccountSecurityStatus,

  // API types
  AuthApiResponse,
  AuthErrorCode,
  AuthApiError,

  // Request/Response types
  SignUpRequest,
  SignUpResponse,
  VerifyEmailQuery,
  VerifyEmailResponse,
  SignInRequest,
  SignInResponse,
  RefreshRequest,
  RefreshResponse,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
  ChangePasswordRequest,
  ChangePasswordResponse,
  SignOutResponse,
  GetMeResponse,
  UpdateProfileRequest,
  UpdateProfileResponse,
  CheckAuthResponse,
  ListSessionsResponse,
  DeleteSessionParams,
  DeleteSessionResponse,
  OAuthCallbackQuery,
  OAuthErrorResponse,
  OAuthUrlResponse,
  TerminateDevicesRequest,
} from './domain/auth/index.js';

// Validation schemas
export {
  // Auth schemas
  signInSchema,
  signUpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  refreshSchema,
  updateProfileSchema,
  terminateDevicesSchema,
  verifyEmailSchema,
  oauthCallbackSchema,

  // Session schemas
  deleteSessionSchema,
  listSessionsSchema,

  // Common schemas
  emailSchema,
  passwordSchema,
  uuidSchema,
  objectIdSchema,
  tokenSchema,
} from './domain/auth/schemas.js';

// Error codes
export { AuthErrorCodes, CommonErrorCodes, ValidationErrorCodes } from './domain/auth/errors.js';

// ============================================================================
// Domain: Common / Shared
// ============================================================================

export type {
  ApiResponse,
  ApiError,
  PaginatedResponse,
  PaginationParams,
  SortDirection,
  DateRange,
} from './domain/common/types.js';

export {
  createApiResponse,
  createApiError,
  createPaginatedResponse,
} from './domain/common/helpers.js';

// ============================================================================
// Utilities
// ============================================================================

export {
  // String utilities
  slugify,
  truncate,
  capitalize,
  formatFileSize,

  // Date utilities
  formatDate,
  formatRelativeTime,
  isExpired,

  // Validation utilities
  isValidEmail,
  isValidUrl,
  isValidObjectId,
} from './utils/index.js';

// ============================================================================
// Frontend-specific (kept for backward compatibility, consider moving to UI package)
// ============================================================================

export type { FooterLink, FooterColumn, SocialLink, FooterProps } from './frontend/types/footer.types.js';
export type { NavLink } from './frontend/types/navlink.types.js';
export { cn } from './frontend/lib/utils.js';
