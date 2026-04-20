/**
 * Chat Session Validation Schemas
 *
 * Zod schemas for validating chat session-related data.
 * These schemas are shared between frontend and backend.
 */

import { z } from 'zod';

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
export const messageRoleSchema = z.enum(['user', 'assistant', 'system'], {
  errorMap: () => ({ message: 'Role must be user, assistant, or system' }),
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
  total_tokens: z.number().int().min(0).default(0),
});

/**
 * Chat message schema
 */
export const chatMessageSchema = z.object({
  id: uuidSchema,
  role: messageRoleSchema,
  content: z.string().min(1, 'Message content is required').max(100000),
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
    .max(10240, 'Message content exceeds 10KB limit'),
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
    .max(10240, 'Message content exceeds 10KB limit'),
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
    .max(50000, 'Snapshot too long'),
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
  working_directory_hash: z.string().optional(),
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
