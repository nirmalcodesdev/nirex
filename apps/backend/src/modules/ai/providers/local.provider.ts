/**
 * Local AI Provider
 *
 * Implements chat via local model servers (Ollama, LM Studio).
 * OpenAI-compatible API assumed at the configured base URL.
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

export class LocalProvider extends BaseProvider {
  readonly id: AIProviderId = 'local';
  readonly name = 'Local AI';
  readonly models: string[];
  readonly defaultModel: string;

  constructor(config: ProviderConfig) {
    super(config);
    this.models = config.models;
    this.defaultModel = config.default_model;
  }

  private get baseUrl(): string {
    return this.config.base_url || 'http://localhost:11434/v1';
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      headers.Authorization = `Bearer ${this.getApiKey()}`;
    } catch {
      // Local may not require auth
    }
    return headers;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const model = request.model;
    logger.debug(`[local] chat request`, { model });

    const data = await this.fetchJson<{
      id: string;
      model: string;
      choices: Array<{
        message: { role: string; content: string };
        finish_reason: string;
      }>;
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    }>(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(this.buildBody(request, false)),
    }, 'chat');

    return {
      id: data.id,
      model: data.model,
      provider: 'local',
      content: data.choices[0]?.message?.content || '',
      role: 'assistant',
      usage: this.normalizeUsage(data.usage),
      finish_reason: data.choices[0]?.finish_reason || 'stop',
      created_at: new Date(),
    };
  }

  async *chatStream(request: ChatRequest): AsyncIterable<UnifiedStreamChunk> {
    let sequence = 0;
    const model = request.model;

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
        body: JSON.stringify(this.buildBody(request, true)),
      },
      'chat/stream',
    );

    for await (const line of generator) {
      if (!line.startsWith('data: ')) continue;
      const dataStr = line.slice(6).trim();
      if (dataStr === '[DONE]') break;

      try {
        const event = JSON.parse(dataStr) as {
          choices?: Array<{
            delta?: { content?: string };
            finish_reason?: string | null;
          }>;
          usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
        };

        const choice = event.choices?.[0];
        if (!choice) continue;

        if (choice.delta?.content) {
          yield {
            type: 'content_delta',
            sequence: sequence++,
            content: choice.delta.content,
          };
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
      provider: 'local',
      text: response.content,
      usage: response.usage,
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
        model: request.model || this.defaultModel,
        input,
      }),
    }, 'embed');

    return {
      model: data.model,
      provider: 'local',
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
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: this.headers(),
        signal: AbortSignal.timeout(this.config.timeout_ms),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private buildBody(request: ChatRequest, stream: boolean): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: request.model,
      messages: [],
      stream,
    };

    if (request.system) {
      body.messages = [{ role: 'system', content: request.system }, ...request.messages.map((m) => ({
        role: m.role,
        content: m.content,
        name: m.name,
        tool_call_id: m.tool_call_id,
        tool_calls: m.tool_calls?.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        })),
      }))];
    } else {
      body.messages = request.messages.map((m) => ({
        role: m.role,
        content: m.content,
        name: m.name,
        tool_call_id: m.tool_call_id,
        tool_calls: m.tool_calls?.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        })),
      }));
    }

    if (request.max_tokens) body.max_tokens = request.max_tokens;
    if (request.temperature !== undefined) body.temperature = request.temperature;
    if (request.stop) body.stop = request.stop;

    return body;
  }

  private normalizeUsage(usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  }): TokenUsage {
    return {
      input_tokens: usage.prompt_tokens,
      output_tokens: usage.completion_tokens,
      total_tokens: usage.total_tokens,
    };
  }
}
