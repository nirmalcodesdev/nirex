/**
 * Git Commit Executor
 *
 * Creates a new commit with staged changes.
 */

import { spawn } from 'child_process';
import type { ToolDefinition, ToolResult } from '@nirex/shared';
import type { ExecutionContext } from '../execution-context.js';
import { BaseToolExecutor } from './base.executor.js';

export class GitCommitExecutor extends BaseToolExecutor {
  readonly definition: ToolDefinition = {
    name: 'git_commit',
    description: 'Create a new commit with staged changes. Requires a commit message.',
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Commit message',
        },
        all: {
          type: 'boolean',
          description: 'Automatically stage all modified and deleted files (git commit -a) (default: false)',
        },
      },
      required: ['message'],
    },
  };

  readonly category = 'git' as const;
  readonly requiresApproval = true;
  readonly isDestructive = true;

  async execute(args: Record<string, unknown>, ctx: ExecutionContext): Promise<ToolResult> {
    const message = this.assertString(args.message, 'message');
    const all = args.all !== undefined ? this.assertBoolean(args.all, 'all') : false;

    return new Promise((resolve) => {
      const gitArgs = ['commit', '-m', message];
      if (all) gitArgs.push('-a');

      const git = spawn('git', gitArgs, {
        cwd: ctx.workingDirectory,
        timeout: 10000,
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
            'git_commit_result',
            'git_commit',
            stdout,
            { message, all },
          ));
        } else {
          resolve(this.createErrorResult(
            'git_commit_error',
            'git_commit',
            stderr || stdout || `git commit failed with exit code ${code}`,
            'GIT_ERROR',
          ));
        }
      });

      git.on('error', (err) => {
        resolve(this.createErrorResult('git_commit_error', 'git_commit', err, 'SPAWN_ERROR'));
      });
    });
  }
}
