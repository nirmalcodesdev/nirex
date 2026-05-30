/**
 * Content Search Executor
 *
 * Searches file contents using regex patterns (grep-style).
 * Native Node.js implementation with optional ripgrep fallback.
 */

import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import type { ToolDefinition, ToolResult } from '@nirex/shared';
import type { ExecutionContext } from '../execution-context.js';
import { BaseToolExecutor } from './base.executor.js';
import { validatePath } from '../utils/path-validator.js';
import { matchGlob } from '../utils/glob-matcher.js';
import { AppError } from '../../../types/index.js';

const MAX_RESULTS = 500;
const MAX_FILE_SIZE = 1024 * 1024; // 1MB per file

export class ContentSearchExecutor extends BaseToolExecutor {
  readonly definition: ToolDefinition = {
    name: 'content_search',
    description: 'Search file contents using regex patterns. Returns matching lines with line numbers.',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Regex pattern to search for',
        },
        path: {
          type: 'string',
          description: 'Directory or file to search in (relative to working directory, default: ".")',
        },
        file_pattern: {
          type: 'string',
          description: 'Glob pattern to filter files (e.g., "*.ts", "**/*.{js,jsx}")',
        },
        case_insensitive: {
          type: 'boolean',
          description: 'Case-insensitive search (default: false)',
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of matches to return (default: 100)',
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
    const searchPath = args.path !== undefined ? this.assertString(args.path, 'path') : '.';
    const filePattern = args.file_pattern !== undefined ? this.assertString(args.file_pattern, 'file_pattern') : undefined;
    const caseInsensitive = args.case_insensitive !== undefined ? this.assertBoolean(args.case_insensitive, 'case_insensitive') : false;
    const maxResults = args.max_results !== undefined ? this.assertNumber(args.max_results, 'max_results') : 100;

    try {
      // Validate max results
      if (maxResults > MAX_RESULTS) {
        throw new AppError(`max_results cannot exceed ${MAX_RESULTS}`, 400, 'MAX_RESULTS_EXCEEDED');
      }

      // Validate pattern
      let regex: RegExp;
      try {
        regex = new RegExp(pattern, caseInsensitive ? 'i' : '');
      } catch (err) {
        throw new AppError(`Invalid regex pattern: ${(err as Error).message}`, 400, 'INVALID_PATTERN');
      }

      // Validate path
      const absolutePath = validatePath(searchPath, {
        workingDirectory: ctx.workingDirectory,
        deniedPaths: ctx.permissions.deniedPaths,
        allowedPaths: ctx.permissions.allowedPaths,
      });

      // Try ripgrep first, fall back to native search
      let matches: Array<{ file: string; line: number; content: string }>;
      try {
        matches = await this.searchWithRipgrep(absolutePath, pattern, filePattern, caseInsensitive, maxResults, ctx.workingDirectory);
      } catch (err) {
        // Ripgrep not available, use native search
        matches = await this.searchNative(absolutePath, regex, filePattern, maxResults, ctx.workingDirectory);
      }

      // Format output
      const lines: string[] = [];
      lines.push(`Pattern: ${pattern}`);
      lines.push(`Path: ${searchPath}`);
      if (filePattern) lines.push(`File pattern: ${filePattern}`);
      lines.push(`Matches: ${matches.length}${matches.length >= maxResults ? ` (limited to ${maxResults})` : ''}`);
      lines.push('');

      for (const match of matches) {
        lines.push(`${match.file}:${match.line}: ${match.content}`);
      }

      const content = lines.join('\n');

      return this.createSuccessResult(
        'content_search_result',
        'content_search',
        content,
        {
          pattern,
          path: searchPath,
          file_pattern: filePattern,
          matches: matches.length,
          truncated: matches.length >= maxResults,
          files_searched: new Set(matches.map((m) => m.file)).size,
        },
      );
    } catch (err) {
      if (err instanceof AppError) throw err;
      const error = err as NodeJS.ErrnoException;
      if (error.code === 'ENOENT') {
        return this.createErrorResult('content_search_error', 'content_search', `Path not found: ${searchPath}`, 'PATH_NOT_FOUND');
      }
      if (error.code === 'EACCES') {
        return this.createErrorResult('content_search_error', 'content_search', `Permission denied: ${searchPath}`, 'PERMISSION_DENIED');
      }
      return this.createErrorResult('content_search_error', 'content_search', error, 'SEARCH_ERROR');
    }
  }

