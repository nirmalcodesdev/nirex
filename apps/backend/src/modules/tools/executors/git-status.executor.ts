/**
 * Git Status Executor
 *
 * Shows the working tree status.
 */

import { spawn } from 'child_process';
import type { ToolDefinition, ToolResult } from '@nirex/shared';
import type { ExecutionContext } from '../execution-context.js';
import { BaseToolExecutor } from './base.executor.js';

export class GitStatusExecutor extends BaseToolExecutor {
  readonly definition: ToolDefinition = {
    name: 'git_status',
    description: 'Show the working tree status. Lists modified, staged, and untracked files.',
    parameters: {
      type: 'object',
      properties: {
        short: {
          type: 'boolean',
          description: 'Show output in short format (default: false)',
        },
      },
      required: [],
    },
  };

  readonly category = 'git' as const;
  readonly requiresApproval = false;
  readonly isDestructive = false;

  async execute(args: Record<string, unknown>, ctx: ExecutionContext): Promise<ToolResult> {
    const short = args.short !== undefined ? this.assertBoolean(args.short, 'short') : false;

    return new Promise((resolve) => {
      const gitArgs = ['status'];
      if (short) gitArgs.push('--short');

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
            'git_status_result',
            'git_status',
            stdout || 'No changes',
            { short },
          ));
        } else {
          resolve(this.createErrorResult(
            'git_status_error',
            'git_status',
            stderr || `git status failed with exit code ${code}`,
            'GIT_ERROR',
          ));
        }
      });

      git.on('error', (err) => {
        resolve(this.createErrorResult('git_status_error', 'git_status', err, 'SPAWN_ERROR'));
      });
    });
  }
}
