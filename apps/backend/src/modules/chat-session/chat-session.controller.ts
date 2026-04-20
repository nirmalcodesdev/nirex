import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { chatSessionService } from './chat-session.service.js';
import { sseManager } from './sse.manager.js';
import { fileStorageService, validateFile } from './file-storage.service.js';
import {
  type CreateSessionRequest,
  type UpdateSessionRequest,
  type AddMessageRequest,
  type CreateCheckpointRequest,
  type ImportSessionRequest,
  type ExportFormat,
} from '@nirex/shared';
import { AppError } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

function getHeader(req: Request, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function parseMultipartUpload(
  body: Buffer,
  contentType: string
): UploadedFile | null {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundary = boundaryMatch?.[1] || boundaryMatch?.[2];

  if (!boundary) {
    return null;
  }

  const parts = body.toString('latin1').split(`--${boundary}`);

  for (const part of parts) {
    const trimmed = part.replace(/^\r\n/, '').replace(/\r\n$/, '');
    if (!trimmed || trimmed === '--') {
      continue;
    }

    const headerEnd = trimmed.indexOf('\r\n\r\n');
    if (headerEnd === -1) {
      continue;
    }

    const headerText = trimmed.slice(0, headerEnd);
    const fileNameMatch = headerText.match(/filename="([^"]+)"/i);
    if (!fileNameMatch) {
      continue;
    }

    let contentText = trimmed.slice(headerEnd + 4);
    if (contentText.endsWith('\r\n')) {
      contentText = contentText.slice(0, -2);
    }

    const mimeTypeMatch = headerText.match(/content-type:\s*([^\r\n]+)/i);
    const buffer = Buffer.from(contentText, 'latin1');
    const originalname = fileNameMatch[1] || 'upload.bin';

    return {
      buffer,
      originalname,
      mimetype: mimeTypeMatch?.[1]?.trim() || 'application/octet-stream',
      size: buffer.length,
    };
  }

  return null;
}

function extractUploadedFile(req: Request): UploadedFile | null {
  const multerFile = (req as Request & { file?: UploadedFile }).file;
  if (multerFile) {
    return multerFile;
  }

  if (!Buffer.isBuffer(req.body)) {
    return null;
  }

  const contentType = getHeader(req, 'content-type') || 'application/octet-stream';

  if (contentType.includes('multipart/form-data')) {
    return parseMultipartUpload(req.body, contentType);
  }

  const originalName =
    getHeader(req, 'x-file-name') ||
    getHeader(req, 'x-upload-filename') ||
    (typeof req.query.file_name === 'string' ? req.query.file_name : undefined);

  if (!originalName) {
    throw new AppError(
      'File name header x-file-name is required for raw uploads',
      400,
      'MISSING_FILE_NAME'
    );
  }

  return {
    buffer: req.body,
    originalname: originalName,
    mimetype: (contentType.split(';', 1)[0] || 'application/octet-stream').trim(),
    size: req.body.length,
  };
}

/**
 * Helper to get user ID from request
 */
function getUserId(req: Request): Types.ObjectId {
  if (!req.userId) {
    throw new AppError('Unauthorized', 401, 'UNAUTHENTICATED');
  }
  return new Types.ObjectId(req.userId);
}

/**
 * Helper to get session ID from request params
 */
function getSessionId(req: Request): string {
  const { id } = req.params;
  if (!id) {
    throw new AppError('Session ID is required', 400, 'MISSING_SESSION_ID');
  }
  return id;
}

// ============================================================================
// Session CRUD
// ============================================================================

/**
 * POST /api/sessions
 * Create a new session
 */
export async function createSession(
  req: Request,
  res: Response
): Promise<void> {
  const userId = getUserId(req);
  const { working_directory, model } = req.body as CreateSessionRequest;

  const session = await chatSessionService.createSession(
    userId,
    working_directory,
    model
  );

  res.status(201).json({
    status: 'success',
    data: { session },
  });
}

/**
 * GET /api/sessions
 * List all sessions for current user
 */
