import { Types } from 'mongoose';
import type { DashboardOverviewResponse, UsageRange } from '@nirex/shared';
import { getRedisClient, isRedisAvailable } from '../../config/redis.js';
import type { DashboardOverviewInput } from './dashboard.types.js';

const DASHBOARD_OVERVIEW_CACHE_PREFIX = 'dashboard:overview';
const DASHBOARD_OVERVIEW_CACHE_TTL_SECONDS = 60;
const DASHBOARD_IN_MEMORY_CACHE_MAX_ENTRIES = 3000;
const DASHBOARD_USAGE_RANGES: UsageRange[] = ['30d', '90d', 'month_to_date'];
const DASHBOARD_NOTIFICATION_LIMITS = Array.from({ length: 20 }, (_value, index) => index + 1);
const DASHBOARD_NOTIFICATION_INCLUSION = [true, false];

const inMemoryCache = new Map<
  string,
  { expiresAt: number; value: DashboardOverviewResponse }
>();

export function dashboardOverviewCacheKey(
  userId: Types.ObjectId | string,
  input: DashboardOverviewInput,
): string {
  return [
    DASHBOARD_OVERVIEW_CACHE_PREFIX,
    userId.toString(),
    input.usageRange,
    input.includeRecentNotifications ? '1' : '0',
    input.notificationsLimit,
  ].join(':');
}

function pruneInMemoryCache(nowMs: number = Date.now()): void {
  for (const [key, item] of inMemoryCache) {
    if (item.expiresAt < nowMs) inMemoryCache.delete(key);
  }
  while (inMemoryCache.size >= DASHBOARD_IN_MEMORY_CACHE_MAX_ENTRIES) {
    const oldestKey = inMemoryCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    inMemoryCache.delete(oldestKey);
  }
}

export async function getCachedDashboardOverview(
  cacheKey: string,
): Promise<DashboardOverviewResponse | null> {
  if (isRedisAvailable()) {
    try {
      const redis = getRedisClient();
      const raw = await redis.get(cacheKey);
      if (raw) return JSON.parse(raw) as DashboardOverviewResponse;
    } catch {
      // Continue with in-memory cache.
    }
  }

  const cached = inMemoryCache.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAt < Date.now()) {
    inMemoryCache.delete(cacheKey);
    return null;
  }
  return cached.value;
}

export async function setCachedDashboardOverview(
  cacheKey: string,
  value: DashboardOverviewResponse,
): Promise<void> {
  if (isRedisAvailable()) {
    try {
      const redis = getRedisClient();
      await redis.setex(cacheKey, DASHBOARD_OVERVIEW_CACHE_TTL_SECONDS, JSON.stringify(value));
    } catch {
      // Fall through to in-memory.
    }
  }

  pruneInMemoryCache();
  inMemoryCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + DASHBOARD_OVERVIEW_CACHE_TTL_SECONDS * 1000,
  });
}

export async function invalidateDashboardOverviewCache(
  userId: Types.ObjectId | string,
): Promise<void> {
  const userPrefix = `${DASHBOARD_OVERVIEW_CACHE_PREFIX}:${userId.toString()}:`;
  for (const cacheKey of inMemoryCache.keys()) {
    if (cacheKey.startsWith(userPrefix)) {
      inMemoryCache.delete(cacheKey);
    }
  }

  if (isRedisAvailable()) {
    const cacheKeys: string[] = [];
    for (const usageRange of DASHBOARD_USAGE_RANGES) {
      for (const includeRecentNotifications of DASHBOARD_NOTIFICATION_INCLUSION) {
        for (const notificationsLimit of DASHBOARD_NOTIFICATION_LIMITS) {
          cacheKeys.push(
            dashboardOverviewCacheKey(userId, {
              usageRange,
              includeRecentNotifications,
              notificationsLimit,
            })
          );
        }
      }
    }

    try {
      const redis = getRedisClient();
      await redis.del(...cacheKeys);
    } catch {
      // Cache invalidation must never break the write path.
    }
  }
}

export function clearDashboardOverviewMemoryCache(): void {
  inMemoryCache.clear();
}
