/**
 * AI Cache Service
 *
 * Redis-backed caching layer for AI provider responses.
 * Includes:
 * - Embedding cache (TTL: 7 days by default)
 * - Tool output cache (configurable TTL)
 * - Chat response prefix cache
 *
 * Uses the existing Redis client from config/redis.ts.
 * Falls back to no-op if Redis is unavailable.
 */

import { createHash } from 'crypto';
import { getRedisClient, isRedisAvailable } from '../../../config/redis.js';
import { logger } from '../../../utils/logger.js';

const CACHE_PREFIX = 'ai:cache:' as const;

const DEFAULT_TTL = {
  embedding: 7 * 24 * 60 * 60, // 7 days in seconds
  toolOutput: 5 * 60, // 5 minutes
  chatPrefix: 60 * 60, // 1 hour
} as const;

function cacheKey(namespace: string, hash: string): string {
  return `${CACHE_PREFIX}${namespace}:${hash}`;
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export const aiCache = {
  async getEmbedding(model: string, text: string): Promise<number[] | null> {
    if (!isRedisAvailable()) return null;

    const key = cacheKey('embeddings', sha256(`${model}:${text}`));
    try {
      const cached = await getRedisClient().get(key);
      if (cached) {
        return JSON.parse(cached) as number[];
      }
    } catch (err) {
      logger.warn('Failed to read embedding cache', { error: (err as Error).message });
    }
    return null;
  },

  async setEmbedding(model: string, text: string, embedding: number[], ttl?: number): Promise<void> {
    if (!isRedisAvailable()) return;

    const key = cacheKey('embeddings', sha256(`${model}:${text}`));
    try {
      await getRedisClient().set(
        key,
        JSON.stringify(embedding),
        'EX',
        ttl ?? DEFAULT_TTL.embedding,
      );
    } catch (err) {
      logger.warn('Failed to write embedding cache', { error: (err as Error).message });
    }
  },

  async getToolOutput(toolName: string, args: Record<string, unknown>): Promise<string | null> {
    if (!isRedisAvailable()) return null;

    const key = cacheKey('tool-output', sha256(`${toolName}:${JSON.stringify(args)}`));
    try {
      return await getRedisClient().get(key);
    } catch (err) {
      logger.warn('Failed to read tool output cache', { error: (err as Error).message });
    }
    return null;
  },

  async setToolOutput(
    toolName: string,
    args: Record<string, unknown>,
    output: string,
    ttl?: number,
  ): Promise<void> {
    if (!isRedisAvailable()) return;

    const key = cacheKey('tool-output', sha256(`${toolName}:${JSON.stringify(args)}`));
    try {
      await getRedisClient().set(
        key,
        output,
        'EX',
        ttl ?? DEFAULT_TTL.toolOutput,
      );
    } catch (err) {
      logger.warn('Failed to write tool output cache', { error: (err as Error).message });
    }
  },

  async getChatPrefix(
    provider: string,
    model: string,
    messagesHash: string,
  ): Promise<unknown | null> {
    if (!isRedisAvailable()) return null;

    const key = cacheKey('chat-prefix', sha256(`${provider}:${model}:${messagesHash}`));
    try {
      const cached = await getRedisClient().get(key);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      logger.warn('Failed to read chat prefix cache', { error: (err as Error).message });
    }
    return null;
  },

  async setChatPrefix(
    provider: string,
    model: string,
    messagesHash: string,
    response: unknown,
    ttl?: number,
  ): Promise<void> {
    if (!isRedisAvailable()) return;

    const key = cacheKey('chat-prefix', sha256(`${provider}:${model}:${messagesHash}`));
    try {
      await getRedisClient().set(
        key,
        JSON.stringify(response),
        'EX',
        ttl ?? DEFAULT_TTL.chatPrefix,
      );
    } catch (err) {
      logger.warn('Failed to write chat prefix cache', { error: (err as Error).message });
    }
  },

  async invalidateNamespace(namespace: string): Promise<void> {
    if (!isRedisAvailable()) return;

    const pattern = `${CACHE_PREFIX}${namespace}:*`;
    try {
      const redis = getRedisClient();
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (err) {
      logger.warn('Failed to invalidate cache namespace', {
        namespace,
        error: (err as Error).message,
      });
    }
  },

  async flushAll(): Promise<void> {
    if (!isRedisAvailable()) return;

    const pattern = `${CACHE_PREFIX}*`;
    try {
      const redis = getRedisClient();
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      logger.info('AI cache flushed');
    } catch (err) {
      logger.warn('Failed to flush AI cache', { error: (err as Error).message });
    }
  },
};
