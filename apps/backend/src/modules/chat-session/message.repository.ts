import { Types } from 'mongoose';
import { MessageModel, IMessageDocument } from './message.model.js';
import {
  type TokenUsage,
  type MessageDTO,
  type MessageRole,
  DEFAULT_MESSAGE_PAGE_SIZE,
} from '@nirex/shared';
import { logger } from '../../utils/logger.js';
import { encryptionService } from './encryption.service.js';

// Feature flag for encryption
const ENABLE_ENCRYPTION = process.env.ENABLE_MESSAGE_ENCRYPTION === 'true';

export interface CreateMessageData {
  sessionId: Types.ObjectId;
  userId: Types.ObjectId;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  sequenceNumber: number;
  tokenUsage?: Partial<TokenUsage>;
  clientMessageId?: string;
  metadata?: Record<string, unknown>;
  attachmentIds?: Types.ObjectId[];
  createdAt?: Date;
  updatedAt?: Date;
  deliveryStatus?: 'pending' | 'delivered' | 'failed' | 'acknowledged';
  deliveredAt?: Date;
  acknowledgedAt?: Date;
  retryCount?: number;
  isDeleted?: boolean;
  deletedAt?: Date;
}

export interface UpdateMessageData {
  content?: string;
  deliveryStatus?: 'pending' | 'delivered' | 'failed' | 'acknowledged';
  deliveredAt?: Date;
  acknowledgedAt?: Date;
  retryCount?: number;
  metadata?: Record<string, unknown>;
}

export interface MessageFilters {
  sessionId?: Types.ObjectId;
  userId?: Types.ObjectId;
  role?: string;
  deliveryStatus?: string;
  isDeleted?: boolean;
}

export interface MessageUsageRecord {
  _id: Types.ObjectId;
  role: MessageRole;
  token_usage?: TokenUsage;
  sequence_number: number;
  client_message_id?: string;
  created_at: Date;
  metadata?: Record<string, unknown>;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_more: boolean;
  };
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
  const reasoningTokens = tokenUsage.reasoning_tokens || 0;

  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cached_tokens: cachedTokens,
    reasoning_tokens: reasoningTokens,
    total_tokens:
      tokenUsage.total_tokens !== undefined
        ? tokenUsage.total_tokens
        : inputTokens + outputTokens + reasoningTokens,
  };
}

/**
 * Message Repository
 * Handles all database operations for messages
 */
export class MessageRepository {
  /**
   * Create a new message
   * Automatically encrypts sensitive content if encryption is enabled
   */
  async create(data: CreateMessageData): Promise<IMessageDocument> {
    let content = data.content;
    let encrypted = false;
    const normalizedTokenUsage = normalizeTokenUsage(data.tokenUsage);

    if (ENABLE_ENCRYPTION) {
      const encryptionResult = encryptionService.autoEncrypt(data.content);
      content = encryptionResult.content;
      encrypted = encryptionResult.encrypted;

      if (encrypted) {
        logger.debug('Message content auto-encrypted', {
          sessionId: data.sessionId,
          detectedTypes: encryptionResult.detectedTypes,
        });
      }
    }

    const document: Record<string, unknown> = {
      session_id: data.sessionId,
      user_id: data.userId,
      sequence_number: data.sequenceNumber,
      role: data.role,
      content,
      encrypted,
      token_usage: normalizedTokenUsage,
      metadata: data.metadata,
      attachment_ids: data.attachmentIds,
      delivery_status: data.deliveryStatus || 'pending',
      delivered_at: data.deliveredAt,
      acknowledged_at: data.acknowledgedAt,
      retry_count: data.retryCount || 0,
      is_deleted: data.isDeleted || false,
      deleted_at: data.deletedAt,
      created_at: data.createdAt,
      updated_at: data.updatedAt,
    };

    if (data.clientMessageId) {
      document.client_message_id = data.clientMessageId;
    }

    return MessageModel.create(document);
  }

