/**
 * Authentication Domain
 *
 * Core authentication types, interfaces, and schemas shared across all applications.
 * This module contains no framework-specific code and can be used in:
 * - Frontend (React, Vue, etc.)
 * - Backend (Node.js/Express)
 * - CLI tools
 * - Mobile apps
 */

// ============================================================================
// Core Types & Enums
// ============================================================================

/**
 * Token types for email verification and password reset flows
 */
export type TokenType = 'verify' | 'reset';

/**
 * OAuth provider types supported by the application
 */
export type ProviderType = 'local' | 'google' | 'github';

/**
 * Authentication event types for audit logging and analytics
 */
export type AuthEventType =
  | 'signup'
  | 'login'
  | 'logout'
  | 'logout_all'
  | 'password_reset'
  | 'email_verified'
  | 'token_reuse_attack'
  | 'suspicious_login'
  | 'oauth_callback'
  | 'profile_update'
  | 'password_change'
  | 'devices_terminated';

// ============================================================================
// JWT & Session Types
// ============================================================================

/**
 * JWT Payload structure for access tokens
 * Compatible with standard JWT claims
 */
export interface JwtPayload {
  /** User ID (subject claim) */
  sub: string;
  /** Session ID for token rotation and session management */
  sessionId: string;
  /** JWT ID for token blacklist/revocation tracking */
  jti: string;
  /** Issued at timestamp (seconds since epoch) */
  iat?: number;
  /** Expiration timestamp (seconds since epoch) */
  exp?: number;
}

/**
 * Device information for session tracking and security
 */
export interface DeviceInfo {
  userAgent: string;
  ip: string;
  country?: string;
}

/**
 * OAuth profile data from external identity providers
 * Normalized structure for Google, GitHub, and other providers
 */
export interface OAuthProfile {
  /** Provider-specific user ID */
  id: string;
  /** User's email address */
  email: string;
  /** User's display name */
  fullName: string;
  /** Profile picture URL (optional) */
  avatarUrl?: string;
}

/**
 * Token pair returned on successful authentication
 * Access token is short-lived, refresh token is long-lived
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// ============================================================================
// Provider Data Types
// ============================================================================

/**
 * Local authentication provider data (email/password)
 */
export interface LocalProviderData {
  passwordHash: string;
}

/**
 * Google OAuth provider data
 */
export interface GoogleProviderData {
  googleId: string;
}

/**
 * GitHub OAuth provider data
 */
export interface GithubProviderData {
  githubId: string;
}

/**
 * Union type for all provider data shapes
 */
export type ProviderData = LocalProviderData | GoogleProviderData | GithubProviderData;

/**
 * Provider interface for user accounts
 * Supports multiple providers per user (account linking)
 */
export interface IProvider {
  type: ProviderType;
  data: ProviderData;
}

// ============================================================================
// User Types
// ============================================================================

/**
 * Base user interface without database-specific fields
 * Safe to use in frontend - no Mongoose/Prisma dependencies
 */
export interface IUser {
  email: string;
  fullName: string;
  isEmailVerified: boolean;
  providers: IProvider[];
  /** Number of consecutive failed sign-in attempts */
  failedSigninAttempts: number;
  /** Account lockout expiration date */
  lockedUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User Data Transfer Object
 * Used for API responses and frontend state management
 * Omits sensitive fields like password hashes
 */
export interface UserDTO {
  id: string;
  email: string;
  fullName: string;
  isEmailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Session Data Transfer Object
 * Used for displaying and managing active sessions
 */
export interface SessionDTO {
  id: string;
  deviceInfo: string;
  ipAddress: string;
  country?: string;
  lastUsedAt: Date;
  createdAt: Date;
  expiresAt: Date;
  isCurrent: boolean;
  isActive: boolean;
}

/**
 * Public user profile (for sharing with other users)
 * Minimal information exposed publicly
 */
export interface PublicUserProfile {
  id: string;
  fullName: string;
  avatarUrl?: string;
}

/**
 * User provider information for display in UI
 * Omits sensitive data like external provider IDs
 */
export interface UserProviderInfo {
  type: ProviderType;
  /** Whether this provider is linked to the account */
  linked: boolean;
  /** External provider ID (masked for security) */
  externalId?: string;
}

/**
 * Account security status for security dashboard
 */
export interface AccountSecurityStatus {
  /** Whether 2FA is enabled */
  hasTwoFactor: boolean;
  /** Number of active sessions */
  activeSessions: number;
  /** Whether email is verified */
  emailVerified: boolean;
  /** Provider types linked to account */
  linkedProviders: ProviderType[];
  /** Date of last password change */
  lastPasswordChange?: Date;
}

// ============================================================================
// API Types
// ============================================================================

/**
 * Standard API response wrapper
 * Consistent response format across all endpoints
 */
export interface AuthApiResponse<T = unknown> {
  status: 'success' | 'error';
  message?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

/**
 * Authentication error codes
 * Used for client-side error handling and i18n
 */
export type AuthErrorCode =
  // Authentication errors
  | 'UNAUTHENTICATED'
  | 'UNAUTHORIZED'
  | 'INVALID_CREDENTIALS'
  | 'USER_NOT_FOUND'
  | 'EMAIL_NOT_VERIFIED'
  | 'ACCOUNT_LOCKED'

