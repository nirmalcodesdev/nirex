/**
 * Directory List Executor
 *
 * Lists directory contents with metadata (size, type, modified time).
 */

import fs from 'fs/promises';
import path from 'path';
import type { ToolDefinition, ToolResult } from '@nirex/shared';
import type { ExecutionContext } from '../execution-context.js';
import { BaseToolExecutor } from './base.executor.js';
import { validatePath } from '../utils/path-validator.js';
import { AppError } from '../../../types/index.js';

export class DirectoryListExecutor extends BaseToolExecutor {
  readonly definition: ToolDefinition = {
    name: 'directory_list',
    description: 'List contents of a directory with metadata (name, type, size, modified time).',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the directory to list (relative to working directory, default: ".")',
        },
        recursive: {
          type: 'boolean',
          description: 'List subdirectories recursively (default: false)',
        },
        include_hidden: {
          type: 'boolean',
          description: 'Include hidden files (starting with .) (default: false)',
        },
      },
      required: [],
    },
  };

  readonly category = 'file' as const;
  readonly requiresApproval = false;
  readonly isDestructive = false;

  async execute(args: Record<string, unknown>, ctx: ExecutionContext): Promise<ToolResult> {
    const dirPath = args.path !== undefined ? this.assertString(args.path, 'path') : '.';
    const recursive = args.recursive !== undefined ? this.assertBoolean(args.recursive, 'recursive') : false;
    const includeHidden = args.include_hidden !== undefined ? this.assertBoolean(args.include_hidden, 'include_hidden') : false;

    try {
      // Validate path
      const absolutePath = validatePath(dirPath, {
        workingDirectory: ctx.workingDirectory,
        deniedPaths: ctx.permissions.deniedPaths,
        allowedPaths: ctx.permissions.allowedPaths,
      });

      // Check if directory exists
      const stats = await fs.stat(absolutePath);
      if (!stats.isDirectory()) {
        throw new AppError(`Path "${dirPath}" is not a directory`, 400, 'NOT_A_DIRECTORY');
      }

      // List directory
      const entries = await this.listDirectory(absolutePath, recursive, includeHidden, ctx.workingDirectory);

      // Format output
      const lines: string[] = [];
      lines.push(`Directory: ${dirPath}`);
      lines.push(`Total entries: ${entries.length}`);
      lines.push('');

      for (const entry of entries) {
        const type = entry.type === 'directory' ? 'DIR ' : 'FILE';
        const size = entry.type === 'file' ? this.formatSize(entry.size) : '';
        const modified = new Date(entry.modified).toISOString().slice(0, 19).replace('T', ' ');
        lines.push(`${type}  ${size.padEnd(10)}  ${modified}  ${entry.path}`);
      }

      const content = lines.join('\n');

      return this.createSuccessResult(
        'directory_list_result',
        'directory_list',
        content,
        {
          path: dirPath,
          total_entries: entries.length,
          directories: entries.filter((e) => e.type === 'directory').length,
          files: entries.filter((e) => e.type === 'file').length,
        },
      );
    } catch (err) {
      if (err instanceof AppError) throw err;
      const error = err as NodeJS.ErrnoException;
      if (error.code === 'ENOENT') {
        return this.createErrorResult('directory_list_error', 'directory_list', `Directory not found: ${dirPath}`, 'DIRECTORY_NOT_FOUND');
      }
      if (error.code === 'EACCES') {
        return this.createErrorResult('directory_list_error', 'directory_list', `Permission denied: ${dirPath}`, 'PERMISSION_DENIED');
      }
      return this.createErrorResult('directory_list_error', 'directory_list', error, 'LIST_ERROR');
    }
  }

  private async listDirectory(
    absolutePath: string,
    recursive: boolean,
    includeHidden: boolean,
    workingDirectory: string,
  ): Promise<Array<{ path: string; type: 'file' | 'directory'; size: number; modified: string }>> {
    const entries: Array<{ path: string; type: 'file' | 'directory'; size: number; modified: string }> = [];

    const items = await fs.readdir(absolutePath, { withFileTypes: true });

    for (const item of items) {
      // Skip hidden files if not included
      if (!includeHidden && item.name.startsWith('.')) {
        continue;
      }

      const itemPath = path.join(absolutePath, item.name);
      const relativePath = path.relative(workingDirectory, itemPath);
      const stats = await fs.stat(itemPath);

      entries.push({
        path: relativePath,
        type: item.isDirectory() ? 'directory' : 'file',
        size: stats.size,
        modified: stats.mtime.toISOString(),
      });

      // Recurse into subdirectories
      if (recursive && item.isDirectory()) {
        const subEntries = await this.listDirectory(itemPath, recursive, includeHidden, workingDirectory);
        entries.push(...subEntries);
      }
    }

    return entries.sort((a, b) => a.path.localeCompare(b.path));
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
}
