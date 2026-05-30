/**
 * Anthropic Provider
 *
 * Implements chat, completion, embedding via the Anthropic Messages API.
 * Uses native fetch with SSE streaming support.
 *
 * Anthropic API differences:
 * - No system role in messages array; system is a top-level field
 * - Tool use is content blocks, not top-level tool_calls
 * - Uses cache_control for prompt caching
 */

import type {
  ChatRequest,
  ChatResponse,
  CompleteRequest,
  CompleteResponse,
  EmbedRequest,
  EmbedResponse,
  AIProviderId,
  UnifiedStreamChunk,
  ProviderConfig,
  TokenUsage,
} from '@nirex/shared';
import { BaseProvider } from './base.provider.js';
import { logger } from '../../../utils/logger.js';

interface AnthropicContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  content?: string | AnthropicContentBlock[];
  tool_use_id?: string;
  is_error?: boolean;
  thinking?: string;
  signature?: string;
}

interface AnthropicMessageResponse {
  id: string;
  model: string;
  content: AnthropicContentBlock[];
  role: string;
  stop_reason: string | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

interface AnthropicSSEEvent {
  type: string;
  index?: number;
  content_block?: AnthropicContentBlock;
  delta?: {
    type: string;
    text?: string;
    partial_json?: string;
    thinking?: string;
    signature?: string;
  };
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  message?: {
    id: string;
    model: string;
    stop_reason: string | null;
    usage: {
      input_tokens: number;
      output_tokens: number;
    };
  };
}

export class AnthropicProvider extends BaseProvider {
  readonly id: AIProviderId = 'anthropic';
  readonly name = 'Anthropic';
  readonly models: string[];
  readonly defaultModel: string;

  private apiVersion = '2023-06-01';

  constructor(config: ProviderConfig) {
    super(config);
    this.models = config.models;
    this.defaultModel = config.default_model;
  }

  private get baseUrl(): string {
    return this.config.base_url || 'https://api.anthropic.com/v1';
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.getApiKey(),
      'anthropic-version': this.apiVersion,
    };
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const model = request.model;
    const body = this.buildMessageBody(request, false);

    logger.debug(`[anthropic] chat request`, { model, messageCount: request.messages.length });

    const data = await this.fetchJson<AnthropicMessageResponse>(
      `${this.baseUrl}/messages`,
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
      },
      'chat',
    );

