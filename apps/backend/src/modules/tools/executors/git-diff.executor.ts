/**
 * Git Diff Executor
 *
 * Shows changes between commits, commit and working tree, etc.
 */

import { spawn } from 'child_process';
import type { ToolDefinition, ToolResult } from '@nirex/shared';
import type { ExecutionContext } from '../execution-context.js';
import { BaseToolExecutor } from './base.executor.js';

const MAX_DIFF_SIZE = 50000; // 50K chars

export class GitDiffExecutor extends BaseToolExecutor {
  readonly definition: ToolDefinition = {
    name: 'git_diff',
    description: 'Show changes between commits, commit and working tree, etc. By default shows unstaged changes.',
    parameters: {
      type: 'object',
      properties: {
        staged: {
          type: 'boolean',
          description: 'Show staged changes (--cached) instead of unstaged (default: false)',
        },
        file_path: {
          type: 'string',
          description: 'Show diff for specific file or directory',
        },
        commit: {
          type: 'string',
          description: 'Compare against specific commit (e.g., "HEAD~1", "main")',
        },
      },
      required: [],
    },
  };

  readonly category = 'git' as const;
  readonly requiresApproval = false;
  readonly isDestructive = false;

  async execute(args: Record<string, unknown>, ctx: ExecutionContext): Promise<ToolResult> {
    const staged = args.staged !== undefined ? this.assertBoolean(args.staged, 'staged') : false;
    const filePath = args.file_path !== undefined ? this.assertString(args.file_path, 'file_path') : undefined;
    const commit = args.commit !== undefined ? this.assertString(args.commit, 'commit') : undefined;

    return new Promise((resolve) => {
      const gitArgs = ['diff'];
      if (staged) gitArgs.push('--cached');
      if (commit) gitArgs.push(commit);
      if (filePath) gitArgs.push('--', filePath);

      const git = spawn('git', gitArgs, {
        cwd: ctx.workingDirectory,
        timeout: 30000,
      });

      let stdout = '';
      let stderr = '';

      git.stdout.on('data', (data) => {
        stdout += data.toString();
        // Prevent memory issues with huge diffs
        if (stdout.length > MAX_DIFF_SIZE * 2) {
          git.kill();
        }
      });

      git.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      git.on('close', (code) => {
        if (code === 0) {
          let output = stdout;
          let truncated = false;

          if (output.length > MAX_DIFF_SIZE) {
            output = output.slice(0, MAX_DIFF_SIZE) + `\n\n... (diff truncated, ${output.length - MAX_DIFF_SIZE} more characters)`;
            truncated = true;
          }

          resolve(this.createSuccessResult(
            'git_diff_result',
            'git_diff',
            output || 'No changes',
            { staged, file_path: filePath, commit, truncated },
          ));
        } else {
          resolve(this.createErrorResult(
            'git_diff_error',
            'git_diff',
            stderr || `git diff failed with exit code ${code}`,
            'GIT_ERROR',
          ));
        }
      });

      git.on('error', (err) => {
        resolve(this.createErrorResult('git_diff_error', 'git_diff', err, 'SPAWN_ERROR'));
      });
    });
  }
}