  // Token errors
  | 'INVALID_TOKEN'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_REVOKED'
  | 'SESSION_TERMINATED'
  | 'SESSION_REVOKED'
  | 'TOKEN_REUSE_DETECTED'

  // Registration errors
  | 'EMAIL_ALREADY_EXISTS'
  | 'SIGNUP_FAILED'
  | 'MISSING_TOKEN'

  // OAuth errors
  | 'OAUTH_NOT_CONFIGURED'
  | 'OAUTH_ERROR'
  | 'OAUTH_NO_EMAIL'

  // Profile errors
  | 'PROFILE_UPDATE_FAILED'
  | 'NO_CHANGES_PROVIDED'

  // Server errors
  | 'INTERNAL_ERROR'
  | 'VALIDATION_ERROR';

/**
 * Structured API error response
 */
export interface AuthApiError {
  status: 'error';
  error: {
    code: AuthErrorCode;
    message: string;
    details?: Record<string, string[]>;
  };
}

// ============================================================================
// Request/Response Types (API Contracts)
// ============================================================================

// ------------------ Sign Up ------------------

export interface SignUpRequest {
  email: string;
  fullName: string;
  password: string;
}

export interface SignUpResponse {
  userId: string;
}

// ------------------ Email Verification ------------------

export interface VerifyEmailQuery {
  token: string;
}

export type VerifyEmailResponse = void;

// ------------------ Sign In ------------------

export interface SignInRequest {
  email: string;
  password: string;
}

export interface SignInResponse extends TokenPair {
  userId: string;
  sessionId: string;
}

// ------------------ Token Refresh ------------------

export interface RefreshRequest {
  refreshToken: string;
}

export interface RefreshResponse extends TokenPair {}

// ------------------ Sign Out ------------------

export type SignOutResponse = void;

// ------------------ Password Management ------------------

export interface ForgotPasswordRequest {
  email: string;
}

export type ForgotPasswordResponse = void;

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export type ResetPasswordResponse = void;

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export type ChangePasswordResponse = void;

// ------------------ Profile ------------------

export type GetMeResponse = UserDTO;

export interface UpdateProfileRequest {
  fullName: string;
}

export interface UpdateProfileResponse {
  user: UserDTO;
}

// ------------------ Session Management ------------------

export interface CheckAuthResponse {
  isAuthenticated: boolean;
  user?: UserDTO;
  session?: {
    id: string;
    deviceInfo: string;
    ipAddress: string;
    country: string;
    lastUsedAt: Date;
    createdAt: Date;
  };
  reason?:
    | 'NO_TOKEN'
    | 'TOKEN_EXPIRED'
    | 'TOKEN_REVOKED'
    | 'SESSION_TERMINATED'
    | 'SESSION_REVOKED'
    | 'INVALID_TOKEN';
}

export type ListSessionsResponse = SessionDTO[];

export interface DeleteSessionParams {
  sessionId: string;
}

export type DeleteSessionResponse = void;

export interface TerminateDevicesRequest {
  deviceIds: string[];
  reason?: string;
}

// ------------------ OAuth ------------------

export interface OAuthCallbackQuery {
  code: string;
  state?: string;
}

export interface OAuthErrorResponse {
  error: string;
  error_description?: string;
}

export interface OAuthUrlResponse {
  authUrl: string;
  provider: ProviderType;
}
