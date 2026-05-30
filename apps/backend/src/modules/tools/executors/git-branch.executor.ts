/**
 * Git Branch Executor
 *
 * List, create, or delete branches.
 */

import { spawn } from 'child_process';
import type { ToolDefinition, ToolResult } from '@nirex/shared';
import type { ExecutionContext } from '../execution-context.js';
import { BaseToolExecutor } from './base.executor.js';

export class GitBranchExecutor extends BaseToolExecutor {
  readonly definition: ToolDefinition = {
    name: 'git_branch',
    description: 'List, create, or delete branches. Without arguments, lists all branches.',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Branch name to create or delete',
        },
        delete: {
          type: 'boolean',
          description: 'Delete the specified branch (default: false)',
        },
        force: {
          type: 'boolean',
          description: 'Force delete unmerged branch (default: false)',
        },
      },
      required: [],
    },
  };

  readonly category = 'git' as const;
  readonly requiresApproval = true;
  readonly isDestructive = true;

  async execute(args: Record<string, unknown>, ctx: ExecutionContext): Promise<ToolResult> {
    const name = args.name !== undefined ? this.assertString(args.name, 'name') : undefined;
    const deleteFlag = args.delete !== undefined ? this.assertBoolean(args.delete, 'delete') : false;
    const force = args.force !== undefined ? this.assertBoolean(args.force, 'force') : false;

    return new Promise((resolve) => {
      const gitArgs = ['branch'];

      if (name) {
        if (deleteFlag) {
          gitArgs.push(force ? '-D' : '-d', name);
        } else {
          gitArgs.push(name);
        }
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
            'git_branch_result',
            'git_branch',
            stdout,
            { name, delete: deleteFlag, force },
          ));
        } else {
          resolve(this.createErrorResult(
            'git_branch_error',
            'git_branch',
            stderr || `git branch failed with exit code ${code}`,
            'GIT_ERROR',
          ));
        }
      });

      git.on('error', (err) => {
        resolve(this.createErrorResult('git_branch_error', 'git_branch', err, 'SPAWN_ERROR'));
      });
    });
  }
}