export async function listSessions(
  req: Request,
  res: Response
): Promise<void> {
  const userId = getUserId(req);
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const includeArchived = req.query.include_archived === 'true';
  const workingDirectoryHash = req.query.working_directory_hash as
    | string
    | undefined;

  const result = await chatSessionService.listSessions(
    userId,
    page,
    limit,
    includeArchived,
    workingDirectoryHash
  );

  res.json({
    status: 'success',
    data: result,
  });
}

/**
 * GET /api/sessions/:id
 * Get single session with full message history (paginated)
 */
export async function getSession(
  req: Request,
  res: Response
): Promise<void> {
  const userId = getUserId(req);
  const sessionId = getSessionId(req);
  const messagePage = parseInt(req.query.page as string) || 1;
  const messageLimit = parseInt(req.query.limit as string) || 50;

  const result = await chatSessionService.getSession(
    sessionId,
    userId,
    messagePage,
    messageLimit
  );

  res.json({
    status: 'success',
    data: result,
  });
}

/**
 * PATCH /api/sessions/:id
 * Update session name or archive status
 */
export async function updateSession(
  req: Request,
  res: Response
): Promise<void> {
  const userId = getUserId(req);
  const sessionId = getSessionId(req);
  const updateData = req.body as UpdateSessionRequest;

  const session = await chatSessionService.updateSession(
    sessionId,
    userId,
    updateData
  );

  res.json({
    status: 'success',
    data: { session },
  });
}

/**
 * DELETE /api/sessions/:id
 * Delete session permanently
 */
export async function deleteSession(
  req: Request,
  res: Response
): Promise<void> {
  const userId = getUserId(req);
  const sessionId = getSessionId(req);

  await chatSessionService.deleteSession(sessionId, userId);

  res.json({
    status: 'success',
    message: 'Session deleted successfully',
  });
}

/**
 * DELETE /api/sessions
 * Delete all sessions for user
 */
export async function deleteAllSessions(
  req: Request,
  res: Response
): Promise<void> {
  const userId = getUserId(req);
  // `deleteAllSessionsQuerySchema` transforms `confirm` into a boolean.
  // Be defensive here in case validation middleware is changed/removed.
  const confirmValue = (req.query as Record<string, unknown>).confirm;
  const confirm = confirmValue === true || confirmValue === 'true';

  if (!confirm) {
    throw new AppError(
      'Must pass confirm=true to delete all sessions',
      400,
      'CONFIRMATION_REQUIRED'
    );
  }

  const deletedCount = await chatSessionService.deleteAllSessions(userId);

  res.json({
    status: 'success',
    data: { deleted_count: deletedCount },
  });
}

// ============================================================================
// Search
// ============================================================================

/**
 * GET /api/sessions/search
 * Search messages across sessions with full-text search
 */
export async function searchMessages(
  req: Request,
  res: Response
): Promise<void> {
  const userId = getUserId(req);
  const query = req.query.q as string;
  const sessionId = req.query.session_id as string | undefined;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  if (!query || query.trim().length === 0) {
    throw new AppError('Search query is required', 400, 'MISSING_SEARCH_QUERY');
  }

  if (query.length > 200) {
    throw new AppError('Search query too long (max 200 characters)', 400, 'QUERY_TOO_LONG');
  }

  const result = await chatSessionService.searchMessages(
    userId,
    query,
    sessionId,
    page,
    limit
  );

  res.json({
    status: 'success',
    data: result,
  });
}

// ============================================================================
// Messages
// ============================================================================

/**
 * POST /api/sessions/:id/messages
 * Append a new message turn to session
 */
export async function addMessage(
  req: Request,
  res: Response
): Promise<void> {
  const userId = getUserId(req);
  const sessionId = getSessionId(req);
  const { role, content, token_usage, client_message_id } = req.body as AddMessageRequest;
  // Metadata may be included but is not part of the main type
  const metadata = (req.body as Record<string, unknown>).metadata as Record<string, unknown> | undefined;

  const result = await chatSessionService.addMessage(
    sessionId,
    userId,
    role,
    content,
    token_usage,
    metadata,
    client_message_id
  );

  res.status(201).json({
    status: 'success',
    data: {
      message: result.message,
      session: result.session,
      checkpoint_created: result.checkpointCreated,
      is_duplicate: result.isDuplicate,
    },
  });
}

