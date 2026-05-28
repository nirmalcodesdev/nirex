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
  SignOutAllResponse,
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
  TerminateDevicesResponse,
  TwoFactorStatusResponse,
  BeginTwoFactorSetupResponse,
  VerifyTwoFactorSetupRequest,
  VerifyTwoFactorSetupResponse,
  DisableTwoFactorRequest,
  DisableTwoFactorResponse,
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

export {
  PASSWORD_POLICY,
  normalizePassword,
  getPasswordLength,
  validatePasswordPolicy,
  getPasswordRequirementStatus,
  getPasswordStrength,
  getPrimaryPasswordPolicyMessage,
  type PasswordIssueCode,
  type PasswordValidationIssue,
  type PasswordValidationContext,
  type PasswordRequirementStatus,
  type PasswordStrength,
  type PasswordValidationResult,
} from './domain/auth/password-policy.js';

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
  CheckpointReason,

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
  ResumeSessionRequest,
  ResumeSessionResponse,
  ForkSessionRequest,
  ForkSessionResponse,
  ClearSessionRequest,
  ClearSessionResponse,
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
  MAX_CHECKPOINT_SNAPSHOT_SIZE,
  MAX_SESSION_METADATA_SIZE,
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
  resumeSessionSchema,
  forkSessionSchema,
  clearSessionSchema,

  // Message schemas
  addMessageSchema,
  editMessageSchema,
  acknowledgeMessagesSchema,

  // Query schema types
  type GetSessionQuerySchema,
  type ResumeSessionSchema,
  type ForkSessionSchema,
  type ClearSessionSchema,

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
  DEFAULT_CREDITS_LIMIT,
} from './domain/usage/index.js';

// ============================================================================
// Domain: Billing
// ============================================================================

export type {
  AdminManualChargeRequest,
  AdminRefundRequest,
  ApplyDiscountRequest,
  AttachPaymentMethodRequest,
  BillingActorType,
  BillingAdminCustomerSummary,
  BillingAdminReconciliationReport,
  BillingAuditLogItem,
  BillingAuditOutcome,
  BillingCustomer,
  BillingCycle,
  BillingDiscountType,
  BillingInvoiceItem,
  BillingInvoiceLineItem,
  BillingInvoiceStatus,
  BillingInvoicesQuery,
  BillingInvoicesResponse,
  BillingOverviewEntitlement,
  BillingOverviewKpis,
  BillingOverviewPaymentMethod,
  BillingOverviewResponse,
  BillingOverviewSubscription,
  BillingOverviewUsage,
  BillingPayment,
  BillingPaymentMethod,
  BillingPaymentStatus,
  BillingPlan,
  BillingPlanId,
  BillingPlanPrice,
  BillingProvider,
  BillingReconciliationAlertItem,
  BillingRefund,
  BillingRefundStatus,
  BillingSubscription,
  BillingSubscriptionStatus,
  BillingTaxInclusiveMode,
  BillingWebhookStatus,
  CancelSubscriptionRequest,
  CancelSubscriptionResponse,
  ChangePlanRequest,
  CreateCheckoutSessionRequest,
  CreateCheckoutSessionResponse,
  CreatePortalSessionRequest,
  CreatePortalSessionResponse,
  CreateTopUpSessionRequest,
  CreateTopUpSessionResponse,
  CreditBalanceResponse,
  DownloadInvoicePdfResponse,
  JsonObject,
  JsonValue,
  MoneyAmount,
  PauseSubscriptionRequest,
  ProrationPreviewQuery,
  ProrationPreviewResponse,
  ResumeSubscriptionRequest,
  ResumeSubscriptionResponse,
  RetryPaymentRequest,
  RollingWindowUsage,
  StripeWebhookResponse,
  TopUpPack,
  TopUpPackId,
  UpdateAutoRenewalRequest,
  UpdateAutoRenewalResponse,
} from './domain/billing/index.js';

