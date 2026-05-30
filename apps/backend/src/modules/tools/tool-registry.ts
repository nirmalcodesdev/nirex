/**
 * Tool Registry
 *
 * Central registry for all tool executors. Provides tool discovery,
 * schema generation for different AI providers, and tool execution.
 */

import type { ToolDefinition, ToolResult, ToolRegistration, AIProviderId } from '@nirex/shared';
import type { ExecutionContext } from './execution-context.js';
import type { ToolExecutor } from './executors/base.executor.js';
import { AppError } from '../../types/index.js';

// Import all executors
import { FileReadExecutor } from './executors/file-read.executor.js';
import { FileWriteExecutor } from './executors/file-write.executor.js';
import { FileEditExecutor } from './executors/file-edit.executor.js';
import { DirectoryListExecutor } from './executors/directory-list.executor.js';
import { FileSearchExecutor } from './executors/file-search.executor.js';
import { ContentSearchExecutor } from './executors/content-search.executor.js';
import { BashExecutor } from './executors/bash.executor.js';
import { GitStatusExecutor } from './executors/git-status.executor.js';
import { GitDiffExecutor } from './executors/git-diff.executor.js';
import { GitLogExecutor } from './executors/git-log.executor.js';
import { GitCommitExecutor } from './executors/git-commit.executor.js';
import { GitBranchExecutor } from './executors/git-branch.executor.js';
import { GitCheckoutExecutor } from './executors/git-checkout.executor.js';
import { WebSearchExecutor } from './executors/web-search.executor.js';
import { WebFetchExecutor } from './executors/web-fetch.executor.js';

export class ToolRegistry {
  private executors: Map<string, ToolExecutor> = new Map();

  constructor() {
    this.registerDefaultTools();
  }

  private registerDefaultTools(): void {
    // File system tools (Tier 1)
    this.register(new FileReadExecutor());
    this.register(new FileWriteExecutor());
    this.register(new FileEditExecutor());
    this.register(new DirectoryListExecutor());
    this.register(new FileSearchExecutor());
    this.register(new ContentSearchExecutor());

    // Bash tool (Tier 1)
    this.register(new BashExecutor());

    // Git tools (Tier 2)
    this.register(new GitStatusExecutor());
    this.register(new GitDiffExecutor());
    this.register(new GitLogExecutor());
    this.register(new GitCommitExecutor());
    this.register(new GitBranchExecutor());
    this.register(new GitCheckoutExecutor());

    // Web tools (Tier 2)
    this.register(new WebSearchExecutor());
    this.register(new WebFetchExecutor());
  }

  register(executor: ToolExecutor): void {
    this.executors.set(executor.definition.name, executor);
  }

  get(name: string): ToolExecutor | undefined {
    return this.executors.get(name);
  }

  list(): ToolRegistration[] {
    return Array.from(this.executors.values()).map((executor) => ({
      definition: executor.definition,
      category: executor.category,
      executor: executor.definition.name,
      requires_approval: executor.requiresApproval,
      is_destructive: executor.isDestructive,
    }));
  }

  listByCategory(category: string): ToolRegistration[] {
    return this.list().filter((reg) => reg.category === category);
  }

  /**
   * Generate tool schemas for a specific AI provider format
   */
  generateSchemas(provider: AIProviderId): ToolDefinition[] {
    const tools = Array.from(this.executors.values()).map((executor) => executor.definition);

    switch (provider) {
      case 'openai':
        return this.toOpenAIFormat(tools);
      case 'anthropic':
        return this.toAnthropicFormat(tools);
      case 'google':
        return this.toGoogleFormat(tools);
      default:
        return tools;
    }
  }

  /**
   * Execute a tool with the given arguments and context
   */
  async execute(
    toolName: string,
    args: Record<string, unknown>,
    ctx: ExecutionContext,
  ): Promise<ToolResult> {
    const executor = this.get(toolName);
    if (!executor) {
      throw new AppError(`Tool not found: ${toolName}`, 404, 'TOOL_NOT_FOUND');
    }

    // Validate arguments
    const validation = executor.validate?.(args);
    if (validation && !validation.valid) {
      throw new AppError(
        `Invalid arguments: ${validation.errors?.join(', ')}`,
        400,
        'INVALID_ARGUMENTS',
      );
    }

    // Check permissions
    if (executor.requiresApproval) {
      const isAllowed = ctx.permissions.allowedTools.has(toolName);
      const isDenied = ctx.permissions.deniedTools.has(toolName);

      if (isDenied) {
        throw new AppError(
          `Tool execution denied by permissions: ${toolName}`,
          403,
          'PERMISSION_DENIED',
        );
      }

      if (!isAllowed && ctx.permissions.defaultAction === 'deny') {
        throw new AppError(
          `Tool requires approval: ${toolName}`,
          403,
          'APPROVAL_REQUIRED',
        );
      }
    }

    // Execute tool
    return executor.execute(args, ctx);
  }

  /**
   * Convert tools to OpenAI function calling format
   */
  private toOpenAIFormat(tools: ToolDefinition[]): ToolDefinition[] {
    // OpenAI uses the standard format, no conversion needed
    return tools;
  }

  /**
   * Convert tools to Anthropic format
   */
  private toAnthropicFormat(tools: ToolDefinition[]): ToolDefinition[] {
    // Anthropic uses the same format as OpenAI for tool definitions
    return tools;
  }

  /**
   * Convert tools to Google Gemini format
   */
  private toGoogleFormat(tools: ToolDefinition[]): ToolDefinition[] {
    // Google uses functionDeclarations, but the schema is compatible
    return tools;
  }
}

// Singleton instance
export const toolRegistry = new ToolRegistry();
