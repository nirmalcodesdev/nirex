import { Types } from 'mongoose';
import {
  ChatSessionModel,
  IChatSessionDocument,
} from './chat-session.model.js';
import {
  type ChatMessage,
  type TokenUsage,
  DEFAULT_MESSAGE_PAGE_SIZE,
} from '@nirex/shared';

export interface CreateChatSessionData {
  userId: Types.ObjectId;
  name: string;
  working_directory: string;
  working_directory_hash: string;
  aiModel: string;
}

export interface UpdateChatSessionData {
  name?: string;
  is_archived?: boolean;
  token_usage?: TokenUsage;
  next_message_sequence?: number;
  last_auto_checkpoint_tokens?: number;
  created_at?: Date;
  updated_at?: Date;
}

export interface ListSessionsFilters {
  userId: Types.ObjectId;
  includeArchived?: boolean;
  workingDirectoryHash?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export interface MessagesPaginationResult {
  messages: ChatMessage[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_more: boolean;
  };
}

export class ChatSessionRepository {
  /**
   * Create a new chat session
   */
  async create(data: CreateChatSessionData): Promise<IChatSessionDocument> {
    return ChatSessionModel.create(data);
  }

  /**
   * Find a session by ID
   */
  async findById(
    id: string | Types.ObjectId
  ): Promise<IChatSessionDocument | null> {
    return ChatSessionModel.findById(id).exec();
  }

  /**
   * Find a session by ID with full message history
   */
  async findByIdWithMessages(
    id: string | Types.ObjectId
  ): Promise<IChatSessionDocument | null> {
    return ChatSessionModel.findById(id).exec();
  }