export {
  BILLING_PLAN_CATALOG,
  TOPUP_PACK_CATALOG,
  DEFAULT_BILLING_CURRENCY,
  GO_MONTHLY_DEFAULT_CENTS,
  GO_YEARLY_DEFAULT_CENTS,
  PRO_MONTHLY_DEFAULT_CENTS,
  PRO_YEARLY_DEFAULT_CENTS,
  PLUS_MONTHLY_DEFAULT_CENTS,
  PLUS_YEARLY_DEFAULT_CENTS,
  MAX_MONTHLY_DEFAULT_CENTS,
  FREE_INCLUDED_CREDITS,
  FREE_SIGNUP_BONUS_CREDITS,
  GO_INCLUDED_CREDITS,
  PRO_INCLUDED_CREDITS,
  PLUS_INCLUDED_CREDITS,
  MAX_INCLUDED_CREDITS,
  FREE_REQUEST_QUOTA,
  GO_REQUEST_QUOTA,
  PRO_REQUEST_QUOTA,
  PLUS_REQUEST_QUOTA,
  MAX_REQUEST_QUOTA,
  CREDITS_PER_DOLLAR,
  ROLLING_WINDOW_5H_MS,
  ROLLING_WINDOW_7D_MS,
  getTopUpPack,
  getPlanConfig,
  getPlanIncludedCredits,
  getPlanRequestQuota,
  getPlanRollingWindowCaps,
  billingCycleSchema,
  billingPlanIdSchema,
  topUpPackIdSchema,
  billingInvoiceStatusSchema,
  billingObjectIdSchema,
  checkoutPlanIdSchema,
  billingInvoicesQuerySchema,
  createCheckoutSessionSchema,
  createPortalSessionSchema,
  createTopUpSessionSchema,
  attachPaymentMethodSchema,
  paymentMethodIdParamSchema,
  invoiceIdParamSchema,
  changePlanSchema,
  cancelSubscriptionSchema,
  updateAutoRenewalSchema,
  pauseSubscriptionSchema,
  resumeSubscriptionSchema,
  retryPaymentSchema,
  applyDiscountSchema,
  prorationPreviewQuerySchema,
  billingAdminCustomerParamSchema,
  billingAdminSubscriptionParamSchema,
  adminRefundSchema,
  adminManualChargeSchema,
  type BillingInvoicesQuerySchema,
  type CreateCheckoutSessionSchema,
  type AttachPaymentMethodSchema,
  type ChangePlanSchema,
  type CancelSubscriptionSchema,
  type UpdateAutoRenewalSchema,
  type BillingCatalogPlanId,
  type BillingPlanCatalogEntry,
  type RollingWindowCaps,
} from './domain/billing/index.js';

// ============================================================================
// Domain: Notifications
// ============================================================================

export type {
  NotificationKind,
  NotificationSeverity,
  NotificationItem,
  ListNotificationsQuery,
  ListNotificationsResponse,
  NotificationUnreadCountResponse,
  CreateNotificationRequest,
  CreateNotificationResponse,
  MarkNotificationReadResponse,
  MarkNotificationUnreadResponse,
  ArchiveNotificationResponse,
  ReadAllNotificationsResponse,
  BatchReadNotificationsRequest,
  BatchReadNotificationsResponse,
} from './domain/notifications/index.js';

export {
  notificationKindSchema,
  notificationSeveritySchema,
  listNotificationsQuerySchema,
  createNotificationSchema,
  notificationIdParamSchema,
  markNotificationsBatchReadSchema,
  type ListNotificationsQuerySchema,
  type CreateNotificationSchema,
  type NotificationIdParamSchema,
  type MarkNotificationsBatchReadSchema,
} from './domain/notifications/index.js';

// ============================================================================
// Domain: Realtime (Socket.IO)
// ============================================================================

export {
  RealtimeChannel,
  type RealtimeChannelName,
  type RealtimeEventMap,
  type NotificationCreatedPayload,
  type NotificationUpdatedPayload,
  type NotificationReadAllPayload,
  type NotificationBatchReadPayload,
  type UnreadCountChangedPayload,
  type ConnectionReadyPayload,
} from './domain/realtime/index.js';

// ============================================================================
// Domain: Dashboard
// ============================================================================

export type {
  DashboardHealthStatus,
  DashboardOverviewQuery,
  DashboardUsageOverview,
  DashboardBillingOverview,
  DashboardNotificationsOverview,
  DashboardKpis,
  DashboardOverviewResponse,
} from './domain/dashboard/index.js';

export {
  dashboardOverviewQuerySchema,
  type DashboardOverviewQuerySchema,
} from './domain/dashboard/index.js';

// ============================================================================
// Domain: API Keys
// ============================================================================

export type {
  ApiKeyScope,
  ApiKeyErrorCode,
  ApiKeyItem,
  CreateApiKeyRequest,
  CreateApiKeyResponse,
  ListApiKeysResponse,
  RotateApiKeyRequest,
  RotateApiKeyResponse,
  RevokeApiKeyRequest,
  ApiKeyIdentityResponse,
} from './domain/api-keys/index.js';

export {
  API_KEY_SCOPES,
  apiKeyScopeSchema,
  createApiKeySchema,
  rotateApiKeySchema,
  revokeApiKeySchema,
  apiKeyIdParamSchema,
} from './domain/api-keys/index.js';

export type {
  CreateApiKeySchema,
  RotateApiKeySchema,
  RevokeApiKeySchema,
  ApiKeyIdParamSchema,
} from './domain/api-keys/index.js';

// ============================================================================
// Frontend-specific (kept for backward compatibility, consider moving to UI package)
// ============================================================================

export type { FooterLink, FooterColumn, SocialLink, FooterProps } from './frontend/types/footer.types.js';
export type { NavLink, NavProps } from './frontend/types/navlink.types.js';
export { cn } from './frontend/lib/utils.js';
