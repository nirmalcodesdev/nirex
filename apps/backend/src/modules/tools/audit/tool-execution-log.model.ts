/**
 * Tool Execution Log Model
 *
 * Audit trail for all tool executions. Records tool name, arguments,
 * results, timing, and context for compliance and debugging.
 */

import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IToolExecutionLogDocument extends Document<Types.ObjectId> {
  _id: Types.ObjectId;
  user_id: Types.ObjectId;
  session_id: Types.ObjectId;
  tool_name: string;
  tool_category: string;
  arguments: Record<string, unknown>;
  result_summary: string;
  is_error: boolean;
  error_code?: string;
  duration_ms: number;
  working_directory: string;
  sandbox_id?: string;
  permission_granted: boolean;
  created_at: Date;
  updated_at: Date;
}

const ToolExecutionLogSchema = new Schema<IToolExecutionLogDocument>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    session_id: {
      type: Schema.Types.ObjectId,
      ref: 'ChatSession',
      required: true,
      index: true,
    },
    tool_name: {
      type: String,
      required: true,
      maxlength: 100,
      index: true,
    },
    tool_category: {
      type: String,
      required: true,
      enum: ['file', 'bash', 'git', 'lsp', 'web', 'sandbox', 'custom'],
      index: true,
    },
    arguments: {
      type: Schema.Types.Mixed,
      required: true,
    },
    result_summary: {
      type: String,
      required: true,
      maxlength: 10000,
    },
    is_error: {
      type: Boolean,
      required: true,
      default: false,
      index: true,
    },
    error_code: {
      type: String,
      required: false,
      maxlength: 100,
    },
    duration_ms: {
      type: Number,
      required: true,
      min: 0,
    },
    working_directory: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    sandbox_id: {
      type: String,
      required: false,
      maxlength: 200,
    },
    permission_granted: {
      type: Boolean,
      required: true,
      default: true,
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
);

// Indexes for audit queries
ToolExecutionLogSchema.index({ user_id: 1, created_at: -1 });
ToolExecutionLogSchema.index({ session_id: 1, created_at: -1 });
ToolExecutionLogSchema.index({ tool_name: 1, created_at: -1 });
ToolExecutionLogSchema.index({ tool_category: 1, created_at: -1 });
ToolExecutionLogSchema.index({ is_error: 1, created_at: -1 });
ToolExecutionLogSchema.index({ created_at: -1 });

export const ToolExecutionLogModel =
  (mongoose.models.ToolExecutionLog as mongoose.Model<IToolExecutionLogDocument>) ||
  mongoose.model<IToolExecutionLogDocument>('ToolExecutionLog', ToolExecutionLogSchema);
