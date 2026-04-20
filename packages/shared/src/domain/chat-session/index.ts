/**
 * Chat Session Domain
 *
 * Types, interfaces, and schemas for conversation/chat sessions.
 * These are distinct from authentication sessions.
 */

// ============================================================================
// Core Types
// ============================================================================

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
} from './types.js';

// Production constants (exported as values)
export {
  MAX_MESSAGES_PER_DOCUMENT,
  MAX_MESSAGE_CONTENT_SIZE,
  MAX_MESSAGE_METADATA_SIZE,
  DEFAULT_MESSAGE_PAGE_SIZE,
  MAX_MESSAGE_PAGE_SIZE,
} from './types.js';

// ============================================================================
// Constants & Utilities
// ============================================================================

export {
  MODEL_CONTEXT_LIMITS,
  DEFAULT_CONTEXT_LIMIT,
  COMPACTION_THRESHOLD,
  getContextLimit,
  shouldCompact,
} from './types.js';

// ============================================================================
// Validation Schemas
// ============================================================================

export {
  // Common schemas
  uuidSchema,
  objectIdSchema,
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

  // Type exports
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

  // Type exports
  type CreateSessionSchema,
  type UpdateSessionSchema,
  type AddMessageSchema,
  type EditMessageSchema,
  type CreateCheckpointSchema,
  type SearchMessagesQuerySchema,
  type ListSessionsQuerySchema,
  type DeleteAllSessionsQuerySchema,
  type ExportSessionQuerySchema,
  type ImportSessionSchema,
  type AcknowledgeMessagesSchema,
  type DownloadAttachmentParamsSchema,
} from './schemas.js';