  /**
   * Decrypt message content if encrypted
   */
  private decryptMessage(message: IMessageDocument | null): IMessageDocument | null {
    if (!message || !ENABLE_ENCRYPTION) {
      return message;
    }

    // Check if content is encrypted
    if (message.encrypted || encryptionService.isEncrypted(message.content)) {
      message.content = encryptionService.decrypt(message.content);
    }

    // Decrypt edited content if present
    if (message.edited_content && encryptionService.isEncrypted(message.edited_content)) {
      message.edited_content = encryptionService.decrypt(message.edited_content);
    }

    return message;
  }

  /**
   * Decrypt multiple messages
   */
  private decryptMessages(messages: IMessageDocument[]): IMessageDocument[] {
    if (!ENABLE_ENCRYPTION) {
      return messages;
    }

    return messages.map(m => this.decryptMessage(m)!);
  }

  /**
   * Find message by ID
   */
  async findById(id: string | Types.ObjectId): Promise<IMessageDocument | null> {
    const message = await MessageModel.findById(id).exec();
    return this.decryptMessage(message);
  }

  /**
   * Find message by client message ID (for deduplication)
   */
  async findByClientMessageId(
    sessionId: Types.ObjectId,
    clientMessageId: string
  ): Promise<IMessageDocument | null> {
    const message = await MessageModel.findOne({
      session_id: sessionId,
      client_message_id: clientMessageId,
    }).exec();
    return this.decryptMessage(message);
  }

  /**
   * Check if message exists by client message ID
   */
  async existsByClientMessageId(
    sessionId: Types.ObjectId,
    clientMessageId: string
  ): Promise<boolean> {
    const count = await MessageModel.countDocuments({
      session_id: sessionId,
      client_message_id: clientMessageId,
    }).exec();
    return count > 0;
  }

  /**
   * List messages with pagination
   */
  async list(
    filters: MessageFilters,
    page: number = 1,
    limit: number = DEFAULT_MESSAGE_PAGE_SIZE
  ): Promise<PaginatedResult<IMessageDocument>> {
    const skip = (page - 1) * limit;

    // Build query
    const query: Record<string, unknown> = {};

    if (filters.sessionId) {
      query.session_id = filters.sessionId;
    }

    if (filters.userId) {
      query.user_id = filters.userId;
    }

    if (filters.role) {
      query.role = filters.role;
    }

    if (filters.deliveryStatus) {
      query.delivery_status = filters.deliveryStatus;
    }

    if (filters.isDeleted !== undefined) {
      query.is_deleted = filters.isDeleted;
    }

    // Execute queries in parallel
    const [messages, total] = await Promise.all([
      MessageModel.find(query)
        .sort({ sequence_number: 1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      MessageModel.countDocuments(query).exec(),
    ]);

    // Decrypt messages if needed
    const data = this.decryptMessages(messages);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
        has_more: page * limit < total,
      },
    };
  }