    return this.toChatResponse(data);
  }

  async *chatStream(request: ChatRequest): AsyncIterable<UnifiedStreamChunk> {
    const model = request.model;
    const body = this.buildMessageBody(request, true);

    logger.debug(`[anthropic] chat stream request`, { model, messageCount: request.messages.length });

    let sequence = 0;

    yield {
      type: 'metadata',
      sequence: sequence++,
      model,
      timestamp: new Date(),
    };

    const generator = this.fetchStream(
      `${this.baseUrl}/messages`,
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
      },
      'chat/stream',
    );

    let currentToolId: string | null = null;
    let currentToolName: string | null = null;
    let currentToolInput: string | null = null;

    for await (const line of generator) {
      if (!line.startsWith('data: ')) continue;
      const dataStr = line.slice(6).trim();

      try {
        const event = JSON.parse(dataStr) as AnthropicSSEEvent;

        switch (event.type) {
          case 'message_start': {
            if (event.message) {
              yield {
                type: 'metadata',
                sequence: sequence++,
                model: event.message.model,
              };
            }
            break;
          }

          case 'content_block_start': {
            const block = event.content_block;
            if (!block) break;

            if (block.type === 'tool_use') {
              currentToolId = block.id || null;
              currentToolName = block.name || null;
              currentToolInput = '';

              yield {
                type: 'tool_call_start',
                sequence: sequence++,
                id: currentToolId!,
                name: currentToolName!,
              };
            } else if (block.type === 'thinking') {
              yield {
                type: 'reasoning_start',
                sequence: sequence++,
                content: block.thinking || '',
              };
            }
            break;
          }

          case 'content_block_delta': {
            const delta = event.delta;
            if (!delta) break;

            if (delta.type === 'text_delta' && delta.text) {
              yield {
                type: 'content_delta',
                sequence: sequence++,
                content: delta.text,
              };
            } else if (delta.type === 'input_json_delta' && delta.partial_json) {
              currentToolInput = (currentToolInput || '') + delta.partial_json;
              yield {
                type: 'tool_call_delta',
                sequence: sequence++,
                id: currentToolId!,
                arguments_delta: delta.partial_json,
              };
            } else if (delta.type === 'thinking_delta' && delta.thinking) {
              yield {
                type: 'reasoning_step',
                sequence: sequence++,
                content: delta.thinking,
              };
            }
            break;
          }

          case 'content_block_stop': {
            if (currentToolId && currentToolName) {
              yield {
                type: 'tool_call_end',
                sequence: sequence++,
                id: currentToolId,
                name: currentToolName,
                arguments: this.safeParseJson(currentToolInput || '{}'),
              };
              currentToolId = null;
              currentToolName = null;
              currentToolInput = null;
            }
            break;
          }

          case 'message_delta': {
            if (event.usage) {
              yield {
                type: 'completion',
                sequence: sequence++,
                token_usage: this.normalizeUsage(event.usage),
                finish_reason: event.delta?.type === 'tool_use' ? 'tool_calls' : 'stop',
              };
            }
            break;
          }

          case 'message_stop': {
            break;
          }
        }
      } catch {
        // Skip malformed SSE lines
      }
    }
  }

  async complete(request: CompleteRequest): Promise<CompleteResponse> {
    // Anthropic doesn't have a dedicated completion API.
    // We simulate it via the messages API.
    const chatReq: ChatRequest = {
      model: request.model,
      messages: [{ role: 'user', content: request.prompt }],
      max_tokens: request.max_tokens || 1024,
      temperature: request.temperature,
      stop: request.stop,
    };

    const response = await this.chat(chatReq);
    return {
      id: response.id,
      model: response.model,
      provider: 'anthropic',
      text: response.content,
      usage: response.usage,
    };
  }

  async embed(request: EmbedRequest): Promise<EmbedResponse> {
    // Anthropic doesn't have a native embedding API.
    // Return empty embeddings rather than erroring.
    logger.warn('[anthropic] embed called but Anthropic has no embedding API');
    const input = Array.isArray(request.input) ? request.input : [request.input];
    return {
      model: request.model,
      provider: 'anthropic',
      embeddings: input.map(() => []),
      usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
    };
  }

  tokenCount(text: string, _model: string): number {
    return Math.ceil(text.length / 4);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          model: this.defaultModel,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        }),
        signal: AbortSignal.timeout(this.config.timeout_ms),
      });
      return response.ok || response.status === 400; // 400 = valid auth, invalid request
    } catch {
      return false;
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private buildMessageBody(request: ChatRequest, stream: boolean): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: request.model,
      max_tokens: request.max_tokens || 4096,
      messages: this.buildMessagesContent(request),
      stream,
    };

    if (request.system) {
      body.system = request.system;
    }

    if (request.temperature !== undefined) body.temperature = request.temperature;
    if (request.top_p !== undefined) body.top_p = request.top_p;
    if (request.stop) body.stop_sequences = request.stop;

    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));
    }

    if (request.tool_choice) {
      if (typeof request.tool_choice === 'object' && 'function' in request.tool_choice) {
        body.tool_choice = { type: 'tool', name: request.tool_choice.function.name };
      } else {
        body.tool_choice = { type: request.tool_choice };
      }
    }

    return body;
  }

  private buildMessagesContent(request: ChatRequest): Array<Record<string, unknown>> {
    const messages: Array<Record<string, unknown>> = [];

    for (const msg of request.messages) {
      const built: Record<string, unknown> = {
        role: msg.role === 'system' ? 'user' : msg.role,
      };

      if (typeof msg.content === 'string') {
        built.content = msg.content;
      } else if (Array.isArray(msg.content)) {
        built.content = msg.content.map((block) => {
          if (block.type === 'text') return { type: 'text', text: block.text };
          if (block.type === 'image_url') {
            return {
              type: 'image',
              source: {
                type: 'base64',
                media_type: this.inferMimeType(block.image_url.url),
                data: this.extractBase64(block.image_url.url),
              },
            };
          }
          if (block.type === 'tool_use') {
            return { type: 'tool_use', id: block.id, name: block.name, input: block.input };
          }
          if (block.type === 'tool_result') {
            return {
              type: 'tool_result',
              tool_use_id: block.tool_use_id,
              content: block.content,
              is_error: block.is_error,
            };
          }
          return block;
        });
      }

      messages.push(built);
    }

    return messages;
  }

  private toChatResponse(data: AnthropicMessageResponse): ChatResponse {
    const textBlocks = data.content.filter((b) => b.type === 'text');
    const toolBlocks = data.content.filter((b) => b.type === 'tool_use');

    const content = textBlocks.map((b) => b.text || '').join('');

    const response: ChatResponse = {
      id: data.id,
      model: data.model,
      provider: 'anthropic',
      content,
      role: 'assistant',
      usage: this.normalizeUsage(data.usage),
      finish_reason: data.stop_reason || 'stop',
      created_at: new Date(),
    };

    if (toolBlocks.length > 0) {
      response.tool_calls = toolBlocks.map((b) => ({
        id: b.id!,
        name: b.name!,
        arguments: b.input || {},
      }));
    }

    return response;
  }

  private normalizeUsage(usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  }): TokenUsage {
    return {
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cached_tokens: (usage.cache_creation_input_tokens || 0) + (usage.cache_read_input_tokens || 0),
      total_tokens: usage.input_tokens + usage.output_tokens,
    };
  }

  private safeParseJson(str: string): Record<string, unknown> {
    try {
      return JSON.parse(str) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private inferMimeType(dataUrl: string): string {
    const match = /data:(image\/\w+);/.exec(dataUrl);
    return match?.[1] ?? 'image/png';
  }

  private extractBase64(dataUrl: string): string {
    const comma = dataUrl.indexOf(',');
    return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  }
}
