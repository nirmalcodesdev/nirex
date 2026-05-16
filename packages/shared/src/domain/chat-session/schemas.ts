/**
 * Chat Session Validation Schemas
 *
 * Zod schemas for validating chat session-related data.
 * These schemas are shared between frontend and backend.
 */

import { z } from 'zod';
import {
  MAX_CHECKPOINT_SNAPSHOT_SIZE,
  MAX_MESSAGE_CONTENT_SIZE,
} from './types.js';

// ============================================================================
// Common Field Schemas
// ============================================================================

/**
 * UUID validation schema
 */
export const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * MongoDB ObjectId validation schema
 */
export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId format');

/**
 * Message role validation
 */
export const messageRoleSchema = z.enum(['user', 'assistant', 'system', 'tool'], {
  errorMap: () => ({ message: 'Role must be user, assistant, system, or tool' }),
});

/**
 * AI model validation schema
 */
export const aiModelSchema = z.string().min(1, 'Model is required').max(100);

/**
 * Token usage schema
 */
export const tokenUsageSchema = z.object({
  input_tokens: z.number().int().min(0).default(0),
  output_tokens: z.number().int().min(0).default(0),
  cached_tokens: z.number().int().min(0).optional(),
  reasoning_tokens: z.number().int().min(0).optional(),
  total_tokens: z.number().int().min(0).default(0),
});

/**
 * Chat message schema
 */