/**
 * PATCH /api/sessions/:sessionId/messages/:messageId
 * Edit an existing message
 */
export async function editMessage(
  req: Request,
  res: Response
): Promise<void> {
  const userId = getUserId(req);
  const sessionId = getSessionId(req);
  const { messageId } = req.params;
  const { content } = req.body;

  if (!messageId) {
    throw new AppError('Message ID is required', 400, 'MISSING_MESSAGE_ID');
  }

  if (!content || typeof content !== 'string') {
    throw new AppError('Content is required', 400, 'MISSING_CONTENT');
  }

  const result = await chatSessionService.editMessage(
    sessionId,
    messageId,
    userId,
    content
  );

  res.json({
    status: 'success',
    data: result,
  });
}

/**
 * DELETE /api/sessions/:sessionId/messages/:messageId
 * Soft delete a message
 */
export async function deleteMessage(
  req: Request,
  res: Response
): Promise<void> {
  const userId = getUserId(req);
  const sessionId = getSessionId(req);
  const { messageId } = req.params;

  if (!messageId) {
    throw new AppError('Message ID is required', 400, 'MISSING_MESSAGE_ID');
  }

  const result = await chatSessionService.deleteMessage(
    sessionId,
    messageId,
    userId
  );

  res.json({
    status: 'success',
    data: result,
  });
}

/**
 * POST /api/sessions/:sessionId/messages/acknowledge
 * Acknowledge message delivery
 */
export async function acknowledgeMessages(
  req: Request,
  res: Response
): Promise<void> {
  const userId = getUserId(req);
  const sessionId = getSessionId(req);
  const { message_ids } = req.body as { message_ids: string[] };

  if (!Array.isArray(message_ids) || message_ids.length === 0) {
    throw new AppError('message_ids array is required', 400, 'MISSING_MESSAGE_IDS');
  }

  if (message_ids.length > 100) {
    throw new AppError('Cannot acknowledge more than 100 messages at once', 400, 'TOO_MANY_MESSAGES');
  }

  const result = await chatSessionService.acknowledgeMessages(
    sessionId,
    message_ids,
    userId
  );

  res.json({
    status: 'success',
    data: result,
  });
}

// ============================================================================
// Checkpoints
// ============================================================================

/**
 * POST /api/sessions/:id/checkpoints
 * Save a compaction checkpoint snapshot
 */
export async function createCheckpoint(
  req: Request,
  res: Response
): Promise<void> {
  const userId = getUserId(req);
  const sessionId = getSessionId(req);
  const { snapshot } = req.body as CreateCheckpointRequest;

  const checkpoint = await chatSessionService.createCheckpoint(
    sessionId,
    userId,
    snapshot
  );

  res.status(201).json({
    status: 'success',
    data: { checkpoint },
  });
}

/**
 * GET /api/sessions/:id/checkpoints
 * List checkpoints for a session
 */
export async function listCheckpoints(
  req: Request,
  res: Response
): Promise<void> {
  const userId = getUserId(req);
  const sessionId = getSessionId(req);
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  const result = await chatSessionService.listCheckpoints(
    sessionId,
    userId,
    page,
    limit
  );

  res.json({
    status: 'success',
    data: result,
  });
}

// ============================================================================
// Export / Import
// ============================================================================

/**
 * GET /api/sessions/:id/export
 * Export session as JSON or Markdown
 */
