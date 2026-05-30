/**
 * File Read Executor
 *
 * Reads file contents with range support for large files.
 * Detects binary files and handles images/PDFs appropriately.
 */

import fs from 'fs/promises';
import path from 'path';
import type { ToolDefinition, ToolResult } from '@nirex/shared';
import type { ExecutionContext } from '../execution-context.js';
import { BaseToolExecutor } from './base.executor.js';
import { validatePath } from '../utils/path-validator.js';
import { AppError } from '../../../types/index.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const BINARY_EXTENSIONS = new Set([
  '.exe', '.dll', '.so', '.dylib', '.bin', '.dat', '.db', '.sqlite',
  '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar',
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico', '.webp',
  '.mp3', '.mp4', '.avi', '.mov', '.mkv', '.flv',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
]);

export class FileReadExecutor extends BaseToolExecutor {
  readonly definition: ToolDefinition = {
    name: 'file_read',
    description: 'Read file contents at the specified path. Supports range reading for large files.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file to read (relative to working directory)',
        },
        offset: {
          type: 'number',
          description: 'Line number to start reading from (0-indexed, optional)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of lines to read (optional)',
        },
      },
      required: ['path'],
    },
  };

  readonly category = 'file' as const;
  readonly requiresApproval = false;
  readonly isDestructive = false;

  async execute(args: Record<string, unknown>, ctx: ExecutionContext): Promise<ToolResult> {
    const filePath = this.assertString(args.path, 'path');
    const offset = args.offset !== undefined ? this.assertNumber(args.offset, 'offset') : undefined;
    const limit = args.limit !== undefined ? this.assertNumber(args.limit, 'limit') : undefined;

    try {
      // Validate path
      const absolutePath = validatePath(filePath, {
        workingDirectory: ctx.workingDirectory,
        deniedPaths: ctx.permissions.deniedPaths,
        allowedPaths: ctx.permissions.allowedPaths,
      });

      // Check if file exists
      const stats = await fs.stat(absolutePath);
      if (!stats.isFile()) {
        throw new AppError(`Path "${filePath}" is not a file`, 400, 'NOT_A_FILE');
      }

      // Check file size
      if (stats.size > MAX_FILE_SIZE) {
        throw new AppError(
          `File "${filePath}" is too large (${stats.size} bytes). Maximum size is ${MAX_FILE_SIZE} bytes. Use offset and limit parameters to read in chunks.`,
          400,
          'FILE_TOO_LARGE',
        );
      }

      // Check if binary
      const ext = path.extname(absolutePath).toLowerCase();
      if (BINARY_EXTENSIONS.has(ext)) {
        return this.createSuccessResult(
          'file_read_result',
          'file_read',
          `[Binary file: ${filePath} (${stats.size} bytes, ${ext} format)]`,
          { binary: true, size: stats.size, extension: ext },
        );
      }

      // Read file
      const content = await fs.readFile(absolutePath, 'utf-8');
      const lines = content.split('\n');

      // Apply range if specified
      let resultLines = lines;
      if (offset !== undefined || limit !== undefined) {
        const start = offset ?? 0;
        const end = limit !== undefined ? start + limit : undefined;
        resultLines = lines.slice(start, end);
      }

      const resultContent = resultLines.join('\n');
      const metadata: Record<string, unknown> = {
        path: filePath,
        size: stats.size,
        lines: lines.length,
      };

      if (offset !== undefined || limit !== undefined) {
        metadata.offset = offset ?? 0;
        metadata.limit = limit;
        metadata.returned_lines = resultLines.length;
      }

      return this.createSuccessResult(
        'file_read_result',
        'file_read',
        resultContent,
        metadata,
      );
    } catch (err) {
      if (err instanceof AppError) throw err;
      const error = err as NodeJS.ErrnoException;
      if (error.code === 'ENOENT') {
        return this.createErrorResult('file_read_error', 'file_read', `File not found: ${filePath}`, 'FILE_NOT_FOUND');
      }
      if (error.code === 'EACCES') {
        return this.createErrorResult('file_read_error', 'file_read', `Permission denied: ${filePath}`, 'PERMISSION_DENIED');
      }
      return this.createErrorResult('file_read_error', 'file_read', error, 'READ_ERROR');
    }
  }
}
