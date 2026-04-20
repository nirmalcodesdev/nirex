import { Router, raw } from 'express';
import { asyncWrapper } from '../../utils/asyncWrapper.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import {
  apiLimiter,
  messageLimiter,
  sessionCreateLimiter,
  searchLimiter,
  sseConnectionLimiter,
  uploadLimiter,
} from '../../middleware/rateLimiter.js';
import {
  createSessionSchema,
  updateSessionSchema,
  sessionIdParamSchema,
  messageIdParamSchema,
  addMessageSchema,
  editMessageSchema,
  acknowledgeMessagesSchema,
  createCheckpointSchema,
  listSessionsQuerySchema,
  searchMessagesQuerySchema,
  deleteAllSessionsQuerySchema,
  exportSessionQuerySchema,
  importSessionSchema,
  getSessionQuerySchema,
  downloadAttachmentParamsSchema,
} from '@nirex/shared';
import * as chatSessionController from './chat-session.controller.js';

const router: Router = Router();

// ============================================================================
// Authentication Middleware
// ============================================================================

// All routes require JWT authentication
router.use(asyncWrapper(authenticate));

// ============================================================================
// Session Search
// ============================================================================

/**
 * GET /api/sessions/search
 * Search messages across sessions with full-text search
 * Query: ?q=search+query&session_id=optional&page=1&limit=20
 */
router.get(
  '/search',
  searchLimiter,
  validate(searchMessagesQuerySchema, 'query'),
  asyncWrapper(chatSessionController.searchMessages)
);

// ============================================================================
// Session CRUD
// ============================================================================

/**
 * POST /api/sessions
 * Create new session
 * Body: { working_directory: string, model: string }
 */
router.post(
  '/',
  sessionCreateLimiter,
  validate(createSessionSchema),
  asyncWrapper(chatSessionController.createSession)
);

/**
 * GET /api/sessions
 * List all sessions for current user (with pagination)
 * Query: ?page=1&limit=20&include_archived=false&working_directory_hash=...
 */
router.get(
  '/',
  apiLimiter,
  validate(listSessionsQuerySchema, 'query'),
  asyncWrapper(chatSessionController.listSessions)
);

/**
 * GET /api/sessions/stream
 * SSE endpoint for real-time session updates
 * Query: ?session_id=optional_specific_session
 * Note: Not wrapped in asyncWrapper because SSE handles its own response lifecycle
 */
router.get(
  '/stream',
  sseConnectionLimiter,
  chatSessionController.streamSessions
);

/**
 * GET /api/sessions/stats
 * Return total sessions, total tokens used, cost estimate
 */
router.get(
  '/stats',
  apiLimiter,
  asyncWrapper(chatSessionController.getStats)
);

/**
 * GET /api/sessions/:id
 * Get single session with full message history (paginated)
 * Query: ?page=1&limit=50 for message pagination
 */
router.get(
  '/:id',
  apiLimiter,
  validate(sessionIdParamSchema, 'params'),
  validate(getSessionQuerySchema, 'query'),
  asyncWrapper(chatSessionController.getSession)
);

/**
 * PATCH /api/sessions/:id
 * Update session name or archive it
 * Body: { name?: string, is_archived?: boolean }
 */
router.patch(
  '/:id',
  apiLimiter,
  validate(sessionIdParamSchema, 'params'),
  validate(updateSessionSchema),
  asyncWrapper(chatSessionController.updateSession)
);

/**
 * DELETE /api/sessions/:id
 * Delete session permanently
 */
router.delete(
  '/:id',
  apiLimiter,
  validate(sessionIdParamSchema, 'params'),
  asyncWrapper(chatSessionController.deleteSession)
);

/**
 * DELETE /api/sessions
 * Delete all sessions for user
 * Query: ?confirm=true
 */
router.delete(
  '/',
  apiLimiter,
  validate(deleteAllSessionsQuerySchema, 'query'),
  asyncWrapper(chatSessionController.deleteAllSessions)
);

