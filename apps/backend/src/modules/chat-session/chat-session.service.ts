import { Types } from 'mongoose';
import { createHash, randomUUID } from 'crypto';
import {
  chatSessionRepository,
  CreateChatSessionData,
  UpdateChatSessionData,
} from './chat-session.repository.js';
import {
  messageRepository,
  CreateMessageData,
} from './message.repository.js';
import { archivedMessagesRepository } from './archived-messages.repository.js';
import { sessionCheckpointRepository } from './session-checkpoint.repository.js';
import { tokenPricingService } from './token-pricing.service.js';
import { sseManager } from './sse.manager.js';
import {
  chatSessionCache,
  MAX_CACHED_MESSAGES,
} from './chat-session.cache.js';
import {
  assertValidMessageContent,
  assertValidMetadata,
  assertValidWorkingDirectory,
  validateSessionName,
} from './content-validator.js';
import { IChatSessionDocument } from './chat-session.model.js';
import { IMessageDocument } from './message.model.js';
import {
  type ChatMessage,
  type TokenUsage,
  type ChatSessionDTO,
  type ChatSessionWithMessages,
  type CheckpointDTO,
  type SessionStatsResponse,
  type ExportFormat,
  type MessageDTO,
  type MessageSearchResult,
  getContextLimit,
  shouldCompact,
  MAX_MESSAGES_PER_DOCUMENT,
  DEFAULT_MESSAGE_PAGE_SIZE,
} from '@nirex/shared';
import { AppError } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

// ============================================================================
// Feature Flag for Migration
// ============================================================================

/**
 * Feature flag to control whether to use the new separate messages collection.
 * When true: Messages are stored in the separate Message collection (production)
 * When false: Messages are embedded in ChatSession (legacy, for migration period)
 */
const USE_SEPARATE_MESSAGE_COLLECTION = process.env.USE_MESSAGE_COLLECTION !== 'false';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Hash a working directory path using SHA-256
 */
export function hashWorkingDirectory(workingDirectory: string): string {
  return createHash('sha256').update(workingDirectory).digest('hex');
}

/**
 * Auto-generate a session name from the first user message
 */
export function generateSessionName(firstMessage: string): string {
  const words = firstMessage.trim().split(/\s+/);
  if (words.length <= 6) {
    return firstMessage.trim();
  }
  return words.slice(0, 6).join(' ') + '...';
}

/**
 * Convert a Mongoose document to ChatSessionDTO
 */
function toSessionDTO(doc: IChatSessionDocument, messageCount?: number): ChatSessionDTO {
  return {
    id: doc._id.toString(),
    name: doc.name,
    working_directory: doc.working_directory,
    working_directory_hash: doc.working_directory_hash,
    message_count: messageCount !== undefined ? messageCount : (doc.messages?.length || 0),
    token_usage: doc.token_usage,
    model: doc.aiModel,
    is_archived: doc.is_archived,
    created_at: doc.created_at,
    updated_at: doc.updated_at,
  };
}

/**
 * Convert IMessageDocument to MessageDTO
 */
function toMessageDTO(doc: IMessageDocument): MessageDTO {
  return {
    id: doc._id.toString(),
    session_id: doc.session_id.toString(),
    sequence_number: doc.sequence_number,
    role: doc.role,
    content: doc.is_deleted ? '[deleted]' : doc.content,
    token_usage: doc.token_usage,
    client_message_id: doc.client_message_id,
    delivery_status: doc.delivery_status,
    metadata: doc.metadata,
    attachment_ids: doc.attachment_ids?.map((id) => id.toString()),
    is_deleted: doc.is_deleted,
    edited_at: doc.edited_at,
    created_at: doc.created_at,
  };
}

/**
 * Convert IMessageDocument array to legacy ChatMessage array
 * For backward compatibility during migration
 */
function toChatMessages(docs: IMessageDocument[]): ChatMessage[] {
  return docs.map((doc) => ({
    id: doc._id.toString(),
    role: doc.role,
    content: doc.is_deleted ? '[deleted]' : doc.content,
    token_usage: doc.token_usage,
    timestamp: doc.created_at,
    metadata: doc.metadata,
  }));
}

function normalizeTokenUsage(
  tokenUsage?: Partial<TokenUsage>
): TokenUsage | undefined {
  if (!tokenUsage) {
    return undefined;
  }

  const inputTokens = tokenUsage.input_tokens || 0;
  const outputTokens = tokenUsage.output_tokens || 0;
  const cachedTokens = tokenUsage.cached_tokens || 0;

  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cached_tokens: cachedTokens,
    total_tokens:
      tokenUsage.total_tokens !== undefined
        ? tokenUsage.total_tokens
        : inputTokens + outputTokens,
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 11000
  );
}

function hasDuplicateKeyField(error: unknown, field: string): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const errorWithKeys = error as {
    keyPattern?: Record<string, unknown>;
    keyValue?: Record<string, unknown>;
    message?: string;
  };

  if (errorWithKeys.keyPattern && field in errorWithKeys.keyPattern) {
    return true;
  }

  if (errorWithKeys.keyValue && field in errorWithKeys.keyValue) {
    return true;
  }

  return typeof errorWithKeys.message === 'string' && errorWithKeys.message.includes(field);
}

function isSequenceNumberDuplicateKeyError(error: unknown): boolean {
  return (
    isDuplicateKeyError(error) &&
    (hasDuplicateKeyField(error, 'sequence_number') ||
      !hasDuplicateKeyField(error, 'client_message_id'))
  );
}

