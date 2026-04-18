// Re-export auth types from shared package
export {
  type TokenType,
  type ProviderType,
  type AuthEventType,
  type JwtPayload,
  type DeviceInfo,
  type OAuthProfile,
  type TokenPair,
  type LocalProviderData,
  type GoogleProviderData,
  type GithubProviderData,
  type ProviderData,
  type IProvider,
  type IUser,
  type UserDTO,
  type SessionDTO,
  type PublicUserProfile,
  type UserProviderInfo,
  type AccountSecurityStatus,
  type AuthApiResponse,
  type SignUpRequest,
  type SignUpResponse,
  type VerifyEmailQuery,
  type VerifyEmailResponse,
  type SignInRequest,
  type SignInResponse,
  type RefreshRequest,
  type RefreshResponse,
  type ForgotPasswordRequest,
  type ForgotPasswordResponse,
  type ResetPasswordRequest,
  type ResetPasswordResponse,
  type ChangePasswordRequest,
  type ChangePasswordResponse,
  type SignOutResponse,
  type GetMeResponse,
  type UpdateProfileRequest,
  type UpdateProfileResponse,
  type CheckAuthResponse,
  type ListSessionsResponse,
  type DeleteSessionParams,
  type DeleteSessionResponse,
  type OAuthCallbackQuery,
  type OAuthErrorResponse,
  type OAuthUrlResponse,
  type TerminateDevicesRequest,
  type AuthErrorCode,
  type AuthApiError,
} from '@nirex/shared';

// Re-export validation schemas from shared package
export {
  signInSchema,
  signUpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  refreshSchema,
  updateProfileSchema,
  terminateDevicesSchema,
  emailSchema,
  passwordSchema,
  uuidSchema,
  objectIdSchema,
  tokenSchema,
  verifyEmailSchema,
  oauthCallbackSchema,
  deleteSessionSchema,
  listSessionsSchema,
} from '@nirex/shared';

// Re-export error codes from shared package
export { AuthErrorCodes, CommonErrorCodes, ValidationErrorCodes } from '@nirex/shared';

// Re-export common types from shared package
export type {
  ApiResponse,
  ApiError,
  PaginatedResponse,
  PaginationParams,
  SortDirection,
  DateRange,
} from '@nirex/shared';

// Re-export common helpers from shared package
export {
  createApiResponse,
  createApiError,
  createPaginatedResponse,
} from '@nirex/shared';

/**
 * Operational errors are safe to surface to the client.
 * Programmer errors must never leak implementation details.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, code: string = 'INTERNAL_ERROR') {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}
