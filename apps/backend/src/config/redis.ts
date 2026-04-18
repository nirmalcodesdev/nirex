import { Redis } from 'ioredis';
import type { Redis as RedisType } from 'ioredis';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

let _client: RedisType | null = null;
let _redisAvailable = false;

export function isRedisAvailable(): boolean {
  return _redisAvailable;
}

// Returns the singleton Redis client, creating it on first call.
// Using a singleton ensures connection limits are respected and avoids
// the overhead of creating a new connection per request.
export function getRedisClient(): RedisType {
  if (!_client) {
    throw new Error('Redis client not initialized. Call connectRedis() first.');
  }
  return _client;
}

export async function connectRedis(): Promise<void> {
  if (_client) {
    return; // Already connected
  }

  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    lazyConnect: true,
    retryStrategy: () => null, // Don't retry - fail fast
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      client.disconnect();
      reject(new Error('Redis connection timeout'));
    }, 5000);

    client.once('connect', () => {
      clearTimeout(timeout);
      _client = client;
      _redisAvailable = true;
      logger.info('Redis connected');
      resolve();
    });

    client.once('error', (err) => {
      clearTimeout(timeout);
      client.disconnect();
      reject(err);
    });

    // Start connection
    client.connect().catch((err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

export async function disconnectRedis(): Promise<void> {
  if (_client) {
    try {
      await _client.quit();
    } catch {
      // Ignore disconnect errors
    }
    _client = null;
    _redisAvailable = false;
    logger.info('Redis disconnected (graceful shutdown)');
  }
}