  /**
   * Get paginated messages for a session
   * Returns most recent messages by default (reverse chronological)
   */
  async getMessagesPaginated(
    id: string | Types.ObjectId,
    page: number = 1,
    limit: number = DEFAULT_MESSAGE_PAGE_SIZE
  ): Promise<MessagesPaginationResult> {
    const session = await ChatSessionModel.findById(id).exec();

    if (!session) {
      return {
        messages: [],
        pagination: { page, limit, total: 0, total_pages: 0, has_more: false },
      };
    }

    const allMessages = session.messages || [];
    const total = allMessages.length;
    const totalPages = Math.ceil(total / limit);

    // Calculate slice indices (get most recent first)
    const startIndex = Math.max(0, total - page * limit);
    const endIndex = total - (page - 1) * limit;

    // Slice and reverse to get chronological order
    const messages = allMessages.slice(startIndex, endIndex);

    return {
      messages,
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
   * Get only the most recent messages up to a limit
   * Used when we don't need full pagination
   */
  async getRecentMessages(
    id: string | Types.ObjectId,
    limit: number = DEFAULT_MESSAGE_PAGE_SIZE
  ): Promise<ChatMessage[]> {
    const session = await ChatSessionModel.findById(id).exec();
    if (!session) return [];

    const allMessages = session.messages || [];
    return allMessages.slice(-limit);
  }

  /**
   * Get message count for a session
   */
  async getMessageCount(id: string | Types.ObjectId): Promise<number> {
    const session = await ChatSessionModel.findById(id).exec();
    return session?.messages?.length || 0;
  }

  /**
   * Archive old messages by removing them from session and returning them
   * Returns the archived messages and new start index
   */
  async archiveOldMessages(
    id: string | Types.ObjectId,
    keepCount: number = 100
  ): Promise<{ archived: ChatMessage[]; startIndex: number } | null> {
    const session = await ChatSessionModel.findById(id).exec();
    if (!session) return null;

    const allMessages = session.messages || [];
    if (allMessages.length <= keepCount) return null;

    // Messages to archive (oldest ones)
    const toArchive = allMessages.slice(0, allMessages.length - keepCount);
    const startIndex = 0;

    // Update session to keep only recent messages
    await ChatSessionModel.findByIdAndUpdate(id, {
      $set: { messages: allMessages.slice(-keepCount) },
    }).exec();

    return { archived: toArchive, startIndex };
  }

  /**
   * List sessions for a user with pagination and filters
   */
  async list(
    filters: ListSessionsFilters,
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedResult<IChatSessionDocument>> {
    const skip = (page - 1) * limit;

    // Build query
    const query: Record<string, unknown> = { userId: filters.userId };

    if (!filters.includeArchived) {
      query.is_archived = false;
    }

    if (filters.workingDirectoryHash) {
      query.working_directory_hash = filters.workingDirectoryHash;
    }

    // Execute queries in parallel
    const [data, total] = await Promise.all([
      ChatSessionModel.find(query)
        .sort({ updated_at: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      ChatSessionModel.countDocuments(query).exec(),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update a session
   */
  async update(
    id: string | Types.ObjectId,
    data: UpdateChatSessionData
  ): Promise<IChatSessionDocument | null> {
    const shouldDisableTimestamps =
      data.created_at !== undefined || data.updated_at !== undefined;

    return ChatSessionModel.findByIdAndUpdate(
      id,
      { $set: data },
      {
        new: true,
        runValidators: true,
        ...(shouldDisableTimestamps ? { timestamps: false } : {}),
      }
    ).exec();
  }

  /**
   * Delete a session permanently
   */
  async delete(id: string | Types.ObjectId): Promise<boolean> {
    const result = await ChatSessionModel.findByIdAndDelete(id).exec();
    return result !== null;
  }

  /**
   * Delete all sessions for a user
   */
  async deleteAllForUser(userId: Types.ObjectId): Promise<number> {
    const result = await ChatSessionModel.deleteMany({ userId }).exec();
    return result.deletedCount || 0;
  }

  /**
   * Find all session IDs for a user.
   * Used for cleanup flows that must not silently stop at an arbitrary page size.
   */
  async findIdsForUser(userId: Types.ObjectId): Promise<Types.ObjectId[]> {
    const sessions = await ChatSessionModel.find({ userId })
      .select({ _id: 1 })
      .lean()
      .exec();

    return sessions.map((session) => session._id as Types.ObjectId);
  }

  /**
   * Find all sessions for a user without pagination.
   * Used by administrative cleanup and stats paths that must be exact.
   */
  async findAllForUser(userId: Types.ObjectId): Promise<IChatSessionDocument[]> {
    return ChatSessionModel.find({ userId }).sort({ updated_at: -1 }).exec();
  }

  /**
   * Add a message to a session and update token usage
   */
  async addMessage(
    sessionId: string | Types.ObjectId,
    message: ChatMessage,
    tokenUsageDelta: Partial<TokenUsage>
  ): Promise<IChatSessionDocument | null> {
    const updateOps: Record<string, unknown> = {
      $push: { messages: message },
    };

    // Build token usage increment
    const increment: Record<string, number> = {};
    if (tokenUsageDelta.input_tokens !== undefined) {
      increment['token_usage.input_tokens'] = tokenUsageDelta.input_tokens;
    }
    if (tokenUsageDelta.output_tokens !== undefined) {
      increment['token_usage.output_tokens'] = tokenUsageDelta.output_tokens;
    }
    if (tokenUsageDelta.cached_tokens !== undefined) {
      increment['token_usage.cached_tokens'] = tokenUsageDelta.cached_tokens;
    }

    // Calculate total token delta
    const totalDelta =
      tokenUsageDelta.total_tokens !== undefined
        ? tokenUsageDelta.total_tokens
        : (tokenUsageDelta.input_tokens || 0) + (tokenUsageDelta.output_tokens || 0);
    if (totalDelta > 0) {
      increment['token_usage.total_tokens'] = totalDelta;
    }

    if (Object.keys(increment).length > 0) {
      updateOps.$inc = increment;
    }

    return ChatSessionModel.findByIdAndUpdate(sessionId, updateOps, {
      new: true,
      runValidators: true,
    }).exec();
  }

  /**
   * Get total token usage across all sessions for a user
   */
  async getTotalTokenUsage(userId: Types.ObjectId): Promise<TokenUsage> {
    const result = await ChatSessionModel.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          input_tokens: { $sum: '$token_usage.input_tokens' },
          output_tokens: { $sum: '$token_usage.output_tokens' },
          cached_tokens: { $sum: '$token_usage.cached_tokens' },
          total_tokens: { $sum: '$token_usage.total_tokens' },
        },
      },
    ]).exec();

    if (result.length === 0) {
      return {
        input_tokens: 0,
        output_tokens: 0,
        cached_tokens: 0,
        total_tokens: 0,
      };
    }

    return {
      input_tokens: result[0].input_tokens || 0,
      output_tokens: result[0].output_tokens || 0,
      cached_tokens: result[0].cached_tokens || 0,
      total_tokens: result[0].total_tokens || 0,
    };
  }

  /**
   * Count sessions for a user
   */
  async countForUser(
    userId: Types.ObjectId,
    includeArchived: boolean = false
  ): Promise<{ total: number; archived: number }> {
    const [total, archived] = await Promise.all([
      ChatSessionModel.countDocuments({ userId }).exec(),
      ChatSessionModel.countDocuments({ userId, is_archived: true }).exec(),
    ]);

    return { total, archived };
  }

  /**
   * Count total messages across all sessions for a user
   */
  async countTotalMessages(userId: Types.ObjectId): Promise<number> {
    const result = await ChatSessionModel.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          totalMessages: { $sum: { $size: '$messages' } },
        },
      },
    ]).exec();

    return result[0]?.totalMessages || 0;
  }

