import { Types } from 'mongoose';
import type { UsageOverviewResponse, UsageRange } from '@nirex/shared';
import { getRedisClient, isRedisAvailable } from '../../config/redis.js';

export const USAGE_OVERVIEW_CACHE_PREFIX = 'usage:overview';
export const USAGE_OVERVIEW_CACHE_TTL_SECONDS = 120;
export const USAGE_OVERVIEW_RANGES: UsageRange[] = ['30d', '90d', 'month_to_date'];

const inMemoryCache = new Map<
  string,
  { expiresAt: number; value: UsageOverviewResponse }
>();

const OVERVIEW_IN_MEMORY_CACHE_MAX_ENTRIES = 5000;

export function usageOverviewCacheKey(
  userId: Types.ObjectId | string,
  range: UsageRange,
): string {
  return `${USAGE_OVERVIEW_CACHE_PREFIX}:${userId.toString()}:${range}`;
}

function pruneInMemoryCache(nowMs: number = Date.now()): void {
  for (const [key, item] of inMemoryCache) {
    if (item.expiresAt < nowMs) {
      inMemoryCache.delete(key);
    }
  }

  while (inMemoryCache.size >= OVERVIEW_IN_MEMORY_CACHE_MAX_ENTRIES) {
    const oldestKey = inMemoryCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    inMemoryCache.delete(oldestKey);
  }
}

export async function getCachedUsageOverview(
  userId: Types.ObjectId,
  range: UsageRange,
): Promise<UsageOverviewResponse | null> {
  const cacheKey = usageOverviewCacheKey(userId, range);

  if (isRedisAvailable()) {
    try {
      const redis = getRedisClient();
      const raw = await redis.get(cacheKey);
      if (raw) {
        return JSON.parse(raw) as UsageOverviewResponse;
      }
    } catch {
      // Continue with in-memory cache fallback.
    }
  }

  const item = inMemoryCache.get(cacheKey);
  if (!item) return null;
  if (item.expiresAt < Date.now()) {
    inMemoryCache.delete(cacheKey);
    return null;
  }
  return item.value;
}

export async function setCachedUsageOverview(
  userId: Types.ObjectId,
  range: UsageRange,
  data: UsageOverviewResponse,
): Promise<void> {
  const cacheKey = usageOverviewCacheKey(userId, range);

  if (isRedisAvailable()) {
    try {
      const redis = getRedisClient();
      await redis.setex(cacheKey, USAGE_OVERVIEW_CACHE_TTL_SECONDS, JSON.stringify(data));
    } catch {
      // Fall back to in-memory cache.
    }
  }

  pruneInMemoryCache();
  inMemoryCache.set(cacheKey, {
    value: data,
    expiresAt: Date.now() + USAGE_OVERVIEW_CACHE_TTL_SECONDS * 1000,
  });
}

export async function invalidateUsageOverviewCache(
  userId: Types.ObjectId | string,
): Promise<void> {
  const cacheKeys = USAGE_OVERVIEW_RANGES.map((range) =>
    usageOverviewCacheKey(userId, range)
  );

  for (const cacheKey of cacheKeys) {
    inMemoryCache.delete(cacheKey);
  }

  if (isRedisAvailable()) {
    try {
      const redis = getRedisClient();
      await redis.del(...cacheKeys);
    } catch {
      // Cache invalidation must never break the write path.
    }
  }
}

export function clearUsageOverviewMemoryCache(): void {
  inMemoryCache.clear();
}
