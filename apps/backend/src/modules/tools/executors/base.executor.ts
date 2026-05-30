/**
 * Base Tool Executor
 *
 * Abstract base class for all tool executors. Defines the interface
 * and provides common validation/error handling.
 */

import type { ToolDefinition, ToolResult, ToolCategory } from '@nirex/shared';
import type { ExecutionContext } from '../execution-context.js';
import { AppError } from '../../../types/index.js';

export interface ToolExecutor {
  readonly definition: ToolDefinition;
  readonly category: ToolCategory;
  readonly requiresApproval: boolean;
  readonly isDestructive: boolean;

  execute(args: Record<string, unknown>, ctx: ExecutionContext): Promise<ToolResult>;
  validate?(args: Record<string, unknown>): ValidationResult;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

export abstract class BaseToolExecutor implements ToolExecutor {
  abstract readonly definition: ToolDefinition;
  abstract readonly category: ToolCategory;
  abstract readonly requiresApproval: boolean;
  abstract readonly isDestructive: boolean;

  abstract execute(args: Record<string, unknown>, ctx: ExecutionContext): Promise<ToolResult>;

  validate(args: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];
    const { parameters } = this.definition;

    // Check required parameters
    if (parameters.required) {
      for (const requiredParam of parameters.required) {
        if (!(requiredParam in args)) {
          errors.push(`Missing required parameter: ${requiredParam}`);
        }
      }
    }

    // Basic type checking
    for (const [key, value] of Object.entries(args)) {
      const paramSchema = parameters.properties[key];
      if (!paramSchema) {
        errors.push(`Unknown parameter: ${key}`);
        continue;
      }

      if (paramSchema.type && typeof value !== paramSchema.type && value !== null && value !== undefined) {
        errors.push(`Parameter "${key}" must be of type ${paramSchema.type}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  protected createSuccessResult(id: string, toolCallId: string, content: string, metadata?: Record<string, unknown>): ToolResult {
    return {
      id,
      tool_call_id: toolCallId,
      content,
      is_error: false,
      metadata,
    };
  }

  protected createErrorResult(id: string, toolCallId: string, error: Error | string, code?: string): ToolResult {
    const message = error instanceof Error ? error.message : error;
    return {
      id,
      tool_call_id: toolCallId,
      content: `Error: ${message}`,
      is_error: true,
      metadata: { error_code: code },
    };
  }

  protected assertString(value: unknown, paramName: string): string {
    if (typeof value !== 'string') {
      throw new AppError(`Parameter "${paramName}" must be a string`, 400, 'INVALID_PARAMETER_TYPE');
    }
    return value;
  }

  protected assertNumber(value: unknown, paramName: string): number {
    if (typeof value !== 'number') {
      throw new AppError(`Parameter "${paramName}" must be a number`, 400, 'INVALID_PARAMETER_TYPE');
    }
    return value;
  }

  protected assertBoolean(value: unknown, paramName: string): boolean {
    if (typeof value !== 'boolean') {
      throw new AppError(`Parameter "${paramName}" must be a boolean`, 400, 'INVALID_PARAMETER_TYPE');
    }
    return value;
  }

  protected assertArray(value: unknown, paramName: string): unknown[] {
    if (!Array.isArray(value)) {
      throw new AppError(`Parameter "${paramName}" must be an array`, 400, 'INVALID_PARAMETER_TYPE');
    }
    return value;
  }

  protected assertObject(value: unknown, paramName: string): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new AppError(`Parameter "${paramName}" must be an object`, 400, 'INVALID_PARAMETER_TYPE');
    }
    return value as Record<string, unknown>;
  }
}
