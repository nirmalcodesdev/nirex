/**
 * File Write Executor
 *
 * Writes or creates files with directory auto-creation and backup support.
 */

import fs from 'fs/promises';
import path from 'path';
import type { ToolDefinition, ToolResult } from '@nirex/shared';
import type { ExecutionContext } from '../execution-context.js';
import { BaseToolExecutor } from './base.executor.js';
import { validatePath, isProtectedPath } from '../utils/path-validator.js';
import { AppError } from '../../../types/index.js';

const MAX_CONTENT_SIZE = 5 * 1024 * 1024; // 5MB

export class FileWriteExecutor extends BaseToolExecutor {
  readonly definition: ToolDefinition = {
    name: 'file_write',
    description: 'Write content to a file. Creates the file if it does not exist. Creates parent directories automatically. Backs up existing files before overwriting.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file to write (relative to working directory)',
        },
        content: {
          type: 'string',
          description: 'Content to write to the file',
        },
        create_backup: {
          type: 'boolean',
          description: 'Create a backup of existing file before overwriting (default: true)',
        },
      },
      required: ['path', 'content'],
    },
  };

  readonly category = 'file' as const;
  readonly requiresApproval = true;
  readonly isDestructive = true;

  async execute(args: Record<string, unknown>, ctx: ExecutionContext): Promise<ToolResult> {
    const filePath = this.assertString(args.path, 'path');
    const content = this.assertString(args.content, 'content');
    const createBackup = args.create_backup !== undefined ? this.assertBoolean(args.create_backup, 'create_backup') : true;

    try {
      // Validate content size
      if (content.length > MAX_CONTENT_SIZE) {
        throw new AppError(
          `Content is too large (${content.length} bytes). Maximum size is ${MAX_CONTENT_SIZE} bytes.`,
          400,
          'CONTENT_TOO_LARGE',
        );
      }

      // Validate path
      const absolutePath = validatePath(filePath, {
        workingDirectory: ctx.workingDirectory,
        deniedPaths: ctx.permissions.deniedPaths,
        allowedPaths: ctx.permissions.allowedPaths,
      });

      // Check if path is protected
      if (isProtectedPath(absolutePath)) {
        throw new AppError(
          `Cannot write to protected path: ${filePath}`,
          403,
          'PROTECTED_PATH',
        );
      }

      // Create parent directories
      const dir = path.dirname(absolutePath);
      await fs.mkdir(dir, { recursive: true });

      // Check if file exists and create backup
      let fileExisted = false;
      let backupPath: string | undefined;
      try {
        await fs.access(absolutePath);
        fileExisted = true;

        if (createBackup) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          backupPath = `${absolutePath}.backup-${timestamp}`;
          await fs.copyFile(absolutePath, backupPath);
        }
      } catch (err) {
        // File doesn't exist, no backup needed
      }

      // Write file
      await fs.writeFile(absolutePath, content, 'utf-8');

      const metadata: Record<string, unknown> = {
        path: filePath,
        size: content.length,
        lines: content.split('\n').length,
        created: !fileExisted,
        overwritten: fileExisted,
      };

      if (backupPath) {
        metadata.backup_path = path.relative(ctx.workingDirectory, backupPath);
      }

      const message = fileExisted
        ? `File "${filePath}" updated successfully (${content.length} bytes)`
        : `File "${filePath}" created successfully (${content.length} bytes)`;

      return this.createSuccessResult(
        'file_write_result',
        'file_write',
        message,
        metadata,
      );
    } catch (err) {
      if (err instanceof AppError) throw err;
      const error = err as NodeJS.ErrnoException;
      if (error.code === 'EACCES') {
        return this.createErrorResult('file_write_error', 'file_write', `Permission denied: ${filePath}`, 'PERMISSION_DENIED');
      }
      if (error.code === 'ENOSPC') {
        return this.createErrorResult('file_write_error', 'file_write', 'No space left on device', 'NO_SPACE');
      }
      return this.createErrorResult('file_write_error', 'file_write', error, 'WRITE_ERROR');
    }
  }
}