// ============================================================================
// Session Messages
// ============================================================================

/**
 * POST /api/sessions/:id/messages
 * Append a new message turn to session
 * Rate limited separately to prevent spam
 * Body: { role: "user"|"assistant"|"system", content: string, token_usage?: {...}, metadata?: {...} }
 */
router.post(
  '/:id/messages',
  messageLimiter, // Stricter rate limit for messages
  validate(sessionIdParamSchema, 'params'),
  validate(addMessageSchema),
  asyncWrapper(chatSessionController.addMessage)
);

/**
 * PATCH /api/sessions/:id/messages/:messageId
 * Edit an existing message
 */
router.patch(
  '/:id/messages/:messageId',
  messageLimiter,
  validate(messageIdParamSchema, 'params'),
  validate(editMessageSchema),
  asyncWrapper(chatSessionController.editMessage)
);

/**
 * DELETE /api/sessions/:id/messages/:messageId
 * Soft delete a message
 */
router.delete(
  '/:id/messages/:messageId',
  apiLimiter,
  validate(messageIdParamSchema, 'params'),
  asyncWrapper(chatSessionController.deleteMessage)
);

/**
 * POST /api/sessions/:id/messages/acknowledge
 * Acknowledge message delivery
 */
router.post(
  '/:id/messages/acknowledge',
  apiLimiter,
  validate(sessionIdParamSchema, 'params'),
  validate(acknowledgeMessagesSchema),
  asyncWrapper(chatSessionController.acknowledgeMessages)
);

// ============================================================================
// Checkpoints
// ============================================================================

/**
 * POST /api/sessions/:id/checkpoints
 * Save a compaction checkpoint snapshot
 * Body: { snapshot: string }
 */
router.post(
  '/:id/checkpoints',
  apiLimiter,
  validate(sessionIdParamSchema, 'params'),
  validate(createCheckpointSchema),
  asyncWrapper(chatSessionController.createCheckpoint)
);

/**
 * GET /api/sessions/:id/checkpoints
 * List checkpoints for a session
 */
router.get(
  '/:id/checkpoints',
  apiLimiter,
  validate(sessionIdParamSchema, 'params'),
  asyncWrapper(chatSessionController.listCheckpoints)
);

// ============================================================================
// Archived Messages
// ============================================================================

/**
 * GET /api/sessions/:id/archives
 * Get archived message batches for a session
 */
router.get(
  '/:id/archives',
  apiLimiter,
  validate(sessionIdParamSchema, 'params'),
  asyncWrapper(chatSessionController.getArchivedMessages)
);

// ============================================================================
// Export / Import
// ============================================================================

/**
 * GET /api/sessions/:id/export
 * Export session as JSON or Markdown
 * Query: ?format=json|markdown (default: json)
 */
router.get(
  '/:id/export',
  apiLimiter,
  validate(sessionIdParamSchema, 'params'),
  validate(exportSessionQuerySchema, 'query'),
  asyncWrapper(chatSessionController.exportSession)
);

/**
 * POST /api/sessions/import
 * Import a session from JSON
 * Body: { session_data: IChatSession }
 */
router.post(
  '/import',
  apiLimiter,
  validate(importSessionSchema),
  asyncWrapper(chatSessionController.importSession)
);

// ============================================================================
// File Attachments
// ============================================================================

/**
 * POST /api/sessions/:id/attachments
 * Upload a file attachment to a session
 * Supports: images, documents, code files
 * Max size: 50MB
 */
router.post(
  '/:id/attachments',
  uploadLimiter,
  validate(sessionIdParamSchema, 'params'),
  raw({ type: () => true, limit: '50mb' }),
  asyncWrapper(chatSessionController.uploadAttachment)
);

/**
 * GET /api/files/:sessionId/:fileName
 * Download a file attachment
 */
router.get(
  '/files/:sessionId/:fileName',
  apiLimiter,
  validate(downloadAttachmentParamsSchema, 'params'),
  asyncWrapper(chatSessionController.downloadAttachment)
);

export default router;
