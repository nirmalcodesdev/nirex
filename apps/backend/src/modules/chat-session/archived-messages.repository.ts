import { Types } from 'mongoose';
import {
  ArchivedMessagesModel,
  IArchivedMessagesDocument,
} from './archived-messages.model.js';
import { type ChatMessage } from '@nirex/shared';

export interface CreateArchiveData {
  sessionId: Types.ObjectId;
  userId: Types.ObjectId;
  startIndex: number;
  endIndex: number;
  messages: ChatMessage[];
}

export class ArchivedMessagesRepository {
  /**
   * Create a new archive for messages
   */
  async create(data: CreateArchiveData): Promise<IArchivedMessagesDocument> {
    return ArchivedMessagesModel.create(data);
  }

  /**
   * Find archives for a session, ordered by startIndex
   */
  async findBySession(
    sessionId: string | Types.ObjectId
  ): Promise<IArchivedMessagesDocument[]> {
    return ArchivedMessagesModel.find({ sessionId })
      .sort({ startIndex: 1 })
      .exec();
  }

  /**
   * Find archives for a session within a specific index range
   */
  async findByIndexRange(
    sessionId: string | Types.ObjectId,
    startIndex: number,
    endIndex: number
  ): Promise<IArchivedMessagesDocument[]> {
    return ArchivedMessagesModel.find({
      sessionId,
      $or: [
        { startIndex: { $gte: startIndex, $lte: endIndex } },
        { endIndex: { $gte: startIndex, $lte: endIndex } },
        { startIndex: { $lte: startIndex }, endIndex: { $gte: endIndex } },
      ],
    })
      .sort({ startIndex: 1 })
      .exec();
  }

  /**
   * Get the latest archive for a session (highest startIndex)
   */
  async getLatestForSession(
    sessionId: string | Types.ObjectId
  ): Promise<IArchivedMessagesDocument | null> {
    return ArchivedMessagesModel.findOne({ sessionId })
      .sort({ startIndex: -1 })
      .exec();
  }

  /**
   * Delete all archives for a session
   */
  async deleteAllForSession(
    sessionId: string | Types.ObjectId
  ): Promise<number> {
    const result = await ArchivedMessagesModel.deleteMany({ sessionId }).exec();
    return result.deletedCount || 0;
  }

  /**
   * Count total archived messages for a session
   */
  async countMessagesForSession(
    sessionId: string | Types.ObjectId
  ): Promise<number> {
    const result = await ArchivedMessagesModel.aggregate([
      { $match: { sessionId: new Types.ObjectId(sessionId) } },
      {
        $group: {
          _id: null,
          total: { $sum: { $size: '$messages' } },
        },
      },
    ]).exec();

    return result[0]?.total || 0;
  }
}

export const archivedMessagesRepository = new ArchivedMessagesRepository();
