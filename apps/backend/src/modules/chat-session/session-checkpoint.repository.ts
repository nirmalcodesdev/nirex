import { Types } from 'mongoose';
import {
  SessionCheckpointModel,
  ISessionCheckpointDocument,
} from './session-checkpoint.model.js';

export interface CreateCheckpointData {
  sessionId: Types.ObjectId;
  snapshot: string;
  turn_index: number;
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

export class SessionCheckpointRepository {
  /**
   * Create a new checkpoint
   */
  async create(data: CreateCheckpointData): Promise<ISessionCheckpointDocument> {
    return SessionCheckpointModel.create(data);
  }

  /**
   * Find a checkpoint by ID
   */
  async findById(
    id: string | Types.ObjectId
  ): Promise<ISessionCheckpointDocument | null> {
    return SessionCheckpointModel.findById(id).exec();
  }

  /**
   * List checkpoints for a session with pagination
   */
  async listForSession(
    sessionId: string | Types.ObjectId,
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedResult<ISessionCheckpointDocument>> {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      SessionCheckpointModel.find({ sessionId })
        .sort({ turn_index: 1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      SessionCheckpointModel.countDocuments({ sessionId }).exec(),
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
   * Get the latest checkpoint for a session
   */
  async getLatestForSession(
    sessionId: string | Types.ObjectId
  ): Promise<ISessionCheckpointDocument | null> {
    return SessionCheckpointModel.findOne({ sessionId })
      .sort({ turn_index: -1 })
      .exec();
  }

  /**
   * Get checkpoint count for a session
   */
  async countForSession(sessionId: string | Types.ObjectId): Promise<number> {
    return SessionCheckpointModel.countDocuments({ sessionId }).exec();
  }

  /**
   * Delete all checkpoints for a session
   */
  async deleteAllForSession(
    sessionId: string | Types.ObjectId
  ): Promise<number> {
    const result = await SessionCheckpointModel.deleteMany({
      sessionId,
    }).exec();
    return result.deletedCount || 0;
  }

  /**
   * Find checkpoint by turn index
   */
  async findByTurnIndex(
    sessionId: string | Types.ObjectId,
    turnIndex: number
  ): Promise<ISessionCheckpointDocument | null> {
    return SessionCheckpointModel.findOne({
      sessionId,
      turn_index: turnIndex,
    }).exec();
  }
}

export const sessionCheckpointRepository = new SessionCheckpointRepository();
