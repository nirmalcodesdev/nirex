/**
 * OpenAI Provider
 *
 * Implements chat, completion, embedding via the OpenAI REST API.
 * Uses native fetch (Node 18+) with SSE streaming support.
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
  ProviderMessage,
  ToolCall,
} from '@nirex/shared';
import { BaseProvider } from './base.provider.js';
import { logger } from '../../../utils/logger.js';

export class OpenAIProvider extends BaseProvider {
  readonly id: AIProviderId = 'openai';
  readonly name = 'OpenAI';
  readonly models: string[];
  readonly defaultModel: string;

  constructor(config: ProviderConfig) {
    super(config);
    this.models = config.models;
    this.defaultModel = config.default_model;
  }

  private get baseUrl(): string {
    return this.config.base_url || 'https://api.openai.com/v1';
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.getApiKey()}`,
    };
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const model = request.model;
    const body = this.buildChatBody(request, false);

    logger.debug(`[openai] chat request`, { model, messageCount: request.messages.length });

    const data = await this.fetchJson<{
      id: string;
      model: string;
      choices: Array<{
        message: {
          role: string;
          content: string | null;
          tool_calls?: Array<{
            id: string;
            type: 'function';
            function: { name: string; arguments: string };
          }>;
        };
        finish_reason: string;
      }>;
      usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
        prompt_tokens_details?: { cached_tokens?: number };
        completion_tokens_details?: { reasoning_tokens?: number };
      };
    }>(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    }, 'chat');

    const choice = data.choices[0];
    if (!choice) {
      throw new Error('[openai] chat returned empty choices');
    }

    const message = choice.message;

    const chatResponse: ChatResponse = {
      id: data.id,
      model: data.model,
      provider: 'openai',
      content: message.content || '',
      role: 'assistant',
      usage: this.normalizeUsage(data.usage),
      finish_reason: choice.finish_reason,
      created_at: new Date(),
    };

    if (message.tool_calls && message.tool_calls.length > 0) {
      chatResponse.tool_calls = message.tool_calls.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: this.safeParseJson(tc.function.arguments),
      }));
    }

    return chatResponse;
  }

  async *chatStream(request: ChatRequest): AsyncIterable<UnifiedStreamChunk> {
    const model = request.model;
    const body = this.buildChatBody(request, true);

    logger.debug(`[openai] chat stream request`, { model, messageCount: request.messages.length });

    let sequence = 0;

    yield {
      type: 'metadata',
      sequence: sequence++,
      model,
      timestamp: new Date(),
    };

    const generator = this.fetchStream(
      `${this.baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
      },
      'chat/stream',
    );

    let currentToolCall: { id: string; name: string; argumentsBuffer: string } | null = null;

    for await (const line of generator) {
      if (!line.startsWith('data: ')) continue;
      const dataStr = line.slice(6).trim();
      if (dataStr === '[DONE]') {
        yield {
          type: 'completion',
          sequence: sequence++,
          finish_reason: 'stop',
        };
        break;
      }

      try {
        const event = JSON.parse(dataStr) as {
          choices?: Array<{
            delta?: {
              content?: string;
              tool_calls?: Array<{
                index: number;
                id?: string;
                type?: 'function';
                function?: { name?: string; arguments?: string };
              }>;
            };
            finish_reason?: string | null;
          }>;
          usage?: {
            prompt_tokens: number;
            completion_tokens: number;
            total_tokens: number;
            prompt_tokens_details?: { cached_tokens?: number };
            completion_tokens_details?: { reasoning_tokens?: number };
          };
        };

        const choice = event.choices?.[0];
        if (!choice) continue;

        const delta = choice.delta;

        if (delta?.content) {
          yield {
            type: 'content_delta',
            sequence: sequence++,
            content: delta.content,
          };
        }

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (tc.id) {
              if (currentToolCall) {
                yield {
                  type: 'tool_call_end',
                  sequence: sequence++,
                  id: currentToolCall.id,
                  name: currentToolCall.name,
                  arguments: this.safeParseJson(currentToolCall.argumentsBuffer),
                };
              }

              currentToolCall = {
                id: tc.id,
                name: tc.function?.name || '',
                argumentsBuffer: '',
              };

              yield {
                type: 'tool_call_start',
                sequence: sequence++,
                id: currentToolCall.id,
                name: currentToolCall.name,
              };
            }

            if (tc.function?.arguments && currentToolCall) {
              currentToolCall.argumentsBuffer += tc.function.arguments;
              yield {
                type: 'tool_call_delta',
                sequence: sequence++,
                id: currentToolCall.id,
                arguments_delta: tc.function.arguments,
              };
            }
          }
        }

        if (choice.finish_reason && currentToolCall) {
          yield {
            type: 'tool_call_end',
            sequence: sequence++,
            id: currentToolCall.id,
            name: currentToolCall.name,
            arguments: this.safeParseJson(currentToolCall.argumentsBuffer),
          };
          currentToolCall = null;
        }

        if (choice.finish_reason && event.usage) {
          yield {
            type: 'completion',
            sequence: sequence++,
            token_usage: this.normalizeUsage(event.usage),
            finish_reason: choice.finish_reason,
          };
        }
      } catch {
        // Skip malformed SSE lines
      }
    }
  }

  async complete(request: CompleteRequest): Promise<CompleteResponse> {
    const data = await this.fetchJson<{
      id: string;
      model: string;
      choices: Array<{ text: string }>;
      usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      };
    }>(`${this.baseUrl}/completions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model: request.model,
        prompt: request.prompt,
        suffix: request.suffix,
        max_tokens: request.max_tokens,
        temperature: request.temperature,
        top_p: request.top_p,
        stop: request.stop,
      }),
    }, 'complete');

    return {
      id: data.id,
      model: data.model,
      provider: 'openai',
      text: data.choices[0]?.text || '',
      usage: this.normalizeUsage(data.usage),
    };
  }

  async embed(request: EmbedRequest): Promise<EmbedResponse> {
    const input = Array.isArray(request.input) ? request.input : [request.input];

    const data = await this.fetchJson<{
      model: string;
      data: Array<{ embedding: number[] }>;
      usage: { prompt_tokens: number; total_tokens: number };
    }>(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model: request.model,
        input,
        encoding_format: request.encoding_format || 'float',
      }),
    }, 'embed');

    return {
      model: data.model,
      provider: 'openai',
      embeddings: data.data.map((d) => d.embedding),
      usage: {
        input_tokens: data.usage.prompt_tokens,
        output_tokens: 0,
        total_tokens: data.usage.total_tokens,
      },
    };
  }

  tokenCount(text: string, _model: string): number {
    return Math.ceil(text.length / 4);
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.fetchJson<{ data: Array<unknown> }>(
        `${this.baseUrl}/models`,
        {
          method: 'GET',
          headers: this.headers(),
        },
        'healthCheck',
      );
      return true;
    } catch {
      return false;
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private buildChatBody(request: ChatRequest, stream: boolean): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: request.model,
      messages: this.buildMessages(request),
      stream,
    };

    if (request.max_tokens) body.max_tokens = request.max_tokens;
    if (request.temperature !== undefined) body.temperature = request.temperature;
    if (request.top_p !== undefined) body.top_p = request.top_p;
    if (request.stop) body.stop = request.stop;

    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
    }

    if (request.tool_choice) {
      body.tool_choice = request.tool_choice;
    }

    if (request.reasoning_effort) {
      body.reasoning_effort = request.reasoning_effort;
    }

    return body;
  }

  private buildMessages(request: ChatRequest): Array<Record<string, unknown>> {
    const messages: Array<Record<string, unknown>> = [];

    if (request.system) {
      messages.push({ role: 'system', content: request.system });
    }

    for (const msg of request.messages) {
      const built: Record<string, unknown> = {
        role: msg.role,
        content: msg.content,
      };

      if (msg.name) built.name = msg.name;
      if (msg.tool_call_id) built.tool_call_id = msg.tool_call_id;

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        built.tool_calls = msg.tool_calls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        }));
      }

      messages.push(built);
    }

    return messages;
  }

  private normalizeUsage(usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    prompt_tokens_details?: { cached_tokens?: number };
    completion_tokens_details?: { reasoning_tokens?: number };
  }): TokenUsage {
    return {
      input_tokens: usage.prompt_tokens,
      output_tokens: usage.completion_tokens,
      cached_tokens: usage.prompt_tokens_details?.cached_tokens,
      reasoning_tokens: usage.completion_tokens_details?.reasoning_tokens,
      total_tokens: usage.total_tokens,
    };
  }

  private safeParseJson(str: string): Record<string, unknown> {
    try {
      return JSON.parse(str) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
}
