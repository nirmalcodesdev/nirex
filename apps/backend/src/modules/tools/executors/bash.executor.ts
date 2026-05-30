/**
 * Bash Executor
 *
 * Executes shell commands with output limits, timeouts, and background mode.
 * Implements security controls and command blocklists.
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import type { ToolDefinition, ToolResult } from '@nirex/shared';
import type { ExecutionContext } from '../execution-context.js';
import { BaseToolExecutor } from './base.executor.js';
import { AppError } from '../../../types/index.js';

const DEFAULT_TIMEOUT_MS = 120000; // 2 minutes
const MAX_TIMEOUT_MS = 600000; // 10 minutes
const MAX_OUTPUT_SIZE = 30000; // 30K chars
const LOG_DIR = '.nirex/tool-logs';

// Commands that are blocked by default (can be overridden by permissions)
const BLOCKED_COMMANDS = new Set([
  'rm -rf /',
  'dd if=/dev/zero',
  'mkfs',
  'fdisk',
  ':(){ :|:& };:',  // fork bomb
]);

export class BashExecutor extends BaseToolExecutor {
  readonly definition: ToolDefinition = {
    name: 'bash',
    description: 'Execute a shell command. Output is truncated at 30K characters. Full output is saved to a log file. Supports background mode for long-running commands.',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The shell command to execute',
        },
        timeout_ms: {
          type: 'number',
          description: 'Timeout in milliseconds (default: 120000, max: 600000)',
        },
        background: {
          type: 'boolean',
          description: 'Run command in background and return immediately (default: false)',
        },
        working_directory: {
          type: 'string',
          description: 'Working directory for the command (relative to session working directory)',
        },
      },
      required: ['command'],
    },
  };

  readonly category = 'bash' as const;
  readonly requiresApproval = true;
  readonly isDestructive = true;

  async execute(args: Record<string, unknown>, ctx: ExecutionContext): Promise<ToolResult> {
    const command = this.assertString(args.command, 'command');
    const timeoutMs = args.timeout_ms !== undefined ? this.assertNumber(args.timeout_ms, 'timeout_ms') : DEFAULT_TIMEOUT_MS;
    const background = args.background !== undefined ? this.assertBoolean(args.background, 'background') : false;
    const workingDir = args.working_directory !== undefined ? this.assertString(args.working_directory, 'working_directory') : undefined;

    try {
      // Validate timeout
      if (timeoutMs > MAX_TIMEOUT_MS) {
        throw new AppError(`Timeout cannot exceed ${MAX_TIMEOUT_MS}ms`, 400, 'TIMEOUT_TOO_LARGE');
      }

      // Check blocked commands
      if (this.isBlockedCommand(command)) {
        throw new AppError(
          `Command is blocked for safety: ${command}`,
          403,
          'COMMAND_BLOCKED',
        );
      }

      // Determine working directory
      let cwd = ctx.workingDirectory;
      if (workingDir) {
        cwd = path.resolve(ctx.workingDirectory, workingDir);
        // Ensure it's within the session working directory
        if (!cwd.startsWith(ctx.workingDirectory)) {
          throw new AppError(
            'Working directory must be within session working directory',
            403,
            'INVALID_WORKING_DIRECTORY',
          );
        }
      }

      // Create log directory
      const logDir = path.join(ctx.workingDirectory, LOG_DIR);
      await fs.mkdir(logDir, { recursive: true });

      // Generate log file path
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const logFile = path.join(logDir, `bash-${timestamp}.log`);

      if (background) {
        // Background mode: spawn and return immediately
        const result = await this.executeBackground(command, cwd, logFile, ctx);
        return result;
      } else {
        // Foreground mode: wait for completion
        const result = await this.executeForeground(command, cwd, timeoutMs, logFile, ctx);
        return result;
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      return this.createErrorResult('bash_error', 'bash', err as Error, 'EXECUTION_ERROR');
    }
  }

  private async executeForeground(
    command: string,
    cwd: string,
    timeoutMs: number,
    logFile: string,
    ctx: ExecutionContext,
  ): Promise<ToolResult> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      // Spawn process
      const child = spawn(command, {
        cwd,
        shell: true,
        timeout: timeoutMs,
        signal: ctx.abortSignal,
      });

      // Collect output
      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      // Handle timeout
      const timeoutHandle = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
        setTimeout(() => child.kill('SIGKILL'), 5000); // Force kill after 5s
      }, timeoutMs);

      // Handle completion
      child.on('close', async (code) => {
        clearTimeout(timeoutHandle);
        const duration = Date.now() - startTime;

        // Write full output to log file
        const fullOutput = `Command: ${command}\nExit code: ${code}\nDuration: ${duration}ms\n\n=== STDOUT ===\n${stdout}\n\n=== STDERR ===\n${stderr}`;
        await fs.writeFile(logFile, fullOutput, 'utf-8').catch(() => {});

        // Truncate output for result
        const truncatedStdout = this.truncateOutput(stdout);
        const truncatedStderr = this.truncateOutput(stderr);

        const output = [
          truncatedStdout,
          truncatedStderr ? `\n[stderr]\n${truncatedStderr}` : '',
        ].filter(Boolean).join('');

        const metadata: Record<string, unknown> = {
          command,
          exit_code: code,
          duration_ms: duration,
          timed_out: timedOut,
          log_file: path.relative(ctx.workingDirectory, logFile),
          stdout_truncated: stdout.length > MAX_OUTPUT_SIZE,
          stderr_truncated: stderr.length > MAX_OUTPUT_SIZE,
        };

        if (code === 0 && !timedOut) {
          resolve(this.createSuccessResult('bash_result', 'bash', output || '(no output)', metadata));
        } else if (timedOut) {
          resolve(this.createErrorResult('bash_error', 'bash', `Command timed out after ${timeoutMs}ms`, 'TIMEOUT'));
        } else {
          resolve(this.createErrorResult('bash_error', 'bash', output || `Command failed with exit code ${code}`, 'NON_ZERO_EXIT'));
        }
      });

      child.on('error', (err) => {
        clearTimeout(timeoutHandle);
        resolve(this.createErrorResult('bash_error', 'bash', err, 'SPAWN_ERROR'));
      });
    });
  }

  private async executeBackground(
    command: string,
    cwd: string,
    logFile: string,
    ctx: ExecutionContext,
  ): Promise<ToolResult> {
    // Spawn detached process
    const child = spawn(command, {
      cwd,
      shell: true,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Write output to log file
    const logStream = await fs.open(logFile, 'w');
    await logStream.writeFile(`Command: ${command}\nPID: ${child.pid}\nStarted: ${new Date().toISOString()}\n\n`);

    child.stdout?.on('data', async (data) => {
      await logStream.writeFile(data).catch(() => {});
    });

    child.stderr?.on('data', async (data) => {
      await logStream.writeFile(`[stderr] ${data}`).catch(() => {});
    });

    child.on('close', async (code) => {
      await logStream.writeFile(`\n\nExit code: ${code}\nCompleted: ${new Date().toISOString()}`).catch(() => {});
      await logStream.close().catch(() => {});
    });

    // Unref so parent can exit
    child.unref();

    const metadata: Record<string, unknown> = {
      command,
      pid: child.pid,
      background: true,
      log_file: path.relative(ctx.workingDirectory, logFile),
    };

    return this.createSuccessResult(
      'bash_result',
      'bash',
      `Command started in background (PID: ${child.pid}). Output will be written to ${path.relative(ctx.workingDirectory, logFile)}`,
      metadata,
    );
  }

  private truncateOutput(output: string): string {
    if (output.length <= MAX_OUTPUT_SIZE) {
      return output;
    }
    return output.slice(0, MAX_OUTPUT_SIZE) + `\n\n... (output truncated, ${output.length - MAX_OUTPUT_SIZE} more characters)`;
  }

  private isBlockedCommand(command: string): boolean {
    const normalized = command.trim().toLowerCase();
    for (const blocked of BLOCKED_COMMANDS) {
      if (normalized.includes(blocked.toLowerCase())) {
        return true;
      }
    }
    return false;
  }
}