export async function exportSession(
  req: Request,
  res: Response
): Promise<void> {
  const userId = getUserId(req);
  const sessionId = getSessionId(req);
  const format = (req.query.format as ExportFormat) || 'json';

  if (format !== 'json' && format !== 'markdown') {
    throw new AppError(
      'Invalid format. Use json or markdown',
      400,
      'INVALID_EXPORT_FORMAT'
    );
  }

  const content = await chatSessionService.exportSession(sessionId, userId, format);

  // Set appropriate content type and headers
  const contentType = format === 'json' ? 'application/json' : 'text/markdown';
  const extension = format === 'json' ? 'json' : 'md';

  res.setHeader('Content-Type', contentType);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="session-${sessionId}.${extension}"`
  );

  res.send(content);
}

/**
 * POST /api/sessions/import
 * Import a session from JSON
 */
export async function importSession(
  req: Request,
  res: Response
): Promise<void> {
  const userId = getUserId(req);
  const { session_data } = req.body as ImportSessionRequest;

  const session = await chatSessionService.importSession(userId, session_data);

  res.status(201).json({
    status: 'success',
    data: { session },
  });
}

// ============================================================================
// Stats
// ============================================================================

/**
 * GET /api/sessions/stats
 * Return total sessions, total tokens used, cost estimate
 */
export async function getStats(req: Request, res: Response): Promise<void> {
  const userId = getUserId(req);

  const stats = await chatSessionService.getStats(userId);

  res.json({
    status: 'success',
    data: stats,
  });
}

// ============================================================================
// Archived Messages
// ============================================================================

/**
 * GET /api/sessions/:id/archives
 * Get archived message batches for a session
 */
export async function getArchivedMessages(
  req: Request,
  res: Response
): Promise<void> {
  const userId = getUserId(req);
  const sessionId = getSessionId(req);

  const result = await chatSessionService.getArchivedMessages(sessionId, userId);

  res.json({
    status: 'success',
    data: result,
  });
}

// ============================================================================
// SSE (Server-Sent Events)
// ============================================================================

/**
 * GET /api/sessions/stream
 * SSE endpoint for real-time session updates
 */
export async function streamSessions(req: Request, res: Response): Promise<void> {
  const userId = getUserId(req);
  const sessionId = req.query.session_id as string | undefined;

  // Generate unique client ID
  const clientId = `${userId.toString()}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

  // Add client to SSE manager
  await sseManager.addClient(clientId, userId.toString(), res, sessionId);

  // Note: The SSE manager handles the response lifecycle.
  // We don't call res.end() here - the connection stays open.
}

// ============================================================================
// File Attachments
// ============================================================================

/**
 * POST /api/sessions/:id/attachments
 * Upload a file attachment to a session
 */
export async function uploadAttachment(
  req: Request,
  res: Response
): Promise<void> {
  const userId = getUserId(req);
  const sessionId = getSessionId(req);
  await chatSessionService.assertSessionAccess(sessionId, userId);

  const file = extractUploadedFile(req);

  if (!file) {
    throw new AppError('No file provided', 400, 'MISSING_FILE');
  }

  // Validate file
  const validation = validateFile(file.mimetype, file.size);
  if (!validation.valid) {
    throw new AppError(validation.error!, 400, 'INVALID_FILE');
  }

  // Store the file
  const result = await fileStorageService.storeFile(
    file.buffer,
    file.originalname,
    file.mimetype,
    userId.toString(),
    sessionId
  );

  if (!result.success || !result.file) {
    throw new AppError(result.error || 'Failed to store file', 500, 'STORAGE_ERROR');
  }

  logger.info('File uploaded', {
    fileId: result.file.id,
    sessionId,
    userId: userId.toString(),
    size: result.file.size,
  });

  res.status(201).json({
    status: 'success',
    data: {
      file: {
        id: result.file.id,
        name: result.file.originalName,
        size: result.file.size,
        mime_type: result.file.mimeType,
        type: result.file.type,
        url: result.file.url,
        created_at: result.file.createdAt,
      },
    },
  });
}

/**
 * GET /api/files/:sessionId/:fileName
 * Download a file attachment
 */
export async function downloadAttachment(
  req: Request,
  res: Response
): Promise<void> {
  const userId = getUserId(req);
  const { sessionId, fileName } = req.params;

  if (!sessionId || !fileName) {
    throw new AppError('Invalid file path', 400, 'INVALID_PATH');
  }

  await chatSessionService.assertSessionAccess(sessionId, userId);

  const file = await fileStorageService.resolveLocalFile(sessionId, fileName);
  if (!file) {
    throw new AppError('File not found', 404, 'FILE_NOT_FOUND');
  }

  res.download(file.path, file.downloadName);
}
