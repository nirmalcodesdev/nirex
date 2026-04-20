/**
 * Chat Session Types
 *
 * Types for conversation/chat sessions between users and AI.
 * These are distinct from authentication sessions.
 */

// ============================================================================
// Core Chat Session Types
// ============================================================================

/**
 * Role of a message sender in a chat session
 */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * AI model identifiers supported by the system
 */
export type AIModel =
  | 'gpt-4'
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'gpt-3.5-turbo'
  | 'claude-3-opus'
  | 'claude-3-sonnet'
  | 'claude-3-haiku'
  | string; // Allow custom model names

/**
 * Token usage statistics for a single message or aggregated session
 */
export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cached_tokens?: number;
  total_tokens: number;
}

/**
 * Message delivery status for reliable delivery tracking
 */
export type MessageDeliveryStatus =
  | 'pending'
  | 'delivered'
  | 'failed'
  | 'acknowledged';

/**
 * A single message in a chat conversation (embedded version - legacy)
 */
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  token_usage?: TokenUsage;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Message document interface for separate collection (production)
 * Used when messages are stored in their own collection for scalability
 */
export interface IMessage {
  id: string;
  session_id: string; // ObjectId as string
  user_id: string; // ObjectId as string
  sequence_number: number; // Global ordering within session
  role: MessageRole;
  content: string;
  encrypted?: boolean; // Whether content is encrypted at rest
  token_usage?: TokenUsage;
  client_message_id?: string; // For deduplication (client-generated)
  delivery_status: MessageDeliveryStatus;
  delivered_at?: Date;
  acknowledged_at?: Date;
  retry_count: number;
  metadata?: Record<string, unknown>;
  attachment_ids?: string[]; // References to attachments
  is_deleted: boolean;
  deleted_at?: Date;
  edited_at?: Date;
  edited_content?: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Message DTO for API responses
 */
export interface MessageDTO {
  id: string;
  session_id: string;
  sequence_number: number;
  role: MessageRole;
  content: string;
  token_usage?: TokenUsage;
  client_message_id?: string;
  delivery_status: MessageDeliveryStatus;
  metadata?: Record<string, unknown>;
  attachment_ids?: string[];
  is_deleted: boolean;
  edited_at?: Date;
  created_at: Date;
}

/**
 * Search result for message search
 */
export interface MessageSearchResult {
  message: MessageDTO;
  highlights: string[]; // Highlighted snippets
  score: number; // Relevance score
}

/**
 * A conversation checkpoint/snapshot for compaction
 */
export interface SessionCheckpoint {
  id: string;
  session_id: string;
  snapshot: string; // Compressed summary of conversation
  turn_index: number;
  created_at: Date;
}

/**
 * Core chat session interface
 */
export interface IChatSession {
  id: string;
  user_id: string;
  name: string;
  working_directory: string;
  working_directory_hash: string;
  messages: ChatMessage[];
  token_usage: TokenUsage;
  model: AIModel;
  is_archived: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Chat session DTO (for API responses)
 */
export interface ChatSessionDTO {
  id: string;
  name: string;
  working_directory: string;
  working_directory_hash: string;
  message_count: number;
  token_usage: TokenUsage;
  model: AIModel;
  is_archived: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Chat session with full message history
 */
export interface ChatSessionWithMessages extends ChatSessionDTO {
  messages: ChatMessage[];
}

/**
 * Checkpoint DTO (for API responses)
 */
export interface CheckpointDTO {
  id: string;
  turn_index: number;
  created_at: Date;
}

// ============================================================================
// Context Window Limits by Model
// ============================================================================

/**
 * Context window token limits for different AI models
 */
export const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  'gpt-4': 8192,
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-3.5-turbo': 16385,
  'gpt-3.5-turbo-16k': 16385,
  'claude-3-opus': 200000,
  'claude-3-sonnet': 200000,
  'claude-3-haiku': 200000,
  'claude-3-5-sonnet': 200000,
};

/**
 * Default context window limit when model is unknown
 */
export const DEFAULT_CONTEXT_LIMIT = 8192;

/**
 * Compaction threshold (80% of context limit)
 */
export const COMPACTION_THRESHOLD = 0.8;

/**
 * Get the context window limit for a model
 */
export function getContextLimit(model: string): number {
  return MODEL_CONTEXT_LIMITS[model] || DEFAULT_CONTEXT_LIMIT;
}

/**
 * Check if token count exceeds compaction threshold
 */
export function shouldCompact(model: string, totalTokens: number): boolean {
  const limit = getContextLimit(model);
  return totalTokens >= limit * COMPACTION_THRESHOLD;
}

// ============================================================================
// Production Constants
// ============================================================================

/**
 * Maximum messages to keep in a single session document before bucketing
 * MongoDB document limit is 16MB, this keeps us well under that
 */
export const MAX_MESSAGES_PER_DOCUMENT = 500;

/**
 * Maximum message content size (10KB)
 */
export const MAX_MESSAGE_CONTENT_SIZE = 10 * 1024;

/**
 * Maximum metadata size per message (5KB)
 */
export const MAX_MESSAGE_METADATA_SIZE = 5 * 1024;

/**
 * Default number of recent messages to return when paginating
 */
export const DEFAULT_MESSAGE_PAGE_SIZE = 50;

/**
 * Maximum number of messages per page
 */
export const MAX_MESSAGE_PAGE_SIZE = 200;

// ============================================================================
// API Request/Response Types
// ============================================================================

// ------------------ Create Session ------------------

export interface CreateSessionRequest {
  working_directory: string;
  model: AIModel;
}

export interface CreateSessionResponse {
  session: ChatSessionDTO;
}

// ------------------ List Sessions ------------------

export interface ListSessionsQuery {
  page?: number;
  limit?: number;
  include_archived?: boolean;
  working_directory_hash?: string;
}

export interface ListChatSessionsResponse {
  sessions: ChatSessionDTO[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

// ------------------ Get Session ------------------

export interface GetSessionQuery {
  page?: number;
  limit?: number;
}

export interface GetSessionResponse {
  session: ChatSessionWithMessages;
  messages_pagination?: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_more: boolean;
  };
}

// ------------------ Update Session ------------------

export interface UpdateSessionRequest {
  name?: string;
  is_archived?: boolean;
}

export interface UpdateSessionResponse {
  session: ChatSessionDTO;
}

// ------------------ Delete Session ------------------

export interface DeleteChatSessionResponse {
  message: string;
}

// ------------------ Delete All Sessions ------------------

export interface DeleteAllSessionsQuery {
  confirm: boolean;
}

export interface DeleteAllSessionsResponse {
  deleted_count: number;
}

// ------------------ Add Message ------------------

export interface AddMessageRequest {
  role: MessageRole;
  content: string;
  token_usage?: Partial<TokenUsage>;
  client_message_id?: string; // For deduplication
  metadata?: Record<string, unknown>;
}

export interface AddMessageResponse {
  message: MessageDTO;
  session: ChatSessionDTO;
  checkpoint_created?: boolean;
  is_duplicate?: boolean; // True if message was already processed
}

// ------------------ Message Search ------------------

export interface SearchMessagesQuery {
  q: string; // Search query
  session_id?: string; // Limit to specific session
  page?: number;
  limit?: number;
  role?: MessageRole; // Filter by role
  date_from?: Date;
  date_to?: Date;
}

export interface SearchMessagesResponse {
  results: MessageSearchResult[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// ------------------ Message Delivery Ack ------------------

export interface AcknowledgeMessageRequest {
  message_ids: string[];
}

export interface AcknowledgeMessageResponse {
  acknowledged: string[];
  failed: string[];
}

// ------------------ Edit/Delete Message ------------------

export interface EditMessageRequest {
  content: string;
}

export interface EditMessageResponse {
  message: MessageDTO;
}

export interface DeleteMessageResponse {
  message: string;
  deleted_at: Date;
}

// ------------------ Checkpoints ------------------

export interface CreateCheckpointRequest {
  snapshot: string;
}

export interface CreateCheckpointResponse {
  checkpoint: CheckpointDTO;
}

export interface ListCheckpointsResponse {
  checkpoints: CheckpointDTO[];
}

// ------------------ Export/Import ------------------

export type ExportFormat = 'json' | 'markdown';

export interface ExportSessionQuery {
  format?: ExportFormat;
}

export interface ImportSessionRequest {
  session_data: IChatSession;
}

export interface ImportSessionResponse {
  session: ChatSessionDTO;
}

// ------------------ Stats ------------------

export interface SessionStatsResponse {
  total_sessions: number;
  total_messages: number;
  total_tokens: TokenUsage;
  archived_sessions: number;
  estimated_cost_usd: number;
}

// ============================================================================
// Error Codes
// ============================================================================

export type ChatSessionErrorCode =
  | 'SESSION_NOT_FOUND'
  | 'SESSION_ACCESS_DENIED'
  | 'INVALID_MESSAGE_ROLE'
  | 'INVALID_MODEL'
  | 'CHECKPOINT_NOT_FOUND'
  | 'INVALID_EXPORT_FORMAT'
  | 'IMPORT_FAILED'
  | 'SESSION_LIMIT_REACHED';

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Paginated query parameters
 */
export interface PaginationQuery {
  page?: number;
  limit?: number;
}

/**
 * Session filter options
 */
export interface SessionFilters {
  include_archived?: boolean;
  working_directory_hash?: string;
  model?: AIModel;
  created_after?: Date;
  created_before?: Date;
}
