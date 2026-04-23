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
// Domain: Chat Sessions
// ============================================================================

// Core types
export type {
  // Core enums/types
  MessageRole,
  AIModel,
  MessageDeliveryStatus,

  // Core interfaces
  TokenUsage,
  ChatMessage,
  IMessage,
  MessageDTO,
  MessageSearchResult,
  SessionCheckpoint,
  IChatSession,
  ChatSessionDTO,
  ChatSessionWithMessages,
  CheckpointDTO,

  // API Request/Response types
  CreateSessionRequest,
  CreateSessionResponse,
  ListSessionsQuery,
  ListChatSessionsResponse,
  GetSessionQuery,
  GetSessionResponse,
  UpdateSessionRequest,
  UpdateSessionResponse,
  DeleteChatSessionResponse,
  DeleteAllSessionsQuery,
  DeleteAllSessionsResponse,
  AddMessageRequest,
  AddMessageResponse,
  SearchMessagesQuery,
  SearchMessagesResponse,
  AcknowledgeMessageRequest,
  AcknowledgeMessageResponse,
  EditMessageRequest,
  EditMessageResponse,
  DeleteMessageResponse,
  CreateCheckpointRequest,
  CreateCheckpointResponse,
  ListCheckpointsResponse,
  ExportFormat,
  ExportSessionQuery,
  ImportSessionRequest,
  ImportSessionResponse,
  SessionStatsResponse,

  // Error codes
  ChatSessionErrorCode,

  // Utility types
  PaginationQuery,
  SessionFilters,
} from './domain/chat-session/index.js';

// Chat session constants & utilities
export {
  MODEL_CONTEXT_LIMITS,
  DEFAULT_CONTEXT_LIMIT,
  COMPACTION_THRESHOLD,
  getContextLimit,
  shouldCompact,
  MAX_MESSAGES_PER_DOCUMENT,
  MAX_MESSAGE_CONTENT_SIZE,
  MAX_MESSAGE_METADATA_SIZE,
  DEFAULT_MESSAGE_PAGE_SIZE,
  MAX_MESSAGE_PAGE_SIZE,
} from './domain/chat-session/index.js';

// Chat session validation schemas
export {
  // Common schemas
  messageRoleSchema,
  aiModelSchema,
  tokenUsageSchema,
  chatMessageSchema,
  importChatMessageSchema,

  // Session schemas
  createSessionSchema,
  updateSessionSchema,
  sessionIdParamSchema,
  messageIdParamSchema,
  getSessionQuerySchema,

  // Message schemas
  addMessageSchema,
  editMessageSchema,
  acknowledgeMessagesSchema,

  // Query schema types
  type GetSessionQuerySchema,

  // Checkpoint schemas
  createCheckpointSchema,

  // Query schemas
  searchMessagesQuerySchema,
  listSessionsQuerySchema,
  deleteAllSessionsQuerySchema,
  exportSessionQuerySchema,
  importSessionSchema,
  downloadAttachmentParamsSchema,
} from './domain/chat-session/index.js';

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
// Domain: Usage & Billing Analytics
// ============================================================================

export type {
  UsageRange,
  UsageExportFormat,
  UsageSummary,
  UsageChartPoint,
  CostBreakdownKey,
  UsageCostBreakdownItem,
  UsageCostBreakdown,
  UsageTopProject,
  UsageCurrentPlan,
  UsageOverviewResponse,
  UsageOverviewQuery,
  UsageExportQuery,
} from './domain/usage/index.js';

export {
  usageRangeSchema,
  usageExportFormatSchema,
  usageOverviewQuerySchema,
  usageExportQuerySchema,
  type UsageOverviewQuerySchema,
  type UsageExportQuerySchema,
} from './domain/usage/index.js';

// ============================================================================
// Domain: Billing
// ============================================================================

export type {
  BillingCycle,
  BillingPlanId,
  BillingSubscriptionStatus,
  BillingInvoiceStatus,
  BillingPlanPrice,
  BillingPlan,
  BillingOverviewSubscription,
  BillingOverviewPaymentMethod,
  BillingInvoiceItem,
  BillingOverviewUsage,
  BillingOverviewKpis,
  BillingOverviewResponse,
  BillingInvoicesQuery,
  CreateCheckoutSessionRequest,
  CreateCheckoutSessionResponse,
  CreatePortalSessionRequest,
  CreatePortalSessionResponse,
  CancelSubscriptionRequest,
  CancelSubscriptionResponse,
  ResumeSubscriptionResponse,
  StripeWebhookResponse,
} from './domain/billing/index.js';

export {
  BILLING_PLAN_CATALOG,
  DEFAULT_BILLING_CURRENCY,
  PRO_MONTHLY_DEFAULT_CENTS,
  PRO_YEARLY_DEFAULT_CENTS,
  billingCycleSchema,
  billingPlanIdSchema,
  checkoutPlanIdSchema,
  billingInvoicesQuerySchema,
  createCheckoutSessionSchema,
  createPortalSessionSchema,
  cancelSubscriptionSchema,
  type BillingInvoicesQuerySchema,
  type CreateCheckoutSessionSchema,
  type CreatePortalSessionSchema,
  type CancelSubscriptionSchema,
  type BillingCatalogPlanId,
  type BillingPlanCatalogEntry,
} from './domain/billing/index.js';

// ============================================================================
// Frontend-specific (kept for backward compatibility, consider moving to UI package)
// ============================================================================

export type { FooterLink, FooterColumn, SocialLink, FooterProps } from './frontend/types/footer.types.js';
export type { NavLink } from './frontend/types/navlink.types.js';
export { cn } from './frontend/lib/utils.js';