export const chatMessageSchema = z.object({
  id: uuidSchema,
  role: messageRoleSchema,
  content: z
    .string()
    .min(1, 'Message content is required')
    .max(MAX_MESSAGE_CONTENT_SIZE),
  token_usage: tokenUsageSchema.optional(),
  timestamp: z.coerce.date(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Import chat message schema
 * Accepts any non-empty string ID because exported sessions may contain
 * UUIDs (legacy) or MongoDB ObjectIds (separate message collection).
 */
export const importChatMessageSchema = chatMessageSchema.extend({
  id: z.string().min(1, 'Message ID is required').max(200),
});

// ============================================================================
// Session Schemas
// ============================================================================

/**
 * Create session request schema
 */
export const createSessionSchema = z.object({
  working_directory: z
    .string()
    .min(1, 'Working directory is required')
    .max(1000, 'Working directory path too long'),
  model: aiModelSchema,
  name: z
    .string()
    .min(1, 'Name must be at least 1 character')
    .max(200, 'Name must be at most 200 characters')
    .optional(),
  git_branch: z.string().min(1).max(200).optional(),
  source: z.string().min(1).max(50).optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Update session request schema
 */
export const updateSessionSchema = z.object({
  name: z
    .string()
    .min(1, 'Name must be at least 1 character')
    .max(200, 'Name must be at most 200 characters')
    .optional(),
  is_archived: z.boolean().optional(),
  is_pinned: z.boolean().optional(),
  git_branch: z.string().min(1).max(200).optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Session ID parameter schema
 * Uses ObjectId format since that's what MongoDB generates
 */
export const sessionIdParamSchema = z.object({
  id: objectIdSchema,
});

/**
 * Message ID parameter schema
 * For routes like /:id/messages/:messageId
 */
export const messageIdParamSchema = z.object({
  id: objectIdSchema,
  messageId: objectIdSchema,
});

/**
 * Get session query schema (for message pagination)
 */
export const getSessionQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().int().min(1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 50))
    .pipe(z.number().int().min(1).max(200)),
});

// ============================================================================
// Message Schemas
// ============================================================================

/**
 * Add message request schema with content validation
 */
export const addMessageSchema = z.object({
  role: messageRoleSchema,
  content: z
    .string()
    .min(1, 'Message content is required')
    .max(
      MAX_MESSAGE_CONTENT_SIZE,
      `Message content exceeds ${MAX_MESSAGE_CONTENT_SIZE / 1024}KB limit`
    ),
  client_message_id: z
    .string()
    .min(1, 'client_message_id cannot be empty')
    .max(200, 'client_message_id is too long')
    .optional(),
  token_usage: z
    .object({
      input_tokens: z.number().int().min(0).optional(),
      output_tokens: z.number().int().min(0).optional(),
      cached_tokens: z.number().int().min(0).optional(),
      reasoning_tokens: z.number().int().min(0).optional(),
      total_tokens: z.number().int().min(0).optional(),
    })
    .optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Edit message request schema
 */
export const editMessageSchema = z.object({
  content: z
    .string()
    .min(1, 'Message content is required')
    .max(
      MAX_MESSAGE_CONTENT_SIZE,
      `Message content exceeds ${MAX_MESSAGE_CONTENT_SIZE / 1024}KB limit`
    ),
});

// ============================================================================
// Checkpoint Schemas
// ============================================================================

/**
 * Create checkpoint request schema
 */
export const createCheckpointSchema = z.object({
  snapshot: z
    .string()
    .min(1, 'Snapshot is required')
    .max(
      MAX_CHECKPOINT_SNAPSHOT_SIZE,
      `Snapshot exceeds ${MAX_CHECKPOINT_SNAPSHOT_SIZE / 1024}KB limit`
    ),
  reason: z.string().min(1).max(100).optional(),
  message_id: objectIdSchema.optional(),
  token_count: z.number().int().min(0).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ============================================================================
// Query Schemas
// ============================================================================

/**
 * List sessions query schema
 */
export const listSessionsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().int().min(1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .pipe(z.number().int().min(1).max(100)),
  include_archived: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
  archived_only: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
  working_directory_hash: z.string().optional(),
  q: z.string().min(1).max(200).optional(),
  model: aiModelSchema.optional(),
  parent_session_id: objectIdSchema.optional(),
  root_session_id: objectIdSchema.optional(),
  sort_by: z
    .enum(['updated_at', 'created_at', 'last_message_at', 'last_resumed_at', 'name'])
    .optional(),
  sort_order: z.enum(['asc', 'desc']).optional(),
});

/**
 * Search messages query schema
 */
export const searchMessagesQuerySchema = z.object({
  q: z
    .string()
    .min(1, 'Search query is required')
    .max(200, 'Search query too long (max 200 characters)'),
  session_id: objectIdSchema.optional(),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().int().min(1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .pipe(z.number().int().min(1).max(100)),
  role: messageRoleSchema.optional(),
  date_from: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined))
    .pipe(z.date().optional()),
  date_to: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined))
    .pipe(z.date().optional()),
});

/**
 * Delete all sessions query schema
 */
export const deleteAllSessionsQuerySchema = z.object({
  confirm: z
    .string()
    .transform((val) => val === 'true')
    .refine((val) => val === true, {
      message: 'Must pass confirm=true to delete all sessions',
    }),
});

/**
 * Export session query schema
 */
export const exportSessionQuerySchema = z.object({
  format: z.enum(['json', 'markdown']).default('json'),
});

/**
 * Import session request schema
 */
export const importSessionSchema = z.object({
  session_data: z.object({
    id: z.string(), // Accept any string format for import flexibility
    user_id: z.string(),
    name: z.string(),
    working_directory: z.string(),
    working_directory_hash: z.string(),
    messages: z.array(importChatMessageSchema),
    token_usage: tokenUsageSchema,
    model: aiModelSchema,
    parent_session_id: z.string().optional(),
    root_session_id: z.string().optional(),
    branch_point_sequence: z.number().int().min(0).optional(),
    forked_from_message_id: z.string().optional(),
    branch_depth: z.number().int().min(0).optional(),
    source: z.string().optional(),
    git_branch: z.string().optional(),
    last_message_at: z.coerce.date().optional(),
    last_message_preview: z.string().optional(),
    last_message_role: messageRoleSchema.optional(),
    last_message_sequence: z.number().int().min(0).optional(),
    last_resumed_at: z.coerce.date().optional(),
    resume_count: z.number().int().min(0).optional(),
    checkpoint_count: z.number().int().min(0).optional(),
    latest_checkpoint_at: z.coerce.date().optional(),
    is_pinned: z.boolean().optional(),
    metadata: z.record(z.unknown()).optional(),
    is_archived: z.boolean(),
    created_at: z.coerce.date(),
    updated_at: z.coerce.date(),
  }),
});

/**
 * Acknowledge message delivery request schema
 */
export const acknowledgeMessagesSchema = z.object({
  message_ids: z
    .array(objectIdSchema)
    .min(1, 'At least one message ID is required')
    .max(100, 'Cannot acknowledge more than 100 messages at once'),
});

/**
 * Download attachment params schema
 */
export const downloadAttachmentParamsSchema = z.object({
  sessionId: objectIdSchema,
  fileName: z
    .string()
    .min(1, 'File name is required')
    .max(255, 'File name is too long')
    .regex(/^[^\\/]+$/, 'Invalid file name'),
});

/**
 * Resume session request schema
 */
export const resumeSessionSchema = z.object({
  last_seen_sequence: z.number().int().min(0).optional(),
  message_limit: z.number().int().min(1).max(200).optional(),
  client_session_id: z.string().min(1).max(200).optional(),
  client_metadata: z.record(z.unknown()).optional(),
});

/**
 * Fork session request schema
 */
export const forkSessionSchema = z
  .object({
    name: z
      .string()
      .min(1, 'Name must be at least 1 character')
      .max(200, 'Name must be at most 200 characters')
      .optional(),
    branch_after_sequence: z.number().int().min(0).optional(),
    forked_from_message_id: objectIdSchema.optional(),
    include_checkpoints: z.boolean().optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .refine(
    (value) =>
      value.branch_after_sequence === undefined ||
      value.forked_from_message_id === undefined,
    {
      message: 'Use either branch_after_sequence or forked_from_message_id, not both',
      path: ['branch_after_sequence'],
    }
  );

/**
 * Clear session request schema
 */
export const clearSessionSchema = z.object({
  create_checkpoint: z.boolean().optional(),
  checkpoint_snapshot: z
    .string()
    .min(1)
    .max(
      MAX_CHECKPOINT_SNAPSHOT_SIZE,
      `Snapshot exceeds ${MAX_CHECKPOINT_SNAPSHOT_SIZE / 1024}KB limit`
    )
    .optional(),
});

// ============================================================================
// Type Exports (for TypeScript inference)
// ============================================================================

export type CreateSessionSchema = z.infer<typeof createSessionSchema>;
export type UpdateSessionSchema = z.infer<typeof updateSessionSchema>;
export type AddMessageSchema = z.infer<typeof addMessageSchema>;
export type EditMessageSchema = z.infer<typeof editMessageSchema>;
export type CreateCheckpointSchema = z.infer<typeof createCheckpointSchema>;
export type ListSessionsQuerySchema = z.infer<typeof listSessionsQuerySchema>;
export type SearchMessagesQuerySchema = z.infer<typeof searchMessagesQuerySchema>;
export type DeleteAllSessionsQuerySchema = z.infer<
  typeof deleteAllSessionsQuerySchema
>;
export type ExportSessionQuerySchema = z.infer<typeof exportSessionQuerySchema>;
export type ImportSessionSchema = z.infer<typeof importSessionSchema>;
export type GetSessionQuerySchema = z.infer<typeof getSessionQuerySchema>;
export type AcknowledgeMessagesSchema = z.infer<typeof acknowledgeMessagesSchema>;
export type DownloadAttachmentParamsSchema = z.infer<
  typeof downloadAttachmentParamsSchema
>;
export type ResumeSessionSchema = z.infer<typeof resumeSessionSchema>;
export type ForkSessionSchema = z.infer<typeof forkSessionSchema>;
export type ClearSessionSchema = z.infer<typeof clearSessionSchema>;
