/**
 * File Edit Executor
 *
 * Performs exact string replacement in files (Claude Code style).
 * Requires exact match and uniqueness for safety.
 */

import fs from 'fs/promises';
import type { ToolDefinition, ToolResult } from '@nirex/shared';
import type { ExecutionContext } from '../execution-context.js';
import { BaseToolExecutor } from './base.executor.js';
import { validatePath, isProtectedPath } from '../utils/path-validator.js';
import { AppError } from '../../../types/index.js';

export class FileEditExecutor extends BaseToolExecutor {
  readonly definition: ToolDefinition = {
    name: 'file_edit',
    description: 'Perform exact string replacement in a file. The old_string must match exactly once in the file. Creates a backup before editing.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file to edit (relative to working directory)',
        },
        old_string: {
          type: 'string',
          description: 'The exact string to replace (must match exactly once)',
        },
        new_string: {
          type: 'string',
          description: 'The replacement string',
        },
        replace_all: {
          type: 'boolean',
          description: 'Replace all occurrences instead of requiring unique match (default: false)',
        },
      },
      required: ['path', 'old_string', 'new_string'],
    },
  };

  readonly category = 'file' as const;
  readonly requiresApproval = true;
  readonly isDestructive = true;

  async execute(args: Record<string, unknown>, ctx: ExecutionContext): Promise<ToolResult> {
    const filePath = this.assertString(args.path, 'path');
    const oldString = this.assertString(args.old_string, 'old_string');
    const newString = this.assertString(args.new_string, 'new_string');
    const replaceAll = args.replace_all !== undefined ? this.assertBoolean(args.replace_all, 'replace_all') : false;

    try {
      // Validate strings are different
      if (oldString === newString) {
        throw new AppError('old_string and new_string must be different', 400, 'STRINGS_IDENTICAL');
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
          `Cannot edit protected path: ${filePath}`,
          403,
          'PROTECTED_PATH',
        );
      }

      // Read file
      const content = await fs.readFile(absolutePath, 'utf-8');

      // Count occurrences
      const occurrences = this.countOccurrences(content, oldString);

      if (occurrences === 0) {
        return this.createErrorResult(
          'file_edit_error',
          'file_edit',
          `String not found in file: "${oldString.slice(0, 100)}${oldString.length > 100 ? '...' : ''}"`,
          'STRING_NOT_FOUND',
        );
      }

      if (occurrences > 1 && !replaceAll) {
        return this.createErrorResult(
          'file_edit_error',
          'file_edit',
          `String appears ${occurrences} times in file. Use replace_all: true to replace all occurrences, or make old_string more specific.`,
          'MULTIPLE_MATCHES',
        );
      }

      // Create backup
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${absolutePath}.backup-${timestamp}`;
      await fs.copyFile(absolutePath, backupPath);

      // Perform replacement
      const newContent = replaceAll
        ? content.split(oldString).join(newString)
        : content.replace(oldString, newString);

      // Write file
      await fs.writeFile(absolutePath, newContent, 'utf-8');

      // Generate diff summary
      const oldLines = content.split('\n').length;
      const newLines = newContent.split('\n').length;
      const linesDiff = newLines - oldLines;

      const metadata: Record<string, unknown> = {
        path: filePath,
        occurrences_replaced: occurrences,
        old_size: content.length,
        new_size: newContent.length,
        size_diff: newContent.length - content.length,
        old_lines: oldLines,
        new_lines: newLines,
        lines_diff: linesDiff,
      };

      const message = `File "${filePath}" edited successfully. Replaced ${occurrences} occurrence${occurrences > 1 ? 's' : ''} (${linesDiff > 0 ? '+' : ''}${linesDiff} lines).`;

      return this.createSuccessResult(
        'file_edit_result',
        'file_edit',
        message,
        metadata,
      );
    } catch (err) {
      if (err instanceof AppError) throw err;
      const error = err as NodeJS.ErrnoException;
      if (error.code === 'ENOENT') {
        return this.createErrorResult('file_edit_error', 'file_edit', `File not found: ${filePath}`, 'FILE_NOT_FOUND');
      }
      if (error.code === 'EACCES') {
        return this.createErrorResult('file_edit_error', 'file_edit', `Permission denied: ${filePath}`, 'PERMISSION_DENIED');
      }
      return this.createErrorResult('file_edit_error', 'file_edit', error, 'EDIT_ERROR');
    }
  }

  private countOccurrences(text: string, search: string): number {
    let count = 0;
    let pos = 0;
    while ((pos = text.indexOf(search, pos)) !== -1) {
      count++;
      pos += search.length;
    }
    return count;
  }
}