  /**
   * Update session name
   */
  async updateName(
    id: string | Types.ObjectId,
    name: string
  ): Promise<IChatSessionDocument | null> {
    return ChatSessionModel.findByIdAndUpdate(
      id,
      { $set: { name } },
      { new: true, runValidators: true }
    ).exec();
  }

  /**
   * Reserve the next message sequence number atomically.
   * Gaps are acceptable and avoid duplicate sequence numbers under concurrency.
   */
  async reserveNextMessageSequence(
    id: string | Types.ObjectId
  ): Promise<number | null> {
    const session = await ChatSessionModel.findByIdAndUpdate(
      id,
      { $inc: { next_message_sequence: 1 } },
      {
        new: true,
        projection: { next_message_sequence: 1 },
        runValidators: true,
      }
    ).exec();

    return session?.next_message_sequence ?? null;
  }

  /**
   * Ensure the session sequence cursor is not behind the actual message stream.
   * Used to recover safely from legacy data or drifted counters.
   */
  async setNextMessageSequenceAtLeast(
    id: string | Types.ObjectId,
    minimumSequence: number
  ): Promise<void> {
    await ChatSessionModel.findByIdAndUpdate(
      id,
      { $max: { next_message_sequence: minimumSequence } },
      { runValidators: true }
    ).exec();
  }

  /**
   * Update aggregated token usage and optionally touch other summary fields.
   */
  async updateMessageSummary(
    id: string | Types.ObjectId,
    tokenUsageDelta: Partial<TokenUsage> = {},
    setData: Partial<UpdateChatSessionData> = {}
  ): Promise<IChatSessionDocument | null> {
    const updateOps: Record<string, unknown> = {};
    const increment: Record<string, number> = {};

    if (tokenUsageDelta.input_tokens !== undefined) {
      increment['token_usage.input_tokens'] = tokenUsageDelta.input_tokens;
    }
    if (tokenUsageDelta.output_tokens !== undefined) {
      increment['token_usage.output_tokens'] = tokenUsageDelta.output_tokens;
    }
    if (tokenUsageDelta.cached_tokens !== undefined) {
      increment['token_usage.cached_tokens'] = tokenUsageDelta.cached_tokens;
    }

    const totalDelta =
      tokenUsageDelta.total_tokens !== undefined
        ? tokenUsageDelta.total_tokens
        : (tokenUsageDelta.input_tokens || 0) + (tokenUsageDelta.output_tokens || 0);
    if (totalDelta > 0) {
      increment['token_usage.total_tokens'] = totalDelta;
    }

    if (Object.keys(increment).length > 0) {
      updateOps.$inc = increment;
    }

    if (Object.keys(setData).length > 0) {
      updateOps.$set = setData;
    }

    if (Object.keys(updateOps).length === 0) {
      updateOps.$set = { updated_at: new Date() };
      return ChatSessionModel.findByIdAndUpdate(id, updateOps, {
        new: true,
        runValidators: true,
        timestamps: false,
      }).exec();
    }

    return ChatSessionModel.findByIdAndUpdate(id, updateOps, {
      new: true,
      runValidators: true,
    }).exec();
  }
}

export const chatSessionRepository = new ChatSessionRepository();