  /**
   * List messages for a session using the chat API pagination contract:
   * page 1 returns the most recent messages, but each page remains chronological.
   */
  async listForSessionPaginated(
    sessionId: Types.ObjectId,
    page: number = 1,
    limit: number = DEFAULT_MESSAGE_PAGE_SIZE
  ): Promise<PaginatedResult<IMessageDocument>> {
    const total = await MessageModel.countDocuments({
      session_id: sessionId,
    }).exec();

    const totalPages = Math.ceil(total / limit);
    if (total === 0 || page > totalPages) {
      return {
        data: [],
        pagination: {
          page,
          limit,
          total,
          total_pages: totalPages,
          has_more: false,
        },
      };
    }

    const endExclusive = Math.max(0, total - (page - 1) * limit);
    const startIndex = Math.max(0, endExclusive - limit);
    const pageSize = Math.max(0, endExclusive - startIndex);

    const messages = await MessageModel.find({ session_id: sessionId })
      .sort({ sequence_number: 1 })
      .skip(startIndex)
      .limit(pageSize)
      .exec();

    return {
      data: this.decryptMessages(messages),
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages,
        has_more: page < totalPages,
      },
    };
  }

  /**
   * List the full message history for a session in chronological order.
   */
  async listAllForSession(sessionId: Types.ObjectId): Promise<IMessageDocument[]> {
    const messages = await MessageModel.find({ session_id: sessionId })
      .sort({ sequence_number: 1 })
      .exec();

    return this.decryptMessages(messages);
  }

  async listUsageForSession(sessionId: Types.ObjectId): Promise<MessageUsageRecord[]> {
    const messages = await MessageModel.find({
      session_id: sessionId,
      is_deleted: false,
    })
      .select({
        _id: 1,
        role: 1,
        token_usage: 1,
        sequence_number: 1,
        client_message_id: 1,
        created_at: 1,
        metadata: 1,
      })
      .sort({ sequence_number: 1 })
      .lean()
      .exec();

    return messages.map((message) => ({
      _id: message._id as Types.ObjectId,
      role: message.role as MessageRole,
      token_usage: message.token_usage as TokenUsage | undefined,
      sequence_number: message.sequence_number as number,
      client_message_id: message.client_message_id as string | undefined,
      created_at: message.created_at as Date,
      metadata: message.metadata as Record<string, unknown> | undefined,
    }));
  }

  /**
   * Get recent messages for a session
   */
  async getRecentMessages(
    sessionId: Types.ObjectId,
    limit: number = 50
  ): Promise<IMessageDocument[]> {
    const messages = await MessageModel.find({ session_id: sessionId, is_deleted: false })
      .sort({ sequence_number: -1 })
      .limit(limit)
      .exec();

    return this.decryptMessages(messages);
  }

  /**
   * Get messages by sequence number range
   */
  async getBySequenceRange(
    sessionId: Types.ObjectId,
    startSeq: number,
    endSeq: number
  ): Promise<IMessageDocument[]> {
    const messages = await MessageModel.find({
      session_id: sessionId,
      sequence_number: { $gte: startSeq, $lte: endSeq },
      is_deleted: false,
    })
      .sort({ sequence_number: 1 })
      .exec();

    return this.decryptMessages(messages);
  }

  async getAfterSequence(
    sessionId: Types.ObjectId,
    afterSequence: number,
    limit: number = DEFAULT_MESSAGE_PAGE_SIZE
  ): Promise<IMessageDocument[]> {
    const messages = await MessageModel.find({
      session_id: sessionId,
      sequence_number: { $gt: afterSequence },
      is_deleted: false,
    })
      .sort({ sequence_number: 1 })
      .limit(limit)
      .exec();

    return this.decryptMessages(messages);
  }

  async getLatestForSession(
    sessionId: Types.ObjectId
  ): Promise<IMessageDocument | null> {
    const message = await MessageModel.findOne({
      session_id: sessionId,
      is_deleted: false,
    })
      .sort({ sequence_number: -1 })
      .exec();

    return this.decryptMessage(message);
  }

  /**
   * Get next sequence number for a session
   */
  async getNextSequenceNumber(sessionId: Types.ObjectId): Promise<number> {
    const lastMessage = await MessageModel.findOne(
      { session_id: sessionId },
      { sequence_number: 1 }
    )
      .sort({ sequence_number: -1 })
      .limit(1)
      .lean();

    return (lastMessage?.sequence_number || 0) + 1;
  }

  /**
   * Update a message
   */
  async update(
    id: string | Types.ObjectId,
    data: UpdateMessageData
  ): Promise<IMessageDocument | null> {
    const update: Record<string, unknown> = {};

    if (data.content !== undefined) {
      update.content = data.content;
    }

    if (data.deliveryStatus !== undefined) {
      update.delivery_status = data.deliveryStatus;
    }

    if (data.deliveredAt !== undefined) {
      update.delivered_at = data.deliveredAt;
    }

    if (data.acknowledgedAt !== undefined) {
      update.acknowledged_at = data.acknowledgedAt;
    }

    if (data.retryCount !== undefined) {
      update.retry_count = data.retryCount;
    }

    if (data.metadata !== undefined) {
      update.metadata = data.metadata;
    }

    return MessageModel.findByIdAndUpdate(id, { $set: update }, { new: true }).exec();
  }

  /**
   * Edit message content (creates edit history)
   */
  async edit(
    id: string | Types.ObjectId,
    newContent: string
  ): Promise<IMessageDocument | null> {
    const message = await MessageModel.findById(id).exec();

    if (!message) {
      return null;
    }

    // Store original content in edited_content if not already edited
    if (!message.edited_content) {
      message.edited_content = message.content;
    }

    // Encrypt new content if encryption is enabled and content is sensitive
    let finalContent = newContent;
    let encrypted = false;
    if (ENABLE_ENCRYPTION) {
      const encryptionResult = encryptionService.autoEncrypt(newContent);
      finalContent = encryptionResult.content;
      encrypted = encryptionResult.encrypted;
    }

    message.content = finalContent;
    message.encrypted = encrypted;
    message.edited_at = new Date();

    const saved = await message.save();
    return this.decryptMessage(saved);
  }

  /**
   * Soft delete a message
   */
  async softDelete(id: string | Types.ObjectId): Promise<IMessageDocument | null> {
    return MessageModel.findByIdAndUpdate(
      id,
      {
        $set: {
          is_deleted: true,
          deleted_at: new Date(),
        },
      },
      { new: true }
    ).exec();
  }

  /**
   * Hard delete a message (use with caution)
   */
  async hardDelete(id: string | Types.ObjectId): Promise<boolean> {
    const result = await MessageModel.findByIdAndDelete(id).exec();
    return result !== null;
  }

  /**
   * Delete all messages for a session
   */
  async deleteAllForSession(sessionId: Types.ObjectId): Promise<number> {
    const result = await MessageModel.deleteMany({ session_id: sessionId }).exec();
    return result.deletedCount || 0;
  }

  async deleteAfterSequence(
    sessionId: Types.ObjectId,
    afterSequence: number
  ): Promise<number> {
    const result = await MessageModel.deleteMany({
      session_id: sessionId,
      sequence_number: { $gt: afterSequence },
    }).exec();
    return result.deletedCount || 0;
  }

  /**
   * Delete all messages for a user
   */
  async deleteAllForUser(userId: Types.ObjectId): Promise<number> {
    const result = await MessageModel.deleteMany({ user_id: userId }).exec();
    return result.deletedCount || 0;
  }

  /**
   * Count messages for a session
   */
  async countForSession(sessionId: Types.ObjectId): Promise<number> {
    return MessageModel.countDocuments({
      session_id: sessionId,
      is_deleted: false,
    }).exec();
  }

  /**
   * Count non-deleted messages for a user across all sessions.
   */
  async countForUser(userId: Types.ObjectId): Promise<number> {
    return MessageModel.countDocuments({
      user_id: userId,
      is_deleted: false,
    }).exec();
  }

  /**
   * Get non-deleted message counts for a set of sessions.
   */
  async getCountsForSessions(
    sessionIds: Types.ObjectId[]
  ): Promise<Map<string, number>> {
    if (sessionIds.length === 0) {
      return new Map();
    }

    const counts = await MessageModel.aggregate<{ _id: Types.ObjectId; count: number }>([
      {
        $match: {
          session_id: { $in: sessionIds },
          is_deleted: false,
        },
      },
      {
        $group: {
          _id: '$session_id',
          count: { $sum: 1 },
        },
      },
    ]).exec();

    return new Map(
      counts.map((count) => [count._id.toString(), count.count])
    );
  }

  /**
   * Get total token usage for a session
   */
  async getSessionTokenUsage(sessionId: Types.ObjectId): Promise<TokenUsage> {
    const result = await MessageModel.aggregate([
      {
        $match: {
          session_id: sessionId,
          is_deleted: false,
        },
      },
      {
        $group: {
          _id: null,
          input_tokens: { $sum: '$token_usage.input_tokens' },
          output_tokens: { $sum: '$token_usage.output_tokens' },
          cached_tokens: { $sum: '$token_usage.cached_tokens' },
          reasoning_tokens: { $sum: '$token_usage.reasoning_tokens' },
          total_tokens: { $sum: '$token_usage.total_tokens' },
        },
      },
    ]).exec();

    if (result.length === 0) {
      return {
        input_tokens: 0,
        output_tokens: 0,
        cached_tokens: 0,
        reasoning_tokens: 0,
        total_tokens: 0,
      };
    }

    return {
      input_tokens: result[0].input_tokens || 0,
      output_tokens: result[0].output_tokens || 0,
      cached_tokens: result[0].cached_tokens || 0,
      reasoning_tokens: result[0].reasoning_tokens || 0,
      total_tokens: result[0].total_tokens || 0,
    };
  }

  /**
   * Search messages by text content
   */
  async search(
    query: string,
    userId: Types.ObjectId,
    sessionId: Types.ObjectId | undefined,
    page: number = 1,
    limit: number = 20,
    filters: {
      role?: string;
      dateFrom?: Date;
      dateTo?: Date;
    } = {}
  ): Promise<PaginatedResult<IMessageDocument>> {
    const skip = (page - 1) * limit;

    // Build search criteria
    const searchCriteria: Record<string, unknown> = {
      $text: { $search: query },
      user_id: userId,
      is_deleted: false,
    };

    if (sessionId) {
      searchCriteria.session_id = sessionId;
    }

    if (filters.role) {
      searchCriteria.role = filters.role;
    }

    if (filters.dateFrom || filters.dateTo) {
      const createdAt: Record<string, Date> = {};
      if (filters.dateFrom) {
        createdAt.$gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        createdAt.$lte = filters.dateTo;
      }
      searchCriteria.created_at = createdAt;
    }

    const [messages, total] = await Promise.all([
      MessageModel.find(searchCriteria, {
        score: { $meta: 'textScore' },
      })
        .sort({ score: { $meta: 'textScore' } })
        .skip(skip)
        .limit(limit)
        .exec(),
      MessageModel.countDocuments(searchCriteria).exec(),
    ]);

    // Decrypt messages if needed
    const data = this.decryptMessages(messages);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
        has_more: page * limit < total,
      },
    };
  }

  /**
   * Get messages pending delivery (for retry logic)
   */
  async getPendingDeliveries(
    olderThanMinutes: number = 5,
    limit: number = 100
  ): Promise<IMessageDocument[]> {
    const cutoffTime = new Date(Date.now() - olderThanMinutes * 60 * 1000);

    return MessageModel.find({
      delivery_status: { $in: ['pending', 'failed'] },
      created_at: { $lte: cutoffTime },
      retry_count: { $lt: 5 },
      is_deleted: false,
    })
      .sort({ created_at: 1 })
      .limit(limit)
      .exec();
  }

  /**
   * Acknowledge message delivery
   */
  async acknowledgeDelivery(
    id: string | Types.ObjectId
  ): Promise<IMessageDocument | null> {
    return MessageModel.findByIdAndUpdate(
      id,
      {
        $set: {
          delivery_status: 'acknowledged',
          acknowledged_at: new Date(),
        },
      },
      { new: true }
    ).exec();
  }

  /**
   * Mark message as delivered
   */
  async markDelivered(
    id: string | Types.ObjectId
  ): Promise<IMessageDocument | null> {
    return MessageModel.findByIdAndUpdate(
      id,
      {
        $set: {
          delivery_status: 'delivered',
          delivered_at: new Date(),
        },
      },
      { new: true }
    ).exec();
  }

  /**
   * Increment retry count
   */
  async incrementRetry(id: string | Types.ObjectId): Promise<void> {
    await MessageModel.findByIdAndUpdate(id, {
      $inc: { retry_count: 1 },
    }).exec();
  }
}

export const messageRepository = new MessageRepository();
