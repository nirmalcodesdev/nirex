/**
 * AI Service
 *
 * Orchestrates provider routing, chat requests, streaming, and caching.
 * This is the primary entry point for the rest of the application to
 * interact with AI providers.
 */

import type {
  ChatRequest,
  ChatResponse,
  CompleteRequest,
  CompleteResponse,
  EmbedRequest,
  EmbedResponse,
  RoutingPreference,
  RoutedModel,
  UnifiedStreamChunk,
  AIProviderId,
} from '@nirex/shared';
import type { AIProvider } from './providers/provider.interface.js';
import { modelRouter } from './ai.module.js';
import { aiCache } from './cache/ai-cache.js';
import { logger } from '../../utils/logger.js';

export class AIService {
  /**
   * Execute a chat request through the optimal provider.
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const routed = modelRouter.route({
      preferred_provider: request.metadata?.provider as AIProviderId | undefined,
      preferred_model: request.model,
    });

    const provider = modelRouter.getProvider(routed.provider_id);
    if (!provider) {
      throw new Error(`Provider ${routed.provider_id} not registered`);
    }

    try {
      const start = Date.now();
      const response = await provider.chat({ ...request, model: routed.model });
      const durationMs = Date.now() - start;

      modelRouter.recordSuccess(routed.provider_id);

      logger.info(`[AIService] chat completed`, {
        provider: routed.provider_id,
        model: routed.model,
        durationMs,
        tokens: response.usage.total_tokens,
      });

      return response;
    } catch (err) {
      modelRouter.recordFailure(routed.provider_id);
      logger.warn(`[AIService] chat failed, attempting failover`, {
        provider: routed.provider_id,
        error: (err as Error).message,
      });

      // Try failover
      const failover = modelRouter.failover(routed.provider_id, request.model);
      const fallbackProvider = modelRouter.getProvider(failover.provider_id);
      if (!fallbackProvider) {
        throw new Error(`Failover provider ${failover.provider_id} not available: ${(err as Error).message}`);
      }

      const response = await fallbackProvider.chat({ ...request, model: failover.model });
      modelRouter.recordSuccess(failover.provider_id);
      return response;
    }
  }

  /**
   * Stream a chat request through the optimal provider.
   */
  async *chatStream(request: ChatRequest): AsyncIterable<UnifiedStreamChunk> {
    const routed = modelRouter.route({
      preferred_provider: request.metadata?.provider as AIProviderId | undefined,
      preferred_model: request.model,
    });

    const provider = modelRouter.getProvider(routed.provider_id);
    if (!provider) {
      yield {
        type: 'error',
        sequence: 0,
        code: 'NO_PROVIDER',
        message: `Provider ${routed.provider_id} not registered`,
        retryable: false,
      };
      return;
    }

    try {
      for await (const chunk of provider.chatStream({ ...request, model: routed.model })) {
        yield chunk;
      }
      modelRouter.recordSuccess(routed.provider_id);
    } catch (err) {
      modelRouter.recordFailure(routed.provider_id);
      yield {
        type: 'error',
        sequence: 0,
        code: 'PROVIDER_ERROR',
        message: `${routed.provider_id} error: ${(err as Error).message}`,
        retryable: true,
      };
    }
  }

  /**
   * Execute a completion request.
   */
  async complete(request: CompleteRequest): Promise<CompleteResponse> {
    const routed = modelRouter.route({ preferred_model: request.model });
    const provider = modelRouter.getProvider(routed.provider_id);
    if (!provider) throw new Error(`No provider available`);

    return provider.complete({ ...request, model: routed.model });
  }

  /**
   * Execute an embedding request with caching.
   */
  async embed(request: EmbedRequest): Promise<EmbedResponse> {
    const input = Array.isArray(request.input) ? request.input : [request.input];
    const { model } = request;

    // Check cache for each input
    const embeddings: number[][] = [];
    const uncachedInputs: string[] = [];
    const uncachedIndices: number[] = [];

    for (let i = 0; i < input.length; i++) {
      const text = input[i]!;
      const cached = await aiCache.getEmbedding(model, text);
      if (cached) {
        embeddings[i] = cached;
      } else {
        uncachedInputs.push(text);
        uncachedIndices.push(i);
      }
    }

    // Fetch uncached embeddings
    if (uncachedInputs.length > 0) {
      const embedProviderId = (
        ['openai', 'google', 'anthropic', 'local'] as AIProviderId[]
      ).find((id) => {
        const p = modelRouter.getProvider(id);
        return p && modelRouter.getCircuitBreaker(id)?.isOpen === false;
      }) || 'openai';

      const embedProvider = modelRouter.getProvider(embedProviderId);
      if (!embedProvider) throw new Error('No embedding-capable provider available');

      const response = await embedProvider.embed({
        model,
        input: uncachedInputs,
        encoding_format: request.encoding_format,
      });

      // Cache and assign
      for (let i = 0; i < uncachedInputs.length; i++) {
        const embedding = response.embeddings[i];
        const targetIndex = uncachedIndices[i];
        const inputText = uncachedInputs[i]!;
        if (embedding && targetIndex !== undefined) {
          embeddings[targetIndex] = embedding;
          await aiCache.setEmbedding(model, inputText, embedding).catch(() => {});
        }
      }

      return { ...response, embeddings };
    }

    const routed = modelRouter.route({ preferred_model: model });
    return {
      model,
      provider: routed.provider_id,
      embeddings,
      usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
    };
  }
}

export const aiService = new AIService();
