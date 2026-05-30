/**
 * Git Checkout Executor
 *
 * Switch branches or restore working tree files.
 */

import { spawn } from 'child_process';
import type { ToolDefinition, ToolResult } from '@nirex/shared';
import type { ExecutionContext } from '../execution-context.js';
import { BaseToolExecutor } from './base.executor.js';

export class GitCheckoutExecutor extends BaseToolExecutor {
  readonly definition: ToolDefinition = {
    name: 'git_checkout',
    description: 'Switch branches or restore working tree files.',
    parameters: {
      type: 'object',
      properties: {
        branch: {
          type: 'string',
          description: 'Branch name to checkout',
        },
        create: {
          type: 'boolean',
          description: 'Create new branch before checking out (git checkout -b) (default: false)',
        },
        file_path: {
          type: 'string',
          description: 'Restore specific file from HEAD (discards local changes)',
        },
      },
      required: [],
    },
  };

  readonly category = 'git' as const;
  readonly requiresApproval = true;
  readonly isDestructive = true;

  async execute(args: Record<string, unknown>, ctx: ExecutionContext): Promise<ToolResult> {
    const branch = args.branch !== undefined ? this.assertString(args.branch, 'branch') : undefined;
    const create = args.create !== undefined ? this.assertBoolean(args.create, 'create') : false;
    const filePath = args.file_path !== undefined ? this.assertString(args.file_path, 'file_path') : undefined;

    if (!branch && !filePath) {
      return this.createErrorResult(
        'git_checkout_error',
        'git_checkout',
        'Either branch or file_path must be specified',
        'MISSING_PARAMETER',
      );
    }

    return new Promise((resolve) => {
      const gitArgs = ['checkout'];

      if (branch) {
        if (create) gitArgs.push('-b');
        gitArgs.push(branch);
      } else if (filePath) {
        gitArgs.push('--', filePath);
      }

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
            'git_checkout_result',
            'git_checkout',
            stderr || stdout || 'Checkout successful',
            { branch, create, file_path: filePath },
          ));
        } else {
          resolve(this.createErrorResult(
            'git_checkout_error',
            'git_checkout',
            stderr || `git checkout failed with exit code ${code}`,
            'GIT_ERROR',
          ));
        }
      });

      git.on('error', (err) => {
        resolve(this.createErrorResult('git_checkout_error', 'git_checkout', err, 'SPAWN_ERROR'));
      });
    });
  }
}
