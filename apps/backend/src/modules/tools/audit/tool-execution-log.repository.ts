/**
 * Tool Execution Log Repository
 *
 * Data access layer for tool execution audit logs.
 */

import { Types } from 'mongoose';
import { ToolExecutionLogModel } from './tool-execution-log.model.js';
import type { ToolCategory } from '@nirex/shared';

export interface CreateToolExecutionLogData {
  user_id: Types.ObjectId;
  session_id: Types.ObjectId;
  tool_name: string;
  tool_category: ToolCategory;
  arguments: Record<string, unknown>;
  result_summary: string;
  is_error: boolean;
  error_code?: string;
  duration_ms: number;
  working_directory: string;
  sandbox_id?: string;
  permission_granted: boolean;
}

export class ToolExecutionLogRepository {
  async create(data: CreateToolExecutionLogData): Promise<void> {
    await ToolExecutionLogModel.create(data);
  }

  async findBySession(
    sessionId: Types.ObjectId,
    options: { limit?: number; skip?: number } = {},
  ): Promise<Array<{
    id: string;
    tool_name: string;
    tool_category: string;
    is_error: boolean;
    duration_ms: number;
    created_at: Date;
  }>> {
    const { limit = 100, skip = 0 } = options;

    const docs = await ToolExecutionLogModel.find({ session_id: sessionId })
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .select('tool_name tool_category is_error duration_ms created_at')
      .lean()
      .exec();

    return docs.map((doc) => ({
      id: doc._id.toString(),
      tool_name: doc.tool_name,
      tool_category: doc.tool_category,
      is_error: doc.is_error,
      duration_ms: doc.duration_ms,
      created_at: doc.created_at,
    }));
  }

  async findByUser(
    userId: Types.ObjectId,
    options: { limit?: number; skip?: number; startDate?: Date; endDate?: Date } = {},
  ): Promise<Array<{
    id: string;
    session_id: string;
    tool_name: string;
    tool_category: string;
    is_error: boolean;
    duration_ms: number;
    created_at: Date;
  }>> {
    const { limit = 100, skip = 0, startDate, endDate } = options;

    const filter: Record<string, unknown> = { user_id: userId };
    if (startDate || endDate) {
      filter.created_at = {};
      if (startDate) (filter.created_at as Record<string, unknown>).$gte = startDate;
      if (endDate) (filter.created_at as Record<string, unknown>).$lte = endDate;
    }

    const docs = await ToolExecutionLogModel.find(filter)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .select('session_id tool_name tool_category is_error duration_ms created_at')
      .lean()
      .exec();

    return docs.map((doc) => ({
      id: doc._id.toString(),
      session_id: doc.session_id.toString(),
      tool_name: doc.tool_name,
      tool_category: doc.tool_category,
      is_error: doc.is_error,
      duration_ms: doc.duration_ms,
      created_at: doc.created_at,
    }));
  }

  async countByUser(
    userId: Types.ObjectId,
    options: { startDate?: Date; endDate?: Date } = {},
  ): Promise<number> {
    const { startDate, endDate } = options;

    const filter: Record<string, unknown> = { user_id: userId };
    if (startDate || endDate) {
      filter.created_at = {};
      if (startDate) (filter.created_at as Record<string, unknown>).$gte = startDate;
      if (endDate) (filter.created_at as Record<string, unknown>).$lte = endDate;
    }

    return ToolExecutionLogModel.countDocuments(filter).exec();
  }
}

export const toolExecutionLogRepository = new ToolExecutionLogRepository();
