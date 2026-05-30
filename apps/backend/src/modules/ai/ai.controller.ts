/**
 * AI Controller
 *
 * Express route handlers for AI proxy endpoints.
 * The controller validates input; the service layer handles provider/model selection
 * from the configured provider registry.
 */

import type { Request, Response, NextFunction } from 'express';
import type { AIProviderId } from '@nirex/shared';
import { aiService } from './ai.service.js';
import { modelRouter } from './ai.module.js';
import { listAllModels, resolveChatModel, resolveEmbedModel } from './config.js';
import { normalizeChunk, normalizeChunkToSSE } from './streaming/stream-normalizer.js';
import { AppError } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

/**
 * GET /api/ai/models
 * List available AI models with capabilities and credit costs.
 */
export async function listModels(_req: Request, res: Response, _next: NextFunction): Promise<void> {
  const models = listAllModels();
  const health = modelRouter.getProviderHealth();

  const modelsWithStatus = models.map((m) => ({
    ...m,
    status: health[m.provider] === 'unhealthy' ? ('unavailable' as const) :
            health[m.provider] === 'degraded' ? ('degraded' as const) :
            ('available' as const),
  }));

  res.json({
    status: 'success',
    data: {
      models: modelsWithStatus,
      provider_health: health,
      circuit_breakers: modelRouter.getCircuitBreakerStats(),
    },
  });
}

/**
 * POST /api/ai/chat
 * Non-streaming chat completion through the AI proxy.
 * Model selection is delegated to the service/router if not specified.
 */
export async function chat(req: Request, res: Response, _next: NextFunction): Promise<void> {
  const { provider, model, system, messages, max_tokens, temperature, top_p, tools, tool_choice, stop, reasoning_effort, metadata } = req.body;
  const resolvedModel = resolveChatModel(provider as AIProviderId | undefined, model);

  const response = await aiService.chat({
    model: resolvedModel,
    system,
    messages,
    max_tokens,
    temperature,
    top_p,
    tools,
    tool_choice,
    stop,
    reasoning_effort,
    metadata: { ...metadata, provider },
  });

  res.json({
    status: 'success',
    data: response,
  });
}

/**
 * POST /api/ai/chat/stream
 * Streaming chat completion via SSE.
 * Model selection is delegated to the service/router if not specified.
 */
export async function chatStream(req: Request, res: Response, _next: NextFunction): Promise<void> {
  const { provider, model, system, messages, max_tokens, temperature, top_p, tools, tool_choice, stop, reasoning_effort, metadata, session_id } = req.body;
  const resolvedModel = resolveChatModel(provider as AIProviderId | undefined, model);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  res.write(normalizeChunkToSSE({
    type: 'metadata' as const,
    sequence: -1,
    model: resolvedModel,
    session_id,
    turn_number: 0,
    timestamp: new Date(),
  }));

  try {
    for await (const chunk of aiService.chatStream({
      model: resolvedModel,
      system,
      messages,
      max_tokens,
      temperature,
      top_p,
      tools,
      tool_choice,
      stop,
      reasoning_effort,
      metadata: { ...metadata, provider },
    })) {
      const resolvedProvider = (chunk as { provider?: string }).provider as string | undefined;
      const event = normalizeChunk(chunk, (resolvedProvider || provider || 'openai') as 'openai' | 'anthropic' | 'google' | 'local');

      if (event.type === 'error') {
        res.write(normalizeChunkToSSE(event));
        break;
      }

      res.write(normalizeChunkToSSE(event));
    }
  } catch (err) {
    logger.error('[AIController] stream error', { error: (err as Error).message });
    res.write(normalizeChunkToSSE({
      type: 'error' as const,
      sequence: 0,
      code: 'STREAM_ERROR',
      message: (err as Error).message,
      retryable: true,
    }));
    res.write(normalizeChunkToSSE({
      type: 'done' as const,
      sequence: 1,
      token_usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
      finish_reason: 'error',
    }));
  } finally {
    res.end();
  }
}

/**
 * POST /api/ai/complete
 * Code completion (non-chat).
 */
export async function complete(req: Request, res: Response, _next: NextFunction): Promise<void> {
  const { model, prompt, suffix, max_tokens, temperature, top_p, stop } = req.body;
  const resolvedModel = resolveChatModel(undefined, model);

  const response = await aiService.complete({
    model: resolvedModel,
    prompt,
    suffix,
    max_tokens,
    temperature,
    top_p,
    stop,
  });

  res.json({
    status: 'success',
    data: response,
  });
}

/**
 * POST /api/ai/embed
 * Generate embeddings. Model is required; validated by schema.
 */
export async function embed(req: Request, res: Response, _next: NextFunction): Promise<void> {
  const { model, input, encoding_format } = req.body;

  if (!input) {
    throw new AppError('Input is required', 400, 'VALIDATION_ERROR');
  }

  const resolvedModel = resolveEmbedModel(model);

  const response = await aiService.embed({
    model: resolvedModel,
    input,
    encoding_format,
  });

  res.json({
    status: 'success',
    data: response,
  });
}

/**
 * GET /api/ai/health
 * Detailed health information about all providers.
 */
export async function health(_req: Request, res: Response, _next: NextFunction): Promise<void> {
  res.json({
    status: 'success',
    data: {
      provider_health: modelRouter.getProviderHealth(),
      circuit_breakers: modelRouter.getCircuitBreakerStats(),
      timestamp: new Date().toISOString(),
    },
  });
}
