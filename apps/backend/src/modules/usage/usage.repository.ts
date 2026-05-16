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
  reasoning_tokens: number;
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
  requests: number;
}

export interface ProjectEventAggregate {
  project_id: string;
  project_name: string;
  credits: number;
  requests: number;
}

export interface SessionEventTotals {
  credits: number;
  requests: number;
}

function projectNameFromPath(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');
  const parts = normalized.split('/').filter(Boolean);
  return parts[parts.length - 1] || 'project';
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 11000
  );
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
      reasoning_tokens: number;
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
          reasoning_tokens: { $sum: '$token_usage.reasoning_tokens' },
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
      reasoning_tokens: doc.reasoning_tokens || 0,
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
            $in: ['credits', 'requests'],
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
      requests: 0,
    };

    for (const doc of docs) {
      if (doc._id in totals) {
        totals[doc._id as keyof EventTotals] = doc.total || 0;
      }
    }

    return totals;
  }

  async getProjectEventTotals(
    userId: Types.ObjectId,
    range: DateRange
  ): Promise<ProjectEventAggregate[]> {
    const docs = await UsageEventModel.aggregate<{
      _id: string | null;
      project_name: string | null;
      credits: number;
      requests: number;
    }>([
      {
        $match: {
          user_id: userId,
          event_type: { $in: ['credits', 'requests'] },
          timestamp: { $gte: range.start, $lte: range.end },
        },
      },
      {
        $group: {
          _id: '$project_id',
          project_name: { $first: '$metadata.project_name' },
          credits: {
            $sum: {
              $cond: [{ $eq: ['$event_type', 'credits'] }, '$quantity', 0],
            },
          },
          requests: {
            $sum: {
              $cond: [{ $eq: ['$event_type', 'requests'] }, '$quantity', 0],
            },
          },
        },
      },
    ]).exec();

    return docs.map((doc) => {
      const projectId = doc._id || 'unknown';
      return {
        project_id: projectId,
        project_name: doc.project_name || projectId,
        credits: doc.credits || 0,
        requests: doc.requests || 0,
      };
    });
  }

  async getSessionEventTotals(
    userId: Types.ObjectId,
    range: DateRange,
    sessionIds: Types.ObjectId[]
  ): Promise<Map<string, SessionEventTotals>> {
    if (sessionIds.length === 0) {
      return new Map();
    }

    const docs = await UsageEventModel.aggregate<{
      _id: Types.ObjectId;
      credits: number;
      requests: number;
    }>([
      {
        $match: {
          user_id: userId,
          session_id: { $in: sessionIds },
          event_type: { $in: ['credits', 'requests'] },
          timestamp: { $gte: range.start, $lte: range.end },
        },
      },
      {
        $group: {
          _id: '$session_id',
          credits: {
            $sum: {
              $cond: [{ $eq: ['$event_type', 'credits'] }, '$quantity', 0],
            },
          },
          requests: {
            $sum: {
              $cond: [{ $eq: ['$event_type', 'requests'] }, '$quantity', 0],
            },
          },
        },
      },
    ]).exec();

    return new Map(
      docs.map((doc) => [
        doc._id.toString(),
        {
          credits: doc.credits || 0,
          requests: doc.requests || 0,
        },
      ])
    );
  }

  async getExistingEventTotalsForSessions(
    userId: Types.ObjectId,
    sessionIds: Types.ObjectId[]
  ): Promise<Map<string, SessionEventTotals>> {
    if (sessionIds.length === 0) {
      return new Map();
    }

    const docs = await UsageEventModel.aggregate<{
      _id: Types.ObjectId;
      credits: number;
      requests: number;
    }>([
      {
        $match: {
          user_id: userId,
          session_id: { $in: sessionIds },
          event_type: { $in: ['credits', 'requests'] },
        },
      },
      {
        $group: {
          _id: '$session_id',
          credits: {
            $sum: {
              $cond: [{ $eq: ['$event_type', 'credits'] }, '$quantity', 0],
            },
          },
          requests: {
            $sum: {
              $cond: [{ $eq: ['$event_type', 'requests'] }, '$quantity', 0],
            },
          },
        },
      },
    ]).exec();

    return new Map(
      docs.map((doc) => [
        doc._id.toString(),
        {
          credits: doc.credits || 0,
          requests: doc.requests || 0,
        },
      ])
    );
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
    session_id?: Types.ObjectId;
    message_id?: string;
    event_type: UsageEventType;
    quantity: number;
    timestamp?: Date;
    idempotency_key?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const document = {
      ...data,
      timestamp: data.timestamp || new Date(),
    };

    try {
      await UsageEventModel.create(document);
    } catch (error) {
      if (data.idempotency_key && isDuplicateKeyError(error)) {
        return;
      }
      throw error;
    }
  }

  async createEvents(
    events: Array<{
      user_id: Types.ObjectId;
      project_id?: string;
      session_id?: Types.ObjectId;
      message_id?: string;
      event_type: UsageEventType;
      quantity: number;
      timestamp?: Date;
      idempotency_key?: string;
      metadata?: Record<string, unknown>;
    }>
  ): Promise<void> {
    await Promise.all(events.map((event) => this.createEvent(event)));
  }
}

export const usageRepository = new UsageRepository();