  private async searchWithRipgrep(
    absolutePath: string,
    pattern: string,
    filePattern: string | undefined,
    caseInsensitive: boolean,
    maxResults: number,
    workingDirectory: string,
  ): Promise<Array<{ file: string; line: number; content: string }>> {
    return new Promise((resolve, reject) => {
      const args = ['--line-number', '--no-heading', '--max-count', maxResults.toString()];
      if (caseInsensitive) args.push('--ignore-case');
      if (filePattern) args.push('--glob', filePattern);
      args.push(pattern, absolutePath);

      const rg = spawn('rg', args, { timeout: 30000 });
      let stdout = '';
      let stderr = '';

      rg.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      rg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      rg.on('close', (code) => {
        if (code === 0 || code === 1) {
          // code 1 means no matches, which is fine
          const matches = this.parseRipgrepOutput(stdout, workingDirectory);
          resolve(matches);
        } else {
          reject(new Error(`ripgrep failed: ${stderr}`));
        }
      });

      rg.on('error', (err) => {
        reject(err);
      });
    });
  }

  private parseRipgrepOutput(output: string, workingDirectory: string): Array<{ file: string; line: number; content: string }> {
    const matches: Array<{ file: string; line: number; content: string }> = [];
    const lines = output.split('\n').filter((l) => l.trim());

    for (const line of lines) {
      const match = line.match(/^([^:]+):(\d+):(.*)$/);
      if (match && match[1] && match[2] && match[3]) {
        const filePath = match[1];
        const lineNum = match[2];
        const content = match[3];
        matches.push({
          file: path.relative(workingDirectory, filePath),
          line: parseInt(lineNum, 10),
          content: content,
        });
      }
    }

    return matches;
  }

  private async searchNative(
    absolutePath: string,
    regex: RegExp,
    filePattern: string | undefined,
    maxResults: number,
    workingDirectory: string,
  ): Promise<Array<{ file: string; line: number; content: string }>> {
    const matches: Array<{ file: string; line: number; content: string }> = [];
    const visited = new Set<string>();

    const searchFile = async (filePath: string): Promise<void> => {
      if (matches.length >= maxResults) return;

      try {
        const stats = await fs.stat(filePath);
        if (stats.size > MAX_FILE_SIZE) return; // Skip large files

        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length && matches.length < maxResults; i++) {
          const line = lines[i];
          if (line && regex.test(line)) {
            matches.push({
              file: path.relative(workingDirectory, filePath),
              line: i + 1,
              content: line.trim(),
            });
          }
        }
      } catch (err) {
        // Skip files we can't read or that aren't text
      }
    };

    const searchDir = async (dir: string): Promise<void> => {
      if (matches.length >= maxResults) return;

      const realPath = await fs.realpath(dir);
      if (visited.has(realPath)) return;
      visited.add(realPath);

      try {
        const items = await fs.readdir(dir, { withFileTypes: true });

        for (const item of items) {
          if (matches.length >= maxResults) break;

          if (item.name.startsWith('.') || item.name === 'node_modules') {
            continue;
          }

          const itemPath = path.join(dir, item.name);

          if (item.isDirectory()) {
            await searchDir(itemPath);
          } else if (item.isFile()) {
            const relativePath = path.relative(workingDirectory, itemPath);
            if (!filePattern || matchGlob(relativePath, filePattern)) {
              await searchFile(itemPath);
            }
          }
        }
      } catch (err) {
        // Skip directories we can't read
      }
    };

    const stats = await fs.stat(absolutePath);
    if (stats.isFile()) {
      await searchFile(absolutePath);
    } else if (stats.isDirectory()) {
      await searchDir(absolutePath);
    }

    return matches;
  }
}
