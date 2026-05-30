/**
 * Google AI Provider (Gemini)
 *
 * Implements chat, embedding via the Gemini API.
 * Uses native fetch with SSE streaming support.
 *
 * Gemini API differences:
 * - No system role; system instruction is a separate config field
 * - Tool declarations use function_declarations
 * - Streaming uses server-sent events
 * - Different content block format
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

interface GeminiContentBlock {
  role?: string;
  parts?: Array<{
    text?: string;
    functionCall?: { name: string; args: Record<string, unknown> };
    functionResponse?: { name: string; response: { name: string; content: string } };
    inlineData?: { mimeType: string; data: string };
  }>;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: GeminiContentBlock;
    finishReason?: string;
    index?: number;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
    cachedContentTokenCount?: number;
    thoughtsTokenCount?: number;
  };
  modelVersion?: string;
}

export class GoogleProvider extends BaseProvider {
  readonly id: AIProviderId = 'google';
  readonly name = 'Google AI';
  readonly models: string[];
  readonly defaultModel: string;

  constructor(config: ProviderConfig) {
    super(config);
    this.models = config.models;
    this.defaultModel = config.default_model;
  }

  private get baseUrl(): string {
    return this.config.base_url || 'https://generativelanguage.googleapis.com/v1beta';
  }

  private getApiKeyParam(): string {
    return `?key=${this.getApiKey()}`;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const model = request.model;
    const body = this.buildRequestBody(request);

    logger.debug(`[google] chat request`, { model, messageCount: request.messages.length });

    const data = await this.fetchJson<GeminiResponse>(
      `${this.baseUrl}/models/${model}:generateContent${this.getApiKeyParam()}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      'chat',
    );

    return this.toChatResponse(data, model);
  }

  async *chatStream(request: ChatRequest): AsyncIterable<UnifiedStreamChunk> {
    const model = request.model;
    const body = this.buildRequestBody(request);

    logger.debug(`[google] chat stream request`, { model, messageCount: request.messages.length });

    let sequence = 0;

    yield {
      type: 'metadata',
      sequence: sequence++,
      model,
      timestamp: new Date(),
    };

    const generator = this.fetchStream(
      `${this.baseUrl}/models/${model}:streamGenerateContent?alt=sse&key=${this.getApiKey()}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      'chat/stream',
    );

    let currentToolCall: { id: string; name: string; args: Record<string, unknown> } | null = null;
    let contentBuffer = '';
    let finishReason: string | null = null;

    for await (const line of generator) {
      if (!line.startsWith('data: ')) continue;
      const dataStr = line.slice(6).trim();

      try {
        const event = JSON.parse(dataStr) as GeminiResponse;
        const candidate = event.candidates?.[0];
        if (!candidate) continue;

        const parts = candidate.content?.parts;
        if (!parts) continue;

        for (const part of parts) {
          if (part.text) {
            contentBuffer += part.text;
            yield {
              type: 'content_delta',
              sequence: sequence++,
              content: part.text,
            };
          }

          if (part.functionCall) {
            const tcId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
            currentToolCall = {
              id: tcId,
              name: part.functionCall.name,
              args: part.functionCall.args || {},
            };

            yield {
              type: 'tool_call_start',
              sequence: sequence++,
              id: tcId,
              name: part.functionCall.name,
            };

            yield {
              type: 'tool_call_end',
              sequence: sequence++,
              id: tcId,
              name: part.functionCall.name,
              arguments: currentToolCall.args,
            };
          }
        }

        if (candidate.finishReason) {
          finishReason = candidate.finishReason;
        }

        if (event.usageMetadata) {
          yield {
            type: 'completion',
            sequence: sequence++,
            token_usage: this.normalizeUsage(event.usageMetadata),
            finish_reason: finishReason || 'STOP',
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
      provider: 'google',
      text: response.content,
      usage: response.usage,
    };
  }

  async embed(request: EmbedRequest): Promise<EmbedResponse> {
    const input = Array.isArray(request.input) ? request.input : [request.input];
    const { model } = request;

    const data = await this.fetchJson<{
      embeddings?: Array<{ values: number[] }>;
    }>(
      `${this.baseUrl}/models/${model}:batchEmbedContents${this.getApiKeyParam()}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: input.map((text) => ({
            model: `models/${model}`,
            content: { parts: [{ text }] },
          })),
        }),
      },
      'embed',
    );

    return {
      model,
      provider: 'google',
      embeddings: (data.embeddings || []).map((e) => e.values),
      usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
    };
  }

  tokenCount(text: string, _model: string): number {
    return Math.ceil(text.length / 4);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/models?key=${this.getApiKey()}`,
        {
          method: 'GET',
          signal: AbortSignal.timeout(this.config.timeout_ms),
        },
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private buildRequestBody(request: ChatRequest): Record<string, unknown> {
    const body: Record<string, unknown> = {};

    if (request.system) {
      body.systemInstruction = {
        parts: [{ text: request.system }],
      };
    }

    // Convert messages to Gemini contents format
    const contents: GeminiContentBlock[] = [];

    for (const msg of request.messages) {
      const block: GeminiContentBlock = {
        role: msg.role === 'assistant' ? 'model' : msg.role === 'tool' ? 'function' : 'user',
        parts: [],
      };

      if (typeof msg.content === 'string') {
        block.parts = [{ text: msg.content }];
      } else if (Array.isArray(msg.content)) {
        block.parts = msg.content
          .map((c) => {
            if (c.type === 'text') return { text: c.text };
            if (c.type === 'image_url') {
              return {
                inlineData: {
                  mimeType: this.inferMimeType(c.image_url.url),
                  data: this.extractBase64(c.image_url.url),
                },
              };
            }
            if (c.type === 'tool_use') {
              return {
                functionCall: { name: c.name, args: c.input },
              };
            }
            if (c.type === 'tool_result') {
              return {
                functionResponse: {
                  name: msg.name || 'unknown',
                  response: { name: msg.name || 'unknown', content: c.content },
                },
              };
            }
            return null;
          })
          .filter(Boolean) as GeminiContentBlock['parts'];
      }

      // Handle tool call / result roles
      if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
        block.parts = msg.tool_calls.map((tc) => ({
          functionCall: { name: tc.name, args: tc.arguments },
        }));
      }

      if (msg.role === 'tool') {
        block.role = 'function';
      }

      contents.push(block);
    }

    body.contents = contents;

    if (request.max_tokens) {
      body.generationConfig = {
        ...(body.generationConfig as Record<string, unknown> || {}),
        maxOutputTokens: request.max_tokens,
      };
    }

    if (request.temperature !== undefined) {
      body.generationConfig = {
        ...(body.generationConfig as Record<string, unknown> || {}),
        temperature: request.temperature,
      };
    }

    if (request.top_p !== undefined) {
      body.generationConfig = {
        ...(body.generationConfig as Record<string, unknown> || {}),
        topP: request.top_p,
      };
    }

    if (request.stop && request.stop.length > 0) {
      body.generationConfig = {
        ...(body.generationConfig as Record<string, unknown> || {}),
        stopSequences: request.stop,
      };
    }

    // Tool declarations
    if (request.tools && request.tools.length > 0) {
      body.tools = [
        {
          functionDeclarations: request.tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          })),
        },
      ];
    }

    if (request.tool_choice) {
      if (typeof request.tool_choice === 'string') {
        body.toolConfig = {
          functionCallingConfig: {
            mode: request.tool_choice === 'none' ? 'NONE' : request.tool_choice === 'auto' ? 'AUTO' : 'ANY',
          },
        };
      } else {
        body.toolConfig = {
          functionCallingConfig: {
            mode: 'ANY',
            allowedFunctionNames: [request.tool_choice.function.name],
          },
        };
      }
    }

    return body;
  }

  private toChatResponse(data: GeminiResponse, model: string): ChatResponse {
    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    let content = '';
    const toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }> = [];

    for (const part of parts) {
      if (part.text) content += part.text;
      if (part.functionCall) {
        toolCalls.push({
          id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          name: part.functionCall.name,
          arguments: part.functionCall.args,
        });
      }
    }

    const response: ChatResponse = {
      id: `gemini_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      model,
      provider: 'google',
      content,
      role: 'assistant',
      usage: this.normalizeUsage(data.usageMetadata),
      finish_reason: candidate?.finishReason || 'STOP',
      created_at: new Date(),
    };

    if (toolCalls.length > 0) {
      response.tool_calls = toolCalls;
    }

    return response;
  }

  private normalizeUsage(usage?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
    cachedContentTokenCount?: number;
    thoughtsTokenCount?: number;
  }): TokenUsage {
    if (!usage) {
      return { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
    }

    return {
      input_tokens: usage.promptTokenCount,
      output_tokens: usage.candidatesTokenCount,
      cached_tokens: usage.cachedContentTokenCount,
      reasoning_tokens: usage.thoughtsTokenCount,
      total_tokens: usage.totalTokenCount,
    };
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