function mergeAndSortMessages(...messageSets: ChatMessage[][]): ChatMessage[] {
  const deduped = new Map<string, ChatMessage>();

  for (const message of messageSets.flat()) {
    deduped.set(message.id, message);
  }

  return [...deduped.values()].sort(
    (left, right) => left.timestamp.getTime() - right.timestamp.getTime()
  );
}

/**
 * Convert a Mongoose document to ChatSessionWithMessages
 */
function toSessionWithMessages(
  doc: IChatSessionDocument,
  messages: ChatMessage[]
): ChatSessionWithMessages {
  return {
    ...toSessionDTO(doc),
    messages,
  };
}

/**
 * Convert a checkpoint document to CheckpointDTO
 */
function toCheckpointDTO(checkpoint: {
  _id: Types.ObjectId;
  turn_index: number;
  created_at: Date;
}): CheckpointDTO {
  return {
    id: checkpoint._id.toString(),
    turn_index: checkpoint.turn_index,
    created_at: checkpoint.created_at,
  };
}

// ============================================================================
// Chat Session Service
// ============================================================================

export class ChatSessionService {
  private async getOwnedSession(
    sessionId: string,
    userId: Types.ObjectId
  ): Promise<IChatSessionDocument> {
    const session = await chatSessionRepository.findById(sessionId);

    if (!session) {
      throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
    }

    if (session.userId.toString() !== userId.toString()) {
      throw new AppError(
        'You do not have access to this session',
        403,
        'SESSION_ACCESS_DENIED'
      );
    }

    return session;
  }

  private assertMessageBelongsToSession(
    actualSessionId: string | Types.ObjectId,
    expectedSessionId: string
  ): void {
    if (actualSessionId.toString() !== expectedSessionId) {
      throw new AppError('Message not found', 404, 'MESSAGE_NOT_FOUND');
    }
  }

  async assertSessionAccess(
    sessionId: string,
    userId: Types.ObjectId
  ): Promise<void> {
    await this.getOwnedSession(sessionId, userId);
  }

  /**
   * Create a new chat session
   */
  async createSession(
    userId: Types.ObjectId,
    workingDirectory: string,
    model: string
  ): Promise<ChatSessionDTO> {
    const sanitizedWorkingDirectory = assertValidWorkingDirectory(workingDirectory);
    const workingDirectoryHash = hashWorkingDirectory(sanitizedWorkingDirectory);

    const data: CreateChatSessionData = {
      userId,
      name: 'New Session',
      working_directory: sanitizedWorkingDirectory,
      working_directory_hash: workingDirectoryHash,
      aiModel: model,
    };

    const session = await chatSessionRepository.create(data);
    const sessionDTO = toSessionDTO(session);

    // Cache the new session
    await chatSessionCache.setSession(sessionDTO);

    // Invalidate user's session list cache
    await chatSessionCache.invalidateUserSessions(userId.toString());

    // Notify via SSE
    await sseManager.broadcastToUser(userId.toString(), {
      type: 'session_created',
      session: sessionDTO,
    });

    return sessionDTO;
  }

  /**
   * List sessions for a user with pagination
   */
  async listSessions(
    userId: Types.ObjectId,
    page: number = 1,
    limit: number = 20,
    includeArchived: boolean = false,
    workingDirectoryHash?: string
  ): Promise<{ sessions: ChatSessionDTO[]; pagination: { page: number; limit: number; total: number; total_pages: number } }> {
    const result = await chatSessionRepository.list(
      {
        userId,
        includeArchived,
        workingDirectoryHash,
      },
      page,
      limit
    );

    let sessions = result.data.map(toSessionDTO);
    if (USE_SEPARATE_MESSAGE_COLLECTION && result.data.length > 0) {
      const counts = await messageRepository.getCountsForSessions(
        result.data.map((session) => session._id)
      );
      sessions = result.data.map((session) =>
        toSessionDTO(session, counts.get(session._id.toString()) || 0)
      );
    }

    return {
      sessions,
      pagination: result.pagination,
    };
  }

