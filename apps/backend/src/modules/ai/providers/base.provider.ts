/**
 * Base AI Provider
 *
 * Abstract class with shared logic for retry, rate limiting, and request
 * transformation that all provider implementations extend.
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
} from '@nirex/shared';
import type { AIProvider } from './provider.interface.js';
import { logger } from '../../../utils/logger.js';

export abstract class BaseProvider implements AIProvider {
  abstract readonly id: AIProviderId;
  abstract readonly name: string;
  abstract readonly models: string[];
  abstract readonly defaultModel: string;

  protected readonly config: ProviderConfig;
  protected apiKey: string | null = null;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  protected getApiKey(): string {
    if (this.apiKey) return this.apiKey;
    const key = process.env[this.config.api_key_env_var];
    if (!key) {
      throw new Error(
        `API key not found for provider "${this.id}". Set ${this.config.api_key_env_var} environment variable.`,
      );
    }
    this.apiKey = key;
    return key;
  }

  abstract chat(request: ChatRequest): Promise<ChatResponse>;
  abstract chatStream(request: ChatRequest): AsyncIterable<UnifiedStreamChunk>;
  abstract complete(request: CompleteRequest): Promise<CompleteResponse>;
  abstract embed(request: EmbedRequest): Promise<EmbedResponse>;
  abstract tokenCount(text: string, model: string): number;
  abstract healthCheck(): Promise<boolean>;

  async listModels(): Promise<string[]> {
    return this.models;
  }

  protected async withRetry<T>(
    operation: () => Promise<T>,
    context: string,
    maxRetries: number = this.config.max_retries,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (!this.isRetryableError(lastError) || attempt === maxRetries) {
          throw lastError;
        }

        const delayMs = Math.min(1000 * Math.pow(2, attempt), 30000);
        logger.warn(`[${this.id}] ${context} attempt ${attempt + 1} failed, retrying in ${delayMs}ms`, {
          error: lastError.message,
        });
        await this.sleep(delayMs);
      }
    }

    throw lastError!;
  }

  protected isRetryableError(error: Error): boolean {
    const msg = error.message.toLowerCase();
    if (msg.includes('429') || msg.includes('rate limit')) return true;
    if (msg.includes('503') || msg.includes('service unavailable')) return true;
    if (msg.includes('502') || msg.includes('bad gateway')) return true;
    if (msg.includes('timeout') || msg.includes('econnreset')) return true;
    if (msg.includes('network') || msg.includes('fetch failed')) return true;
    return false;
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  protected async fetchJson<T>(url: string, options: RequestInit, context: string): Promise<T> {
    const response = await this.withRetry(
      async () => {
        const res = await fetch(url, {
          ...options,
          signal: AbortSignal.timeout(this.config.timeout_ms),
        });

        if (!res.ok) {
          const body = await res.text().catch(() => '');
          throw new Error(
            `[${this.id}] ${context} failed with ${res.status}: ${body.slice(0, 500)}`,
          );
        }

        return res;
      },
      context,
    );

    const data = (await response.json()) as T;
    return data;
  }

  protected async *fetchStream(
    url: string,
    options: RequestInit,
    context: string,
  ): AsyncGenerator<string> {
    const response = await this.withRetry(
      async () => {
        const res = await fetch(url, {
          ...options,
          signal: AbortSignal.timeout(this.config.timeout_ms),
        });

        if (!res.ok) {
          const body = await res.text().catch(() => '');
          throw new Error(
            `[${this.id}] ${context} stream failed with ${res.status}: ${body.slice(0, 500)}`,
          );
        }

        return res;
      },
      context,
      1, // Only retry once for streams
    );

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error(`[${this.id}] ${context}: no readable stream body`);
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          yield line;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
