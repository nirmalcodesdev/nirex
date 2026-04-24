import { Types } from 'mongoose';
import { ChatSessionModel } from '../chat-session/chat-session.model.js';
import { MessageModel } from '../chat-session/message.model.js';
import { UsageEventModel, type UsageEventType } from './usage.model.js';

export interface DateRange {
  start: Date;
  end: Date;
}

export interface SessionProjectMeta {
  session_id: string;
  model: string;
  project_id: string;
  project_name: string;
}

export interface SessionUsageAggregate {
  session_id: string;
  requests: number;
  input_tokens: number;
  output_tokens: number;
  cached_tokens: number;
  total_tokens: number;
}

export interface DailyMessageTokens {
  date: string;
  total_tokens: number;
}

export interface DailyEventAggregate {
  date: string;
  event_type: UsageEventType;
  total: number;
}

export interface EventTotals {
  credits: number;
}

function projectNameFromPath(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');
  const parts = normalized.split('/').filter(Boolean);
  return parts[parts.length - 1] || 'project';
}

export class UsageRepository {
  async listSessionProjectMeta(userId: Types.ObjectId): Promise<SessionProjectMeta[]> {
    const sessions = await ChatSessionModel.find({ userId })
      .select({ _id: 1, aiModel: 1, working_directory_hash: 1, working_directory: 1 })
      .lean()
      .exec();

    return sessions.map((session) => ({
      session_id: (session._id as Types.ObjectId).toString(),
      model: session.aiModel,
      project_id: session.working_directory_hash || (session._id as Types.ObjectId).toString(),
      project_name: projectNameFromPath(session.working_directory || 'project'),
    }));
  }

  async getSessionUsageFromMessages(
    userId: Types.ObjectId,
    range: DateRange
  ): Promise<SessionUsageAggregate[]> {
    const docs = await MessageModel.aggregate<{
      _id: Types.ObjectId;
      requests: number;
      input_tokens: number;
      output_tokens: number;
      cached_tokens: number;
      total_tokens: number;
    }>([
      {
        $match: {
          user_id: userId,
          is_deleted: false,
          created_at: { $gte: range.start, $lte: range.end },
        },
      },
      {
        $group: {
          _id: '$session_id',
          requests: { $sum: 1 },
          input_tokens: { $sum: '$token_usage.input_tokens' },
          output_tokens: { $sum: '$token_usage.output_tokens' },
          cached_tokens: { $sum: '$token_usage.cached_tokens' },
          total_tokens: { $sum: '$token_usage.total_tokens' },
        },
      },
    ]).exec();

    return docs.map((doc) => ({
      session_id: doc._id.toString(),
      requests: doc.requests || 0,
      input_tokens: doc.input_tokens || 0,
      output_tokens: doc.output_tokens || 0,
      cached_tokens: doc.cached_tokens || 0,
      total_tokens: doc.total_tokens || 0,
    }));
  }

  async getDailyTokenTotals(
    userId: Types.ObjectId,
    range: DateRange
  ): Promise<DailyMessageTokens[]> {
    const docs = await MessageModel.aggregate<{ _id: string; total_tokens: number }>([
      {
        $match: {
          user_id: userId,
          is_deleted: false,
          created_at: { $gte: range.start, $lte: range.end },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$created_at', timezone: 'UTC' },
          },
          total_tokens: { $sum: '$token_usage.total_tokens' },
        },
      },
      { $sort: { _id: 1 } },
    ]).exec();

    return docs.map((doc) => ({ date: doc._id, total_tokens: doc.total_tokens || 0 }));
  }

  async getDailyEventTotals(
    userId: Types.ObjectId,
    range: DateRange,
    eventTypes: UsageEventType[]
  ): Promise<DailyEventAggregate[]> {
    const docs = await UsageEventModel.aggregate<{
      _id: { date: string; event_type: UsageEventType };
      total: number;
    }>([
      {
        $match: {
          user_id: userId,
          event_type: { $in: eventTypes },
          timestamp: { $gte: range.start, $lte: range.end },
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp', timezone: 'UTC' } },
            event_type: '$event_type',
          },
          total: { $sum: '$quantity' },
        },
      },
      { $sort: { '_id.date': 1 } },
    ]).exec();

    return docs.map((doc) => ({
      date: doc._id.date,
      event_type: doc._id.event_type,
      total: doc.total || 0,
    }));
  }

  async getEventTotals(userId: Types.ObjectId, range: DateRange): Promise<EventTotals> {
    const docs = await UsageEventModel.aggregate<{
      _id: UsageEventType;
      total: number;
    }>([
      {
        $match: {
          user_id: userId,
          event_type: {
            $in: ['credits'],
          },
          timestamp: { $gte: range.start, $lte: range.end },
        },
      },
      {
        $group: {
          _id: '$event_type',
          total: { $sum: '$quantity' },
        },
      },
    ]).exec();

    const totals: EventTotals = {
      credits: 0,
    };

    for (const doc of docs) {
      if (doc._id in totals) {
        totals[doc._id as keyof EventTotals] = doc.total || 0;
      }
    }

    return totals;
  }

  async getAverageResponseTimeMs(
    userId: Types.ObjectId,
    range: DateRange
  ): Promise<number | null> {
    const docs = await UsageEventModel.aggregate<{ _id: null; avg: number }>([
      {
        $match: {
          user_id: userId,
          event_type: 'response_time_ms',
          timestamp: { $gte: range.start, $lte: range.end },
        },
      },
      {
        $group: {
          _id: null,
          avg: { $avg: '$quantity' },
        },
      },
    ]).exec();

    const first = docs[0];
    if (!first || first.avg === undefined || first.avg === null) {
      return null;
    }

    return first.avg;
  }

  async createEvent(data: {
    user_id: Types.ObjectId;
    project_id?: string;
    event_type: UsageEventType;
    quantity: number;
    timestamp?: Date;
  }): Promise<void> {
    await UsageEventModel.create({
      ...data,
      timestamp: data.timestamp || new Date(),
    });
  }
}

export const usageRepository = new UsageRepository();
