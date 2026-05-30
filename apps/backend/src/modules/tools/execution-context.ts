/**
 * Tool Execution Context
 *
 * Provides context for tool execution including session info, permissions,
 * working directory, sandbox, and abort signals.
 */

import type { Types } from 'mongoose';
import type { PermissionAction } from '@nirex/shared';

export interface ExecutionContext {
  sessionId: string;
  userId: string;
  workingDirectory: string;
  sandboxId?: string;
  permissions: PermissionSet;
  abortSignal: AbortSignal;
  metadata?: Record<string, unknown>;
}

export interface PermissionSet {
  defaultAction: PermissionAction;
  allowedTools: Set<string>;
  deniedTools: Set<string>;
  allowedPaths?: string[];
  deniedPaths?: string[];
}

export interface ExecutionContextOptions {
  sessionId: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  workingDirectory?: string;
  sandboxId?: string;
  permissions?: Partial<PermissionSet>;
  abortSignal?: AbortSignal;
  metadata?: Record<string, unknown>;
}

export function createExecutionContext(options: ExecutionContextOptions): ExecutionContext {
  const {
    sessionId,
    userId,
    workingDirectory = process.cwd(),
    sandboxId,
    permissions = {},
    abortSignal = new AbortController().signal,
    metadata,
  } = options;

  return {
    sessionId: sessionId.toString(),
    userId: userId.toString(),
    workingDirectory,
    sandboxId,
    permissions: {
      defaultAction: permissions.defaultAction ?? 'ask',
      allowedTools: permissions.allowedTools ?? new Set(),
      deniedTools: permissions.deniedTools ?? new Set(),
      allowedPaths: permissions.allowedPaths,
      deniedPaths: permissions.deniedPaths,
    },
    abortSignal,
    metadata,
  };
}
