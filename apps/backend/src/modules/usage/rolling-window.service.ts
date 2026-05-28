import { Types } from 'mongoose';
import {
  ROLLING_WINDOW_5H_MS,
  ROLLING_WINDOW_7D_MS,
  getPlanRollingWindowCaps,
  type BillingPlanId,
  type RollingWindowUsage,
} from '@nirex/shared';
import { getRedisClient, isRedisAvailable } from '../../config/redis.js';
import { logger } from '../../utils/logger.js';
import { usageRepository } from './usage.repository.js';

const WINDOW_5H_KEY = '5h';
const WINDOW_7D_KEY = '7d';

interface WindowCheck {
  used: number;
  limit: number;
  remaining: number;
  resetsAt: Date;
  exceeded: boolean;
}

interface RollingWindowStatus {
  window5h: WindowCheck;
  window7d: WindowCheck;
  exceeded: boolean;
  exceededWindow: '5h' | '7d' | null;
}

function redisKey(userId: Types.ObjectId | string, window: string): string {
  return `rolling:${userId}:${window}`;
}

function nowMs(): number {
  return Date.now();
}

function windowStartMs(windowMs: number): number {
  return nowMs() - windowMs;
}

async function redisCount(
  userId: Types.ObjectId,
  windowMs: number,
  windowKey: string,
): Promise<number> {
  if (!isRedisAvailable()) {
    return -1;
  }

  try {
    const redis = getRedisClient();
    const key = redisKey(userId, windowKey);
    const start = windowStartMs(windowMs);

    const pipeline = redis.pipeline();
    pipeline.zremrangebyscore(key, 0, start);
    pipeline.zcard(key);

    const results = await pipeline.exec();
    if (!results) return -1;

    const cardResult = results[1];
    if (!cardResult || cardResult[0]) return -1;

    return cardResult[1] as number;
  } catch (error) {
    logger.warn('Rolling window Redis count failed, falling back to MongoDB.', {
      userId: userId.toString(),
      windowKey,
      error: error instanceof Error ? error.message : String(error),
    });
    return -1;
  }
}

