/**
 * Tools Service
 *
 * Business logic for tool execution, audit logging, and registry management.
 */

import { Types } from 'mongoose';
import type { ToolResult, ToolRegistration } from '@nirex/shared';
import { toolRegistry } from './tool-registry.js';
import { createExecutionContext, type ExecutionContextOptions } from './execution-context.js';
import { toolExecutionLogRepository } from './audit/tool-execution-log.repository.js';
import { logger } from '../../utils/logger.js';

export class ToolsService {
  /**
   * List all available tools
   */
  listTools(): ToolRegistration[] {
    return toolRegistry.list();
  }

  /**
   * Get tools by category
   */
  getToolsByCategory(category: string): ToolRegistration[] {
    return toolRegistry.listByCategory(category);
  }

  /**
   * Execute a tool with audit logging
   */
  async executeTool(
    toolName: string,
    args: Record<string, unknown>,
    contextOptions: ExecutionContextOptions,
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const ctx = createExecutionContext(contextOptions);

    try {
      logger.info(`[ToolsService] Executing tool: ${toolName}`, {
        toolName,
        userId: ctx.userId,
        sessionId: ctx.sessionId,
      });

      // Execute tool
      const result = await toolRegistry.execute(toolName, args, ctx);
      const duration = Date.now() - startTime;

      // Log execution
      await this.logExecution(
        toolName,
        args,
        result,
        duration,
        ctx,
      );

      logger.info(`[ToolsService] Tool execution completed: ${toolName}`, {
        toolName,
        duration,
        isError: result.is_error,
      });

      return result;
    } catch (err) {
      const duration = Date.now() - startTime;
      const error = err as Error;

      logger.error(`[ToolsService] Tool execution failed: ${toolName}`, {
        toolName,
        error: error.message,
        duration,
      });

      // Log failed execution
      await this.logExecution(
        toolName,
        args,
        {
          id: 'error',
          tool_call_id: toolName,
          content: error.message,
          is_error: true,
          metadata: { error_code: 'EXECUTION_FAILED' },
        },
        duration,
        ctx,
      );

      throw err;
    }
  }

  /**
   * Log tool execution to audit trail
   */
  private async logExecution(
    toolName: string,
    args: Record<string, unknown>,
    result: ToolResult,
    duration: number,
    ctx: ReturnType<typeof createExecutionContext>,
  ): Promise<void> {
    try {
      const executor = toolRegistry.get(toolName);
      if (!executor) return;

      await toolExecutionLogRepository.create({
        user_id: new Types.ObjectId(ctx.userId),
        session_id: new Types.ObjectId(ctx.sessionId),
        tool_name: toolName,
        tool_category: executor.category,
        arguments: args,
        result_summary: result.content.slice(0, 1000), // Truncate for storage
        is_error: result.is_error,
        error_code: result.metadata?.error_code as string | undefined,
        duration_ms: duration,
        working_directory: ctx.workingDirectory,
        sandbox_id: ctx.sandboxId,
        permission_granted: true,
      });
    } catch (err) {
      logger.error('[ToolsService] Failed to log tool execution', {
        error: (err as Error).message,
      });
    }
  }

  /**
   * Get tool execution history for a session
   */
  async getSessionHistory(sessionId: Types.ObjectId, limit = 100) {
    return toolExecutionLogRepository.findBySession(sessionId, { limit });
  }

  /**
   * Get tool execution history for a user
   */
  async getUserHistory(
    userId: Types.ObjectId,
    options: { limit?: number; startDate?: Date; endDate?: Date } = {},
  ) {
    return toolExecutionLogRepository.findByUser(userId, options);
  }
}

export const toolsService = new ToolsService();
