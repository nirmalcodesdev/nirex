import mongoose, { Document, Schema, Types } from 'mongoose';
import { type SessionCheckpoint } from '@nirex/shared';

/**
 * Session Checkpoint Document interface extending shared SessionCheckpoint
 * with Mongoose Document properties
 */
export interface ISessionCheckpointDocument
  extends Omit<SessionCheckpoint, 'id' | 'session_id'>,
    Document {
  _id: Types.ObjectId;
  sessionId: Types.ObjectId;
}

// ============================================================================
// Session Checkpoint Schema
// ============================================================================

const SessionCheckpointSchema = new Schema<ISessionCheckpointDocument>(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'ChatSession',
      required: true,
      index: true,
    },
    snapshot: {
      type: String,
      required: true,
      maxlength: 50000,
    },
    turn_index: {
      type: Number,
      required: true,
      min: 0,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: false, // Checkpoints don't need updated_at
    },
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
    },
  }
);

// ============================================================================
// Indexes
// ============================================================================

// Compound index for listing checkpoints for a session in order
SessionCheckpointSchema.index({ sessionId: 1, turn_index: 1 });

// Index for finding checkpoints by turn index
SessionCheckpointSchema.index({ sessionId: 1, created_at: -1 });

// ============================================================================
// Model Export
// ============================================================================

// Check if model already exists (handles test environment where module may be reloaded)
export const SessionCheckpointModel =
  (mongoose.models.SessionCheckpoint as mongoose.Model<ISessionCheckpointDocument>) ||
  mongoose.model<ISessionCheckpointDocument>('SessionCheckpoint', SessionCheckpointSchema);
