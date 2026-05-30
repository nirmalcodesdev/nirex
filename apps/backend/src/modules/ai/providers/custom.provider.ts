/**
 * Custom AI Provider
 *
 * OpenAI-compatible provider for user-supplied API endpoints.
 * Supports any service with an OpenAI-compatible chat/completions API:
 * OpenRouter, Together AI, Groq, DeepSeek, self-hosted vLLM, etc.
 *
 * Configure via environment variables:
 *   CUSTOM_AI_BASE_URL       — API base URL (default: http://localhost:11434/v1)
 *   CUSTOM_AI_API_KEY        — API key
 *   CUSTOM_AI_DEFAULT_MODEL  — Default model name
 *   CUSTOM_AI_MODELS         — Comma-separated model list
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

export class CustomProvider extends BaseProvider {
  readonly id: AIProviderId = 'custom';
  readonly name = 'Custom';
  readonly models: string[];
  readonly defaultModel: string;

  private configuredBaseUrl: string;

  constructor(config: ProviderConfig) {
    super(config);
    this.models = config.models;
    this.defaultModel = config.default_model;
    this.configuredBaseUrl = config.base_url || process.env.CUSTOM_AI_BASE_URL || 'http://localhost:11434/v1';
  }

  private get baseUrl(): string {
    return this.configuredBaseUrl;
  }

  private authHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      headers.Authorization = `Bearer ${this.getApiKey()}`;
    } catch {
      // Custom may not require auth
    }
    return headers;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    logger.debug(`[custom] chat request`, { model: request.model, baseUrl: this.baseUrl });

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
      headers: this.authHeaders(),
      body: JSON.stringify(this.buildBody(request, false)),
    }, 'chat');

    return {
      id: data.id,
      model: data.model,
      provider: 'custom',
      content: data.choices[0]?.message?.content || '',
      role: 'assistant',
      usage: this.normalizeUsage(data.usage),
      finish_reason: data.choices[0]?.finish_reason || 'stop',
      created_at: new Date(),
    };
  }

  async *chatStream(request: ChatRequest): AsyncIterable<UnifiedStreamChunk> {
    let sequence = 0;
    const { model } = request;

    logger.debug(`[custom] chat stream request`, { model, baseUrl: this.baseUrl });

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
        headers: this.authHeaders(),
        body: JSON.stringify(this.buildBody(request, true)),
      },
      'chat/stream',
    );

    for await (const line of generator) {
      if (!line.startsWith('data: ')) continue;
      const dataStr = line.slice(6).trim();
      if (dataStr === '[DONE]') {
        yield { type: 'completion', sequence: sequence++, finish_reason: 'stop' };
        break;
      }

      try {
        const event = JSON.parse(dataStr) as {
          choices?: Array<{
            delta?: { content?: string; role?: string };
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
    const response = await this.chat({
      model: request.model,
      messages: [{ role: 'user', content: request.prompt }],
      max_tokens: request.max_tokens || 1024,
      temperature: request.temperature,
      stop: request.stop,
    });
    return {
      id: response.id,
      model: response.model,
      provider: 'custom',
      text: response.content,
      usage: response.usage,
    };
  }

  async embed(request: EmbedRequest): Promise<EmbedResponse> {
    const input = Array.isArray(request.input) ? request.input : [request.input];
    try {
      const data = await this.fetchJson<{
        model: string;
        data: Array<{ embedding: number[] }>;
        usage: { prompt_tokens: number; total_tokens: number };
      }>(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: this.authHeaders(),
        body: JSON.stringify({ model: request.model, input }),
      }, 'embed');

      return {
        model: data.model,
        provider: 'custom',
        embeddings: data.data.map((d) => d.embedding),
        usage: {
          input_tokens: data.usage.prompt_tokens,
          output_tokens: 0,
          total_tokens: data.usage.total_tokens,
        },
      };
    } catch {
      logger.warn('[custom] embed failed, returning empty');
      return {
        model: request.model,
        provider: 'custom',
        embeddings: input.map(() => []),
        usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
      };
    }
  }

  tokenCount(text: string, _model: string): number {
    return Math.ceil(text.length / 4);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: this.authHeaders(),
        signal: AbortSignal.timeout(this.config.timeout_ms),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private buildBody(request: ChatRequest, stream: boolean): Record<string, unknown> {
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
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));
    }

    return body;
  }

  private buildMessages(request: ChatRequest): Array<Record<string, unknown>> {
    const messages: Array<Record<string, unknown>> = [];

    if (request.system) {
      messages.push({ role: 'system', content: request.system });
    }

    for (const msg of request.messages) {
      messages.push({
        role: msg.role,
        content: msg.content,
        name: msg.name,
        tool_call_id: msg.tool_call_id,
      });
    }

    return messages;
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