  /**
   * Get a single session by ID with optional message pagination
   */
  async getSession(
    sessionId: string,
    userId: Types.ObjectId,
    messagePage: number = 1,
    messageLimit: number = DEFAULT_MESSAGE_PAGE_SIZE
  ): Promise<{ session: ChatSessionWithMessages; messages_pagination?: { page: number; limit: number; total: number; total_pages: number; has_more: boolean } }> {
    // Try to get session from cache first
    const cachedSession = await chatSessionCache.getSession(sessionId);
    const session = await this.getOwnedSession(sessionId, userId);

    if (!cachedSession) {
      await chatSessionCache.setSession(toSessionDTO(session));
    }

    let messages: ChatMessage[] = [];
    let pagination: { page: number; limit: number; total: number; total_pages: number; has_more: boolean } | undefined;
    let messageCount: number;

    // Try to get recent messages from cache for first page
    if (
      messagePage === 1 &&
      messageLimit <= MAX_CACHED_MESSAGES &&
      USE_SEPARATE_MESSAGE_COLLECTION
    ) {
      const cachedMessages = await chatSessionCache.getSessionMessages(sessionId);
      if (cachedMessages && cachedMessages.length > 0) {
        logger.debug('Cache hit: session messages', { sessionId, count: cachedMessages.length });
        // Convert cached MessageDTOs directly to ChatMessage format
        messages = cachedMessages
          .slice(0, messageLimit)
          .reverse()
          .map((m) => ({
            id: m.id,
            role: m.role,
            content: m.is_deleted ? '[deleted]' : m.content,
            timestamp: m.created_at,
            token_usage: m.token_usage,
            metadata: m.metadata,
          }));

        // Get total count from database
        messageCount = await messageRepository.countForSession(new Types.ObjectId(sessionId));
        const sessionDTO = toSessionDTO(session, messageCount);
        await chatSessionCache.setSession(sessionDTO);
        pagination = {
          page: 1,
          limit: messageLimit,
          total: messageCount,
          total_pages: Math.ceil(messageCount / messageLimit),
          has_more: messageCount > messageLimit,
        };

        return {
          session: {
            ...sessionDTO,
            messages,
          },
          messages_pagination: pagination,
        };
      }
    }

    if (USE_SEPARATE_MESSAGE_COLLECTION) {
      // Use new message repository
      const messagesResult = await messageRepository.listForSessionPaginated(
        new Types.ObjectId(sessionId),
        messagePage,
        messageLimit
      );
      messages = toChatMessages(messagesResult.data);
      pagination = messagesResult.pagination;
      messageCount = await messageRepository.countForSession(new Types.ObjectId(sessionId));

      // Cache messages for first page
      if (messagePage === 1) {
        const cacheSeed =
          messageLimit >= MAX_CACHED_MESSAGES
            ? messagesResult.data
            : (
                await messageRepository.listForSessionPaginated(
                  new Types.ObjectId(sessionId),
                  1,
                  MAX_CACHED_MESSAGES
                )
              ).data;

        await chatSessionCache.setSessionMessages(
          sessionId,
          cacheSeed.map(toMessageDTO)
        );
      }
    } else {
      // Use legacy embedded messages
      const messagesResult = await chatSessionRepository.getMessagesPaginated(
        sessionId,
        messagePage,
        messageLimit
      );
      messages = messagesResult.messages;
      pagination = messagesResult.pagination;
      messageCount = session.messages?.length || 0;
    }

    await chatSessionCache.setSession(toSessionDTO(session, messageCount));

    return {
      session: {
        ...toSessionDTO(session, messageCount),
        messages,
      },
      messages_pagination: pagination,
    };
  }

  /**
   * Update a session (name or archive status)
   */
  async updateSession(
    sessionId: string,
    userId: Types.ObjectId,
    data: UpdateChatSessionData
  ): Promise<ChatSessionDTO> {
    // First verify ownership
    const existing = await chatSessionRepository.findById(sessionId);

    if (!existing) {
      throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
    }

    if (existing.userId.toString() !== userId.toString()) {
      throw new AppError(
        'You do not have access to this session',
        403,
        'SESSION_ACCESS_DENIED'
      );
    }

    // Validate and sanitize name if provided
    if (data.name !== undefined) {
      const nameValidation = validateSessionName(data.name);
      if (!nameValidation.valid) {
        throw new AppError(nameValidation.error!, 400, 'VALIDATION_ERROR');
      }
      data.name = nameValidation.sanitized;
    }

    const updated = await chatSessionRepository.update(sessionId, data);

    if (!updated) {
      throw new AppError('Failed to update session', 500, 'INTERNAL_ERROR');
    }

    // Invalidate session cache
    await chatSessionCache.invalidateSession(sessionId);
    await chatSessionCache.invalidateUserSessions(userId.toString());

    // Notify via SSE
    await sseManager.notifySessionUpdate(sessionId, userId.toString(), {
      type: 'updated',
      changes: data,
    });

    const messageCount = USE_SEPARATE_MESSAGE_COLLECTION
      ? await messageRepository.countForSession(new Types.ObjectId(sessionId))
      : undefined;

    return toSessionDTO(updated, messageCount);
  }

  /**
   * Delete a session permanently
   */
  async deleteSession(
    sessionId: string,
    userId: Types.ObjectId
  ): Promise<void> {
    await this.getOwnedSession(sessionId, userId);

    if (USE_SEPARATE_MESSAGE_COLLECTION) {
      await messageRepository.deleteAllForSession(new Types.ObjectId(sessionId));
    }

    // Delete all checkpoints first
    await sessionCheckpointRepository.deleteAllForSession(
      new Types.ObjectId(sessionId)
    );

    // Delete all archived messages
    await archivedMessagesRepository.deleteAllForSession(
      new Types.ObjectId(sessionId)
    );

    // Delete the session
    const deleted = await chatSessionRepository.delete(sessionId);

    if (!deleted) {
      throw new AppError('Failed to delete session', 500, 'INTERNAL_ERROR');
    }

    // Invalidate all session caches
    await chatSessionCache.invalidateAllSessionCaches(sessionId, userId.toString());

    // Notify via SSE
    await sseManager.broadcastToUser(userId.toString(), {
      type: 'session_deleted',
      sessionId,
    });

    logger.info('Session deleted', {
      sessionId,
      userId: userId.toString(),
    });
  }

  /**
   * Delete all sessions for a user
   */
  async deleteAllSessions(userId: Types.ObjectId): Promise<number> {
    const sessionIds = await chatSessionRepository.findIdsForUser(userId);

    // Delete checkpoints and archives for all sessions
    await Promise.all(
      sessionIds.map((sessionId) =>
        Promise.all([
          USE_SEPARATE_MESSAGE_COLLECTION
            ? messageRepository.deleteAllForSession(sessionId)
            : Promise.resolve(0),
          sessionCheckpointRepository.deleteAllForSession(sessionId),
          archivedMessagesRepository.deleteAllForSession(sessionId),
          chatSessionCache.invalidateAllSessionCaches(sessionId.toString(), userId.toString()),
        ])
      )
    );

    // Delete all sessions
    const deletedCount = await chatSessionRepository.deleteAllForUser(userId);

    // Clear all caches for the user
    await chatSessionCache.invalidateUserSessions(userId.toString());

    // Notify via SSE
    await sseManager.broadcastToUser(userId.toString(), {
      type: 'all_sessions_deleted',
      deletedCount,
    });

    logger.info('All sessions deleted for user', {
      userId: userId.toString(),
      deletedCount,
    });

    return deletedCount;
  }

