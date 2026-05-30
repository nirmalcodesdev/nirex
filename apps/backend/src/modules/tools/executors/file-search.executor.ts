/**
 * File Search Executor
 *
 * Searches for files matching glob patterns.
 */

import fs from 'fs/promises';
import path from 'path';
import type { ToolDefinition, ToolResult } from '@nirex/shared';
import type { ExecutionContext } from '../execution-context.js';
import { BaseToolExecutor } from './base.executor.js';
import { validatePath } from '../utils/path-validator.js';
import { matchGlob } from '../utils/glob-matcher.js';
import { AppError } from '../../../types/index.js';

const MAX_RESULTS = 1000;

export class FileSearchExecutor extends BaseToolExecutor {
  readonly definition: ToolDefinition = {
    name: 'file_search',
    description: 'Search for files matching a glob pattern. Supports *, **, ?, and character classes.',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Glob pattern to match (e.g., "**/*.ts", "src/**/*.{js,jsx}")',
        },
        base_path: {
          type: 'string',
          description: 'Base directory to search from (relative to working directory, default: ".")',
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of results to return (default: 100)',
        },
      },
      required: ['pattern'],
    },
  };

  readonly category = 'file' as const;
  readonly requiresApproval = false;
  readonly isDestructive = false;

  async execute(args: Record<string, unknown>, ctx: ExecutionContext): Promise<ToolResult> {
    const pattern = this.assertString(args.pattern, 'pattern');
    const basePath = args.base_path !== undefined ? this.assertString(args.base_path, 'base_path') : '.';
    const maxResults = args.max_results !== undefined ? this.assertNumber(args.max_results, 'max_results') : 100;

    try {
      // Validate max results
      if (maxResults > MAX_RESULTS) {
        throw new AppError(`max_results cannot exceed ${MAX_RESULTS}`, 400, 'MAX_RESULTS_EXCEEDED');
      }

      // Validate base path
      const absoluteBasePath = validatePath(basePath, {
        workingDirectory: ctx.workingDirectory,
        deniedPaths: ctx.permissions.deniedPaths,
        allowedPaths: ctx.permissions.allowedPaths,
      });

      // Search for files
      const matches = await this.searchFiles(absoluteBasePath, pattern, maxResults, ctx.workingDirectory);

      // Format output
      const lines: string[] = [];
      lines.push(`Pattern: ${pattern}`);
      lines.push(`Base path: ${basePath}`);
      lines.push(`Matches: ${matches.length}${matches.length >= maxResults ? ` (limited to ${maxResults})` : ''}`);
      lines.push('');

      for (const match of matches) {
        lines.push(match);
      }

      const content = lines.join('\n');

      return this.createSuccessResult(
        'file_search_result',
        'file_search',
        content,
        {
          pattern,
          base_path: basePath,
          matches: matches.length,
          truncated: matches.length >= maxResults,
        },
      );
    } catch (err) {
      if (err instanceof AppError) throw err;
      const error = err as NodeJS.ErrnoException;
      if (error.code === 'ENOENT') {
        return this.createErrorResult('file_search_error', 'file_search', `Base path not found: ${basePath}`, 'PATH_NOT_FOUND');
      }
      if (error.code === 'EACCES') {
        return this.createErrorResult('file_search_error', 'file_search', `Permission denied: ${basePath}`, 'PERMISSION_DENIED');
      }
      return this.createErrorResult('file_search_error', 'file_search', error, 'SEARCH_ERROR');
    }
  }

  private async searchFiles(
    absoluteBasePath: string,
    pattern: string,
    maxResults: number,
    workingDirectory: string,
  ): Promise<string[]> {
    const matches: string[] = [];
    const visited = new Set<string>();

    const search = async (dir: string): Promise<void> => {
      if (matches.length >= maxResults) return;

      // Prevent infinite loops from symlinks
      const realPath = await fs.realpath(dir);
      if (visited.has(realPath)) return;
      visited.add(realPath);

      try {
        const items = await fs.readdir(dir, { withFileTypes: true });

        for (const item of items) {
          if (matches.length >= maxResults) break;

          // Skip hidden files and common ignore patterns
          if (item.name.startsWith('.') || item.name === 'node_modules') {
            continue;
          }

          const itemPath = path.join(dir, item.name);
          const relativePath = path.relative(workingDirectory, itemPath);

          if (item.isDirectory()) {
            // Check if directory matches pattern
            if (matchGlob(relativePath, pattern)) {
              matches.push(relativePath);
            }
            // Recurse into directory
            await search(itemPath);
          } else if (item.isFile()) {
            // Check if file matches pattern
            if (matchGlob(relativePath, pattern)) {
              matches.push(relativePath);
            }
          }
        }
      } catch (err) {
        // Skip directories we can't read
      }
    };

    await search(absoluteBasePath);
    return matches.sort();
  }
}