async function redisGetOldestTimestamp(
  userId: Types.ObjectId,
  windowKey: string,
): Promise<number | null> {
  if (!isRedisAvailable()) {
    return null;
  }

  try {
    const redis = getRedisClient();
    const key = redisKey(userId, windowKey);

    // Get the oldest (lowest score) member from the sorted set
    const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES');
    if (!oldest || oldest.length < 2 || !oldest[1]) {
      return null;
    }

    return parseInt(oldest[1], 10);
  } catch (error) {
    logger.warn('Rolling window Redis get oldest timestamp failed.', {
      userId: userId.toString(),
      windowKey,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function redisRecord(
  userId: Types.ObjectId,
  windowMs: number,
  windowKey: string,
  timestamp: number,
  idempotencyKey: string,
): Promise<boolean> {
  if (!isRedisAvailable()) {
    return false;
  }

  try {
    const redis = getRedisClient();
    const key = redisKey(userId, windowKey);
    const start = timestamp - windowMs;

    const pipeline = redis.pipeline();
    pipeline.zremrangebyscore(key, 0, start);
    pipeline.zadd(key, 'NX', timestamp, idempotencyKey);
    pipeline.pexpire(key, windowMs + 60000);

    const results = await pipeline.exec();
    if (!results) return false;

    const zaddResult = results[1];
    if (!zaddResult || zaddResult[0]) return false;

    return (zaddResult[1] as number) === 1;
  } catch (error) {
    logger.warn('Rolling window Redis record failed.', {
      userId: userId.toString(),
      windowKey,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

async function mongoCount(
  userId: Types.ObjectId,
  windowMs: number,
): Promise<number> {
  const start = new Date(windowStartMs(windowMs));
  const end = new Date();

  try {
    const totals = await usageRepository.getEventTotals(userId, { start, end });
    return totals.requests;
  } catch (error) {
    logger.error('Rolling window MongoDB count failed.', {
      userId: userId.toString(),
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

export class RollingWindowService {
  async checkWindow(
    userId: Types.ObjectId,
    planId: BillingPlanId,
  ): Promise<RollingWindowStatus> {
    const caps = getPlanRollingWindowCaps(planId);
    const now = nowMs();

    const [count5h, count7d] = await Promise.all([
      isRedisAvailable()
        ? redisCount(userId, ROLLING_WINDOW_5H_MS, WINDOW_5H_KEY)
        : Promise.resolve(-1),
      isRedisAvailable()
        ? redisCount(userId, ROLLING_WINDOW_7D_MS, WINDOW_7D_KEY)
        : Promise.resolve(-1),
    ]);

    const used5h = count5h >= 0 ? count5h : await mongoCount(userId, ROLLING_WINDOW_5H_MS);
    const used7d = count7d >= 0 ? count7d : await mongoCount(userId, ROLLING_WINDOW_7D_MS);

    const limit5h = caps.window5h;
    const limit7d = caps.window7d;

    const remaining5h = limit5h === Infinity ? Infinity : Math.max(0, limit5h - used5h);
    const remaining7d = limit7d === Infinity ? Infinity : Math.max(0, limit7d - used7d);

    const exceeded5h = limit5h !== Infinity && used5h >= limit5h;
    const exceeded7d = limit7d !== Infinity && used7d >= limit7d;

    const exceeded = exceeded5h || exceeded7d;
    const exceededWindow = exceeded5h ? '5h' : exceeded7d ? '7d' : null;

    const [oldest5h, oldest7d] = await Promise.all([
      used5h > 0 ? redisGetOldestTimestamp(userId, WINDOW_5H_KEY) : Promise.resolve(null),
      used7d > 0 ? redisGetOldestTimestamp(userId, WINDOW_7D_KEY) : Promise.resolve(null),
    ]);

    const resetsAt5h = oldest5h !== null
      ? new Date(oldest5h + ROLLING_WINDOW_5H_MS)
      : new Date(now);
    const resetsAt7d = oldest7d !== null
      ? new Date(oldest7d + ROLLING_WINDOW_7D_MS)
      : new Date(now);

    return {
      window5h: {
        used: used5h,
        limit: limit5h,
        remaining: remaining5h,
        resetsAt: resetsAt5h,
        exceeded: exceeded5h,
      },
      window7d: {
        used: used7d,
        limit: limit7d,
        remaining: remaining7d,
        resetsAt: resetsAt7d,
        exceeded: exceeded7d,
      },
      exceeded,
      exceededWindow,
    };
  }

  async recordUsage(
    userId: Types.ObjectId,
    idempotencyKey: string,
    timestamp: number = nowMs(),
  ): Promise<void> {
    const [recorded5h, recorded7d] = await Promise.all([
      redisRecord(userId, ROLLING_WINDOW_5H_MS, WINDOW_5H_KEY, timestamp, idempotencyKey),
      redisRecord(userId, ROLLING_WINDOW_7D_MS, WINDOW_7D_KEY, timestamp, idempotencyKey),
    ]);

    if (!recorded5h || !recorded7d) {
      logger.debug('Rolling window: Redis record incomplete, MongoDB is source of truth.', {
        userId: userId.toString(),
        idempotencyKey,
        recorded5h,
        recorded7d,
      });
    }
  }

  async getUsageSnapshot(
    userId: Types.ObjectId,
    planId: BillingPlanId,
  ): Promise<RollingWindowUsage> {
    const status = await this.checkWindow(userId, planId);

    return {
      window5h: {
        used: status.window5h.used,
        limit: status.window5h.limit === Infinity ? null : status.window5h.limit,
        remaining: status.window5h.remaining === Infinity ? null : status.window5h.remaining,
        resetsAt: status.window5h.resetsAt.toISOString(),
      },
      window7d: {
        used: status.window7d.used,
        limit: status.window7d.limit === Infinity ? null : status.window7d.limit,
        remaining: status.window7d.remaining === Infinity ? null : status.window7d.remaining,
        resetsAt: status.window7d.resetsAt.toISOString(),
      },
    };
  }

  async assertWithinLimits(
    userId: Types.ObjectId,
    planId: BillingPlanId,
  ): Promise<RollingWindowStatus> {
    const status = await this.checkWindow(userId, planId);

    if (status.exceeded) {
      const window = status.exceededWindow === '5h' ? '5-hour' : '7-day';
      const limit = status.exceededWindow === '5h' ? status.window5h.limit : status.window7d.limit;
      throw new Error(
        `Rolling window limit exceeded (${window}). Limit: ${limit} requests. Please wait for the window to reset.`,
      );
    }

    return status;
  }
}

export const rollingWindowService = new RollingWindowService();