  /**
   * Add a message to a session
   * Includes content validation, deduplication, and delivery tracking
   */
  async addMessage(
    sessionId: string,
    userId: Types.ObjectId,
    role: 'user' | 'assistant' | 'system',
    content: string,
    tokenUsage?: Partial<TokenUsage>,
    metadata?: Record<string, unknown>,
    clientMessageId?: string
  ): Promise<{ message: MessageDTO | ChatMessage; session: ChatSessionDTO; checkpointCreated: boolean; isDuplicate?: boolean }> {
    const existing = await this.getOwnedSession(sessionId, userId);

    // Validate and sanitize content
    const sanitizedContent = assertValidMessageContent(content);
    const normalizedTokenUsage = normalizeTokenUsage(tokenUsage);

    // Validate metadata if provided
    if (metadata) {
      assertValidMetadata(metadata);
    }

    // Check for duplicate using client message ID
    if (clientMessageId && USE_SEPARATE_MESSAGE_COLLECTION) {
      const existingMessage = await messageRepository.findByClientMessageId(
        new Types.ObjectId(sessionId),
        clientMessageId
      );

      if (existingMessage) {
        logger.debug('Duplicate message detected', { sessionId, clientMessageId });
        const messageCount = await messageRepository.countForSession(new Types.ObjectId(sessionId));
        const currentSession = await this.getOwnedSession(sessionId, userId);
        return {
          message: toMessageDTO(existingMessage),
          session: toSessionDTO(currentSession, messageCount),
          checkpointCreated: false,
          isDuplicate: true,
        };
      }
    }

    // Check if we need auto-compaction before adding message
    const currentTokens = existing.token_usage?.total_tokens || 0;
    const autoCheckpointThreshold = Math.ceil(getContextLimit(existing.aiModel) * 0.8);
    const needsCompaction = shouldCompact(existing.aiModel, currentTokens);
    const autoCheckpointAlreadyCreated =
      existing.last_auto_checkpoint_tokens !== undefined &&
      existing.last_auto_checkpoint_tokens >= autoCheckpointThreshold;
    let checkpointCreated = false;

    // Auto-create checkpoint if needed
    if (needsCompaction && !autoCheckpointAlreadyCreated) {
      await this.createCheckpoint(
        sessionId,
        userId,
        `Auto-compaction at ${currentTokens} tokens`
      );
      await chatSessionRepository.update(sessionId, {
        last_auto_checkpoint_tokens: currentTokens,
      });
      checkpointCreated = true;

      logger.info('Auto-compaction checkpoint created', {
        sessionId,
        userId: userId.toString(),
        tokenCount: currentTokens,
      });
    }

    if (USE_SEPARATE_MESSAGE_COLLECTION) {
      // Use new message repository
      let sequenceNumber = await chatSessionRepository.reserveNextMessageSequence(
        new Types.ObjectId(sessionId)
      );
      if (!sequenceNumber) {
        throw new AppError('Failed to reserve message sequence', 500, 'INTERNAL_ERROR');
      }

      const sessionObjectId = new Types.ObjectId(sessionId);
      let message: IMessageDocument | undefined;

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const messageData: CreateMessageData = {
          sessionId: sessionObjectId,
          userId,
          role,
          content: sanitizedContent,
          sequenceNumber,
          tokenUsage: normalizedTokenUsage,
          clientMessageId,
          metadata,
          deliveryStatus: 'pending',
        };

        try {
          message = await messageRepository.create(messageData);
          break;
        } catch (error) {
          if (clientMessageId && isDuplicateKeyError(error)) {
            const existingMessage = await messageRepository.findByClientMessageId(
              sessionObjectId,
              clientMessageId
            );
            if (existingMessage) {
              const messageCount = await messageRepository.countForSession(
                sessionObjectId
              );
              const currentSession = await this.getOwnedSession(sessionId, userId);
              return {
                message: toMessageDTO(existingMessage),
                session: toSessionDTO(currentSession, messageCount),
                checkpointCreated,
                isDuplicate: true,
              };
            }
          }

          if (attempt === 0 && isSequenceNumberDuplicateKeyError(error)) {
            const nextAvailableSequence =
              await messageRepository.getNextSequenceNumber(sessionObjectId);
            await chatSessionRepository.setNextMessageSequenceAtLeast(
              sessionId,
              nextAvailableSequence - 1
            );
            const retriedSequence =
              await chatSessionRepository.reserveNextMessageSequence(sessionObjectId);
            if (!retriedSequence) {
              throw new AppError(
                'Failed to reserve message sequence',
                500,
                'INTERNAL_ERROR'
              );
            }
            sequenceNumber = retriedSequence;

            logger.warn('Recovered from stale session message sequence', {
              sessionId,
              userId: userId.toString(),
              retriedSequence,
            });
            continue;
          }

          throw error;
        }
      }

      if (!message) {
        throw new AppError('Failed to create message', 500, 'INTERNAL_ERROR');
      }

      // Mark as delivered immediately for now (in production, this would be done by SSE confirmation)
      const deliveredMessage = (await messageRepository.markDelivered(message._id)) || message;

      // Auto-generate session name if first user message
      const summaryUpdates: Partial<UpdateChatSessionData> = {};
      if (
        role === 'user' &&
        existing.name === 'New Session' &&
        sequenceNumber === 1
      ) {
        const newName = generateSessionName(sanitizedContent);
        summaryUpdates.name = newName;
      }

      const updatedSession = await chatSessionRepository.updateMessageSummary(
        sessionId,
        normalizedTokenUsage || {},
        summaryUpdates
      );
      if (!updatedSession) {
        throw new AppError('Failed to update session summary', 500, 'INTERNAL_ERROR');
      }

      // Get updated message count
      const messageCount = await messageRepository.countForSession(new Types.ObjectId(sessionId));
      const sessionDTO = toSessionDTO(updatedSession, messageCount);

      // Cache the new message
      const messageDTO = toMessageDTO(deliveredMessage);
      await Promise.all([
        chatSessionCache.setSession(sessionDTO),
        chatSessionCache.invalidateUserSessions(userId.toString()),
        chatSessionCache.addMessage(messageDTO),
      ]);

      // Notify via SSE
      await sseManager.notifyNewMessage(sessionId, userId.toString(), messageDTO);

      return {
        message: messageDTO,
        session: sessionDTO,
        checkpointCreated,
        isDuplicate: false,
      };
    } else {
      // Legacy: Use embedded messages
      // Check message count and bucket if needed
      let archived = false;
      const currentMessageCount = existing.messages?.length || 0;

      if (currentMessageCount >= MAX_MESSAGES_PER_DOCUMENT) {
        // Archive old messages before adding new one
        const archiveResult = await chatSessionRepository.archiveOldMessages(
          sessionId,
          100
        );

        if (archiveResult && archiveResult.archived.length > 0) {
          await archivedMessagesRepository.create({
            sessionId: new Types.ObjectId(sessionId),
            userId,
            startIndex: archiveResult.startIndex,
            endIndex: archiveResult.startIndex + archiveResult.archived.length - 1,
            messages: archiveResult.archived,
          });

          archived = true;
          logger.info('Messages archived', {
            sessionId,
            archivedCount: archiveResult.archived.length,
          });
        }
      }

      // Create the message
      const message: ChatMessage = {
        id: randomUUID(),
        role,
        content: sanitizedContent,
        timestamp: new Date(),
        token_usage: normalizedTokenUsage,
        metadata,
      };

      // Auto-generate name if this is the first user message
      if (
        role === 'user' &&
        existing.name === 'New Session' &&
        !existing.messages?.some((m) => m.role === 'user')
      ) {
        const newName = generateSessionName(sanitizedContent);
        await chatSessionRepository.updateName(sessionId, newName);
      }

      // Add the message
      const updated = await chatSessionRepository.addMessage(
        sessionId,
        message,
        normalizedTokenUsage || {}
      );

      if (!updated) {
        throw new AppError('Failed to add message', 500, 'INTERNAL_ERROR');
      }

      await Promise.all([
        chatSessionCache.setSession(toSessionDTO(updated)),
        chatSessionCache.invalidateUserSessions(userId.toString()),
      ]);

      // Notify via SSE
      await sseManager.notifyNewMessage(sessionId, userId.toString(), message);

      return {
        message,
        session: toSessionDTO(updated),
        checkpointCreated,
        isDuplicate: false,
      };
    }
  }

  /**
   * Create a checkpoint for a session
   */
  async createCheckpoint(
    sessionId: string,
    userId: Types.ObjectId,
    snapshot: string
  ): Promise<CheckpointDTO> {
    const existing = await this.getOwnedSession(sessionId, userId);

    // Sanitize snapshot
    const sanitizedSnapshot = assertValidMessageContent(snapshot);

    const turnIndex = USE_SEPARATE_MESSAGE_COLLECTION
      ? await messageRepository.countForSession(new Types.ObjectId(sessionId))
      : existing.messages?.length || 0;

    const checkpoint = await sessionCheckpointRepository.create({
      sessionId: new Types.ObjectId(sessionId),
      snapshot: sanitizedSnapshot,
      turn_index: turnIndex,
    });

    // Notify via SSE
    await sseManager.notifyCheckpointCreated(sessionId, userId.toString(), toCheckpointDTO(checkpoint));

    return toCheckpointDTO(checkpoint);
  }

  /**
   * List checkpoints for a session
   */
  async listCheckpoints(
    sessionId: string,
    userId: Types.ObjectId,
    page: number = 1,
    limit: number = 20
  ): Promise<{ checkpoints: CheckpointDTO[]; pagination: { page: number; limit: number; total: number; total_pages: number } }> {
    // Verify ownership
    const existing = await chatSessionRepository.findById(sessionId);

    if (!existing) {
      throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
    }

    if (existing.userId.toString() !== userId.toString()) {
      throw new AppError(
        'You do not have access to this session',
        403,
        'SESSION_ACCESS_DENIED'
      );
    }

    const result = await sessionCheckpointRepository.listForSession(
      sessionId,
      page,
      limit
    );

    return {
      checkpoints: result.data.map(toCheckpointDTO),
      pagination: result.pagination,
    };
  }

  /**
   * Export a session to JSON or Markdown format
   * Supports streaming for large sessions
   */
  async exportSession(
    sessionId: string,
    userId: Types.ObjectId,
    format: ExportFormat = 'json'
  ): Promise<string> {
    const session = await this.getOwnedSession(sessionId, userId);

    // Collect messages from both legacy and separate storage during the migration period.
    const currentMessages = session.messages || [];
    const archivedDocs = await archivedMessagesRepository.findBySession(sessionId);
    const collectionMessages = USE_SEPARATE_MESSAGE_COLLECTION
      ? toChatMessages(
          await messageRepository.listAllForSession(new Types.ObjectId(sessionId))
        )
      : [];

    const allMessages = mergeAndSortMessages(
      ...archivedDocs.map((doc) => doc.messages),
      currentMessages,
      collectionMessages
    );

    if (format === 'markdown') {
      // Export as Markdown
      const lines: string[] = [
        `# ${session.name}`,
        '',
        `**Model:** ${session.aiModel}`,
        `**Created:** ${session.created_at.toISOString()}`,
        `**Working Directory:** ${session.working_directory}`,
        `**Total Messages:** ${allMessages.length}`,
        '',
        '---',
        '',
      ];

      for (const message of allMessages) {
        const role = message.role.charAt(0).toUpperCase() + message.role.slice(1);
        lines.push(`### ${role} (${message.timestamp.toISOString()})`, '');
        lines.push(message.content);
        lines.push('');

        if (message.token_usage) {
          lines.push(
            `*Tokens: ${message.token_usage.total_tokens} (${message.token_usage.input_tokens} input, ${message.token_usage.output_tokens} output)*`
          );
          lines.push('');
        }

        lines.push('---', '');
      }

      lines.push('', '## Token Usage Summary');
      lines.push(`- **Input Tokens:** ${session.token_usage.input_tokens}`);
      lines.push(`- **Output Tokens:** ${session.token_usage.output_tokens}`);
      lines.push(`- **Total Tokens:** ${session.token_usage.total_tokens}`);

      return lines.join('\n');
    }

    // Export as JSON
    const exportData = {
      id: session._id.toString(),
      user_id: session.userId.toString(),
      name: session.name,
      working_directory: session.working_directory,
      working_directory_hash: session.working_directory_hash,
      messages: allMessages,
      token_usage: session.token_usage,
      model: session.aiModel,
      is_archived: session.is_archived,
      created_at: session.created_at,
      updated_at: session.updated_at,
      exported_at: new Date().toISOString(),
      export_stats: {
        total_messages: allMessages.length,
        archived_batches: archivedDocs.length,
      },
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import a session from JSON data
   */
  async importSession(
    userId: Types.ObjectId,
    sessionData: {
      id: string;
      user_id: string;
      name: string;
      working_directory: string;
      working_directory_hash: string;
      messages: ChatMessage[];
      token_usage: TokenUsage;
      model: string;
      is_archived: boolean;
      created_at: Date;
      updated_at: Date;
    }
  ): Promise<ChatSessionDTO> {
    const sanitizedWorkingDir = assertValidWorkingDirectory(
      sessionData.working_directory
    );
    const normalizedSessionTokenUsage = normalizeTokenUsage(sessionData.token_usage) || {
      input_tokens: 0,
      output_tokens: 0,
      cached_tokens: 0,
      total_tokens: 0,
    };
    const importedNameValidation = validateSessionName(`${sessionData.name} (Imported)`);
    if (!importedNameValidation.valid) {
      throw new AppError(importedNameValidation.error!, 400, 'VALIDATION_ERROR');
    }

    let newSession: IChatSessionDocument | null = null;

    try {
      // Generate new ID and update user_id
      newSession = await chatSessionRepository.create({
        userId,
        name: importedNameValidation.sanitized!,
        working_directory: sanitizedWorkingDir,
        working_directory_hash: hashWorkingDirectory(sanitizedWorkingDir),
        aiModel: sessionData.model,
      });

      // Add messages in batches to avoid hitting document size limit
      const batchSize = 100;
      const messages = sessionData.messages || [];

      if (USE_SEPARATE_MESSAGE_COLLECTION) {
        let sequenceNumber = 0;
        for (const message of messages) {
          sequenceNumber += 1;
          const sanitizedContent = assertValidMessageContent(message.content);
          if (message.metadata) {
            assertValidMetadata(message.metadata);
          }

          await messageRepository.create({
            sessionId: newSession._id,
            userId,
            role: message.role,
            content: sanitizedContent,
            sequenceNumber,
            tokenUsage: normalizeTokenUsage(message.token_usage),
            metadata: message.metadata,
            createdAt: new Date(message.timestamp),
            updatedAt: new Date(message.timestamp),
            deliveryStatus: 'delivered',
            deliveredAt: new Date(message.timestamp),
          });
        }
      } else {
        for (let i = 0; i < messages.length; i += batchSize) {
          const batch = messages.slice(i, i + batchSize);

          for (const message of batch) {
            const sanitizedContent = assertValidMessageContent(message.content);
            if (message.metadata) {
              assertValidMetadata(message.metadata);
            }

            await chatSessionRepository.addMessage(
              newSession._id,
              {
                ...message,
                content: sanitizedContent,
                metadata: message.metadata,
              },
              normalizeTokenUsage(message.token_usage) || {}
            );
          }

          // If we have more than MAX_MESSAGES_PER_DOCUMENT, archive older messages
          if (i + batchSize >= MAX_MESSAGES_PER_DOCUMENT) {
            const archiveResult = await chatSessionRepository.archiveOldMessages(
              newSession._id,
              100
            );

            if (archiveResult && archiveResult.archived.length > 0) {
              await archivedMessagesRepository.create({
                sessionId: newSession._id,
                userId,
                startIndex: archiveResult.startIndex,
                endIndex: archiveResult.startIndex + archiveResult.archived.length - 1,
                messages: archiveResult.archived,
              });
            }
          }
        }
      }

      const finalSession = await chatSessionRepository.update(newSession._id, {
        is_archived: sessionData.is_archived,
        token_usage: normalizedSessionTokenUsage,
        next_message_sequence: messages.length,
        created_at: sessionData.created_at,
        updated_at: sessionData.updated_at,
      });

      if (!finalSession) {
        throw new AppError('Failed to import session', 500, 'IMPORT_FAILED');
      }

      const importedSessionDTO = toSessionDTO(finalSession, messages.length);

      await Promise.all([
        chatSessionCache.setSession(importedSessionDTO),
        chatSessionCache.invalidateUserSessions(userId.toString()),
      ]);

      await sseManager.broadcastToUser(userId.toString(), {
        type: 'session_created',
        session: importedSessionDTO,
      });

      logger.info('Session imported', {
        originalId: sessionData.id,
        newId: finalSession._id.toString(),
        userId: userId.toString(),
        messageCount: messages.length,
      });

      return importedSessionDTO;
    } catch (error) {
      if (newSession) {
        await Promise.allSettled([
          USE_SEPARATE_MESSAGE_COLLECTION
            ? messageRepository.deleteAllForSession(newSession._id)
            : Promise.resolve(0),
          sessionCheckpointRepository.deleteAllForSession(newSession._id),
          archivedMessagesRepository.deleteAllForSession(newSession._id),
          chatSessionRepository.delete(newSession._id),
          chatSessionCache.invalidateAllSessionCaches(
            newSession._id.toString(),
            userId.toString()
          ),
        ]);
      }

      if (isDuplicateKeyError(error)) {
        throw new AppError(
          'Import failed because the session data contains duplicate records',
          409,
          'DUPLICATE_KEY'
        );
      }

      throw error;
    }
  }

  /**
   * Get session stats for a user
   * Uses accurate pricing from token pricing service
   */
  async getStats(userId: Types.ObjectId): Promise<SessionStatsResponse> {
    const [sessionCounts, totalTokens, totalMessages] = await Promise.all([
      chatSessionRepository.countForUser(userId, true),
      chatSessionRepository.getTotalTokenUsage(userId),
      USE_SEPARATE_MESSAGE_COLLECTION
        ? messageRepository.countForUser(userId)
        : chatSessionRepository.countTotalMessages(userId),
    ]);

    // Get all sessions to calculate estimated cost with accurate pricing
    const sessions = await chatSessionRepository.findAllForUser(userId);
    let totalCost = 0;

    for (const session of sessions) {
      const cost = await tokenPricingService.calculateCost(
        session.aiModel,
        session.token_usage.input_tokens,
        session.token_usage.output_tokens,
        session.token_usage.cached_tokens || 0
      );
      totalCost += cost.cost;
    }

    return {
      total_sessions: sessionCounts.total,
      total_messages: totalMessages,
      total_tokens: totalTokens,
      archived_sessions: sessionCounts.archived,
      estimated_cost_usd: Number(totalCost.toFixed(6)),
    };
  }

  /**
   * Get archived messages for a session
   */
  async getArchivedMessages(
    sessionId: string,
    userId: Types.ObjectId
  ): Promise<{ archives: { id: string; startIndex: number; endIndex: number; messageCount: number; archivedAt: Date }[] }> {
    // Verify ownership
    const existing = await chatSessionRepository.findById(sessionId);

    if (!existing) {
      throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
    }

    if (existing.userId.toString() !== userId.toString()) {
      throw new AppError(
        'You do not have access to this session',
        403,
        'SESSION_ACCESS_DENIED'
      );
    }

    const archives = await archivedMessagesRepository.findBySession(sessionId);

    return {
      archives: archives.map((a) => ({
        id: a._id.toString(),
        startIndex: a.startIndex,
        endIndex: a.endIndex,
        messageCount: a.messages.length,
        archivedAt: a.archivedAt,
      })),
    };
  }

  /**
   * Get context limit for a session's model
   */
  async getContextLimitForSession(sessionId: string): Promise<number> {
    const session = await chatSessionRepository.findById(sessionId);

    if (!session) {
      throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
    }

    return getContextLimit(session.aiModel);
  }

  // ============================================================================
  // New Production-Grade Message Operations
  // ============================================================================

  /**
   * Search messages across sessions
   */
  async searchMessages(
    userId: Types.ObjectId,
    query: string,
    sessionId?: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ results: MessageSearchResult[]; total: number; page: number; limit: number; total_pages: number }> {
    if (!USE_SEPARATE_MESSAGE_COLLECTION) {
      throw new AppError('Search requires separate message collection', 501, 'NOT_IMPLEMENTED');
    }

    // If sessionId provided, verify ownership
    if (sessionId) {
      const session = await chatSessionRepository.findById(sessionId);
      if (!session || session.userId.toString() !== userId.toString()) {
        throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
      }
    }

    const searchResult = await messageRepository.search(
      query,
      userId,
      sessionId ? new Types.ObjectId(sessionId) : undefined,
      page,
      limit
    );

    // Get session names for context
    const sessionIds = [...new Set(searchResult.data.map((m) => m.session_id.toString()))];
    const sessions = await Promise.all(
      sessionIds.map((id) => chatSessionRepository.findById(id))
    );
    const sessionNames = new Map(
      sessions.filter((s): s is NonNullable<typeof s> => !!s).map((s) => [s._id.toString(), s.name])
    );

    return {
      results: searchResult.data.map((msg) => ({
        message: {
          ...toMessageDTO(msg),
          session_name: sessionNames.get(msg.session_id.toString()) || 'Unknown',
        },
        highlights: [msg.content.substring(0, 200)], // Simple highlight, could be improved
        score: 1.0, // MongoDB text search doesn't return scores easily
      })),
      total: searchResult.pagination.total,
      page: searchResult.pagination.page,
      limit: searchResult.pagination.limit,
      total_pages: searchResult.pagination.total_pages,
    };
  }

  /**
   * Edit a message
   */
  async editMessage(
    sessionId: string,
    messageId: string,
    userId: Types.ObjectId,
    newContent: string
  ): Promise<{ message: MessageDTO }> {
    if (!USE_SEPARATE_MESSAGE_COLLECTION) {
      throw new AppError('Edit requires separate message collection', 501, 'NOT_IMPLEMENTED');
    }

    const message = await messageRepository.findById(messageId);

    if (!message) {
      throw new AppError('Message not found', 404, 'MESSAGE_NOT_FOUND');
    }

    // Verify ownership via session
    const session = await chatSessionRepository.findById(message.session_id);
    if (!session || session.userId.toString() !== userId.toString()) {
      throw new AppError('Message not found', 404, 'MESSAGE_NOT_FOUND');
    }
    this.assertMessageBelongsToSession(message.session_id, sessionId);

    // Validate new content
    const sanitizedContent = assertValidMessageContent(newContent);

    const updated = await messageRepository.edit(message._id, sanitizedContent);

    if (!updated) {
      throw new AppError('Failed to edit message', 500, 'INTERNAL_ERROR');
    }

    // Update cache
    const updatedDTO = toMessageDTO(updated);
    await chatSessionCache.updateMessage(updatedDTO);

    // Notify via SSE
    await sseManager.notifySessionUpdate(message.session_id.toString(), userId.toString(), {
      type: 'message_edited',
      messageId,
    });

    return { message: updatedDTO };
  }

  /**
   * Delete a message (soft delete)
   */
  async deleteMessage(
    sessionId: string,
    messageId: string,
    userId: Types.ObjectId
  ): Promise<{ message: string; deleted_at: Date }> {
    if (!USE_SEPARATE_MESSAGE_COLLECTION) {
      throw new AppError('Delete requires separate message collection', 501, 'NOT_IMPLEMENTED');
    }

    const message = await messageRepository.findById(messageId);

    if (!message) {
      throw new AppError('Message not found', 404, 'MESSAGE_NOT_FOUND');
    }

    // Verify ownership via session
    const session = await chatSessionRepository.findById(message.session_id);
    if (!session || session.userId.toString() !== userId.toString()) {
      throw new AppError('Message not found', 404, 'MESSAGE_NOT_FOUND');
    }
    this.assertMessageBelongsToSession(message.session_id, sessionId);

    const deleted = await messageRepository.softDelete(message._id);

    if (!deleted) {
      throw new AppError('Failed to delete message', 500, 'INTERNAL_ERROR');
    }

    await Promise.all([
      chatSessionCache.deleteMessage(messageId, message.session_id.toString()),
      chatSessionCache.invalidateSession(message.session_id.toString()),
      chatSessionCache.invalidateUserSessions(userId.toString()),
    ]);

    // Notify via SSE
    await sseManager.notifySessionUpdate(message.session_id.toString(), userId.toString(), {
      type: 'message_deleted',
      messageId,
    });

    return {
      message: 'Message deleted successfully',
      deleted_at: deleted.deleted_at!,
    };
  }

  /**
   * Acknowledge message delivery
   */
  async acknowledgeMessages(
    sessionId: string,
    messageIds: string[],
    userId: Types.ObjectId
  ): Promise<{ acknowledged: string[]; failed: string[] }> {
    if (!USE_SEPARATE_MESSAGE_COLLECTION) {
      return { acknowledged: [], failed: [] };
    }

    const acknowledged: string[] = [];
    const failed: string[] = [];

    for (const messageId of messageIds) {
      try {
        const message = await messageRepository.findById(messageId);

        if (!message) {
          failed.push(messageId);
          continue;
        }

        // Verify ownership via session
        const session = await chatSessionRepository.findById(message.session_id);
        if (!session || session.userId.toString() !== userId.toString()) {
          failed.push(messageId);
          continue;
        }
        if (message.session_id.toString() !== sessionId) {
          failed.push(messageId);
          continue;
        }

        await messageRepository.acknowledgeDelivery(message._id);
        acknowledged.push(messageId);
      } catch {
        failed.push(messageId);
      }
    }

    return { acknowledged, failed };
  }

  /**
   * Update deleteSession to also delete from new message collection
   */
  async deleteSessionWithMessages(
    sessionId: string,
    userId: Types.ObjectId
  ): Promise<void> {
    await this.deleteSession(sessionId, userId);
  }

  /**
   * Update deleteAllSessions to also delete from new message collection
   */
  async deleteAllSessionsWithMessages(userId: Types.ObjectId): Promise<number> {
    return this.deleteAllSessions(userId);
  }

  /**
   * Get cache statistics for monitoring
   */
  async getCacheStats(): Promise<{
    sessionCount: number;
    messageListCount: number;
    userSessionCount: number;
    individualMessageCount: number;
  }> {
    return chatSessionCache.getStats();
  }

  /**
   * Clear all chat caches (admin operation)
   */
  async clearAllCaches(): Promise<void> {
    await chatSessionCache.clearAll();
    logger.info('All chat caches cleared');
  }
}

export const chatSessionService = new ChatSessionService();
