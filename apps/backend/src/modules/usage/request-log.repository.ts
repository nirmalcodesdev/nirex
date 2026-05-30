import { Types } from 'mongoose';
import type { RequestLogEntry, RequestLogsResponse } from '@nirex/shared';
import { RequestLogModel } from './request-log.model.js';

export interface CreateRequestLogData {
  user_id: Types.ObjectId;
  session_id: Types.ObjectId;
  message_id: string;
  timestamp: Date;
  ai_model: string;
  mode: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  total_cost: number;
  timing_ms: number | null;
  status: 'success' | 'failed';
}

interface RawRequestLog {
  _id: Types.ObjectId;
  session_id: Types.ObjectId;
  message_id: string;
  timestamp: Date;
  ai_model: string;
  mode: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  total_cost: number;
  timing_ms: number | null;
  status: 'success' | 'failed';
}

function toEntry(doc: RawRequestLog): RequestLogEntry {
  return {
    id: doc._id.toString(),
    session_id: doc.session_id.toString(),
    message_id: doc.message_id,
    timestamp: doc.timestamp.toISOString(),
    model: doc.ai_model,
    mode: doc.mode,
    input_tokens: doc.input_tokens,
    output_tokens: doc.output_tokens,
    total_tokens: doc.total_tokens,
    total_cost: doc.total_cost,
    timing_ms: doc.timing_ms,
    status: doc.status,
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

export class RequestLogRepository {
  async create(data: CreateRequestLogData): Promise<void> {
    try {
      await RequestLogModel.create(data);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return;
      }
      throw error;
    }
  }

  async list(
    userId: Types.ObjectId,
    options: {
      page: number;
      limit: number;
      start: Date;
      end: Date;
    }
  ): Promise<RequestLogsResponse> {
    const { page, limit, start, end } = options;
    const skip = (page - 1) * limit;

    const filter = {
      user_id: userId,
      timestamp: { $gte: start, $lte: end },
    };

    const [docs, total] = await Promise.all([
      RequestLogModel.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec() as Promise<RawRequestLog[]>,
      RequestLogModel.countDocuments(filter).exec(),
    ]);

    const total_pages = Math.max(1, Math.ceil(total / limit));

    return {
      logs: docs.map(toEntry),
      pagination: {
        page,
        limit,
        total,
        total_pages,
        has_more: page < total_pages,
      },
    };
  }
}

export const requestLogRepository = new RequestLogRepository();
