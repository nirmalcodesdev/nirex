/**
 * Git Log Executor
 *
 * Shows commit history.
 */

import { spawn } from 'child_process';
import type { ToolDefinition, ToolResult } from '@nirex/shared';
import type { ExecutionContext } from '../execution-context.js';
import { BaseToolExecutor } from './base.executor.js';

export class GitLogExecutor extends BaseToolExecutor {
  readonly definition: ToolDefinition = {
    name: 'git_log',
    description: 'Show commit history. Returns recent commits with hash, author, date, and message.',
    parameters: {
      type: 'object',
      properties: {
        max_count: {
          type: 'number',
          description: 'Maximum number of commits to show (default: 10, max: 100)',
        },
        file_path: {
          type: 'string',
          description: 'Show history for specific file or directory',
        },
        oneline: {
          type: 'boolean',
          description: 'Show each commit on a single line (default: false)',
        },
      },
      required: [],
    },
  };

  readonly category = 'git' as const;
  readonly requiresApproval = false;
  readonly isDestructive = false;

  async execute(args: Record<string, unknown>, ctx: ExecutionContext): Promise<ToolResult> {
    const maxCount = args.max_count !== undefined ? Math.min(this.assertNumber(args.max_count, 'max_count'), 100) : 10;
    const filePath = args.file_path !== undefined ? this.assertString(args.file_path, 'file_path') : undefined;
    const oneline = args.oneline !== undefined ? this.assertBoolean(args.oneline, 'oneline') : false;

    return new Promise((resolve) => {
      const gitArgs = ['log', `--max-count=${maxCount}`];
      if (oneline) gitArgs.push('--oneline');
      if (filePath) gitArgs.push('--', filePath);

      const git = spawn('git', gitArgs, {
        cwd: ctx.workingDirectory,
        timeout: 15000,
      });

      let stdout = '';
      let stderr = '';

      git.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      git.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      git.on('close', (code) => {
        if (code === 0) {
          resolve(this.createSuccessResult(
            'git_log_result',
            'git_log',
            stdout || 'No commits',
            { max_count: maxCount, file_path: filePath, oneline },
          ));
        } else {
          resolve(this.createErrorResult(
            'git_log_error',
            'git_log',
            stderr || `git log failed with exit code ${code}`,
            'GIT_ERROR',
          ));
        }
      });

      git.on('error', (err) => {
        resolve(this.createErrorResult('git_log_error', 'git_log', err, 'SPAWN_ERROR'));
      });
    });
  }
}
