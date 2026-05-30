import { Types } from 'mongoose';
import {
  ROLLING_WINDOW_5H_MS,
  ROLLING_WINDOW_7D_MS,
  getPlanRollingWindowCaps,
  type BillingPlanId,
  type RollingWindowUsage,
} from '@nirex/shared';
import { getRedisClient, isRedisAvailable } from '../../config/redis.js';
import { AppError } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

const WINDOW_5H = '5h';
const WINDOW_7D = '7d';

function redisKey(userId: Types.ObjectId | string, window: string): string {
  return `rolling:${userId}:${window}`;
}

function safeLimit(limit: number): number {
  return Number.isFinite(limit) && limit > 0 ? limit : 0;
}

// ─── Atomic Lua script ─────────────────────────────────────────────────

const CHECK_AND_RECORD_SCRIPT = `
local now = tonumber(ARGV[1])
local member = ARGV[2]
local win5h = tonumber(ARGV[3])
local win7d = tonumber(ARGV[4])
local max5h = tonumber(ARGV[5])
local max7d = tonumber(ARGV[6])

-- Evict entries older than the window
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - win5h)
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', now - win7h)

local count5h = redis.call('ZCARD', KEYS[1])
local count7d = redis.call('ZCARD', KEYS[2])

-- Check limits (max <= 0 means unlimited)
if max5h > 0 and count5h >= max5h then
  local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
  local oldestTs = (#oldest >= 2) and tonumber(oldest[2]) or 0
  return {0, count5h, count7d, '5h', oldestTs, 0}
end
if max7d > 0 and count7d >= max7d then
  local oldest = redis.call('ZRANGE', KEYS[2], 0, 0, 'WITHSCORES')
  local oldestTs = (#oldest >= 2) and tonumber(oldest[2]) or 0
  return {0, count5h, count7d, '7d', 0, oldestTs}
end

-- Record the request (member = unique per-request id, ensures no dedup needed)
redis.call('ZADD', KEYS[1], now, member .. ':5h')
redis.call('ZADD', KEYS[2], now, member .. ':7h')
count5h = count5h + 1
count7d = count7d + 1

-- Refresh TTL so keys live as long as entries exist
redis.call('PEXPIRE', KEYS[1], win5h + 60000)
redis.call('PEXPIRE', KEYS[2], win7d + 60000)

-- Get oldest entries for resetsAt
local oldest5h = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
local oldest7d = redis.call('ZRANGE', KEYS[2], 0, 0, 'WITHSCORES')
local o5h = (#oldest5h >= 2) and tonumber(oldest5h[2]) or 0
local o7d = (#oldest7d >= 2) and tonumber(oldest7d[2]) or 0

return {1, count5h, count7d, '', o5h, o7d}
`;

// ─── Read-only status script (for UI display, no side effects) ─────────

const GET_STATUS_SCRIPT = `
local now = tonumber(ARGV[1])
local win5h = tonumber(ARGV[2])
local win7d = tonumber(ARGV[3])

redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - win5h)
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', now - win7d)

local count5h = redis.call('ZCARD', KEYS[1])
local count7d = redis.call('ZCARD', KEYS[2])

local oldest5h = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
local oldest7d = redis.call('ZRANGE', KEYS[2], 0, 0, 'WITHSCORES')
local o5h = (#oldest5h >= 2) and tonumber(oldest5h[2]) or 0
local o7d = (#oldest7d >= 2) and tonumber(oldest7d[2]) or 0

return {count5h, count7d, o5h, o7d}
`;

function resetsAt(oldestTimestamp: number, windowMs: number): string | null {
  if (oldestTimestamp <= 0) return null;
  return new Date(oldestTimestamp + windowMs).toISOString();
}

export class RollingWindowService {
  private checkAndRecordScriptHash: string | null = null;
  private getStatusScriptHash: string | null = null;

  private async loadScript(script: string): Promise<string> {
    if (!isRedisAvailable()) return '';
    try {
      const redis = getRedisClient();
      return await redis.script('LOAD', script) as string;
    } catch (error) {
      logger.warn('Failed to load rolling window Lua script.', {
        error: error instanceof Error ? error.message : String(error),
      });
      return '';
    }
  }

  private async ensureScripts(): Promise<void> {
    if (!isRedisAvailable()) return;
    if (!this.checkAndRecordScriptHash) {
      this.checkAndRecordScriptHash = await this.loadScript(CHECK_AND_RECORD_SCRIPT);
    }
    if (!this.getStatusScriptHash) {
      this.getStatusScriptHash = await this.loadScript(GET_STATUS_SCRIPT);
    }
  }

  async checkAndRecord(
    userId: Types.ObjectId,
    planId: BillingPlanId,
  ): Promise<{ allowed: boolean; exceeded: '5h' | '7d' | null; retryAfterMs: number | null }> {
    if (!isRedisAvailable()) {
      return { allowed: true, exceeded: null, retryAfterMs: null };
    }

    await this.ensureScripts();

    const caps = getPlanRollingWindowCaps(planId);
    const limit5h = safeLimit(caps.window5h);
    const limit7d = safeLimit(caps.window7d);

    if (limit5h <= 0 && limit7d <= 0) {
      return { allowed: true, exceeded: null, retryAfterMs: null };
    }

    const now = Date.now();
    const member = `${now}:${Math.random().toString(36).slice(2, 9)}`;

    try {
      const redis = getRedisClient();
      const key5h = redisKey(userId, WINDOW_5H);
      const key7d = redisKey(userId, WINDOW_7D);

      let result: Array<number | string>;
      if (this.checkAndRecordScriptHash) {
        result = await redis.evalsha(
          this.checkAndRecordScriptHash,
          2,
          key5h, key7d,
          now, member, ROLLING_WINDOW_5H_MS, ROLLING_WINDOW_7D_MS, limit5h, limit7d,
        ) as Array<number | string>;
      } else {
        result = await redis.eval(
          CHECK_AND_RECORD_SCRIPT,
          2,
          key5h, key7d,
          now, member, ROLLING_WINDOW_5H_MS, ROLLING_WINDOW_7D_MS, limit5h, limit7d,
        ) as Array<number | string>;
      }

      const allowed = result[0] === 1;
      const exceeded = (result[3] as string) || null;

      let retryAfterMs: number | null = null;
      if (!allowed && exceeded) {
        const oldestTs = Number(result[exceeded === '5h' ? 4 : 5]) || 0;
        const windowMs = exceeded === '5h' ? ROLLING_WINDOW_5H_MS : ROLLING_WINDOW_7D_MS;
        if (oldestTs > 0) {
          retryAfterMs = Math.max(0, (oldestTs + windowMs) - now);
        } else {
          retryAfterMs = windowMs;
        }
      }

      return { allowed, exceeded: exceeded as '5h' | '7d' | null, retryAfterMs };
    } catch (error) {
      logger.warn('Rolling window check+record failed, allowing request.', {
        userId: userId.toString(),
        planId,
        error: error instanceof Error ? error.message : String(error),
      });
      return { allowed: true, exceeded: null, retryAfterMs: null };
    }
  }

  async getStatus(
    userId: Types.ObjectId,
    planId: BillingPlanId,
  ): Promise<{
    window5h: { used: number; limit: number; resetsAt: string | null };
    window7d: { used: number; limit: number; resetsAt: string | null };
  }> {
    const caps = getPlanRollingWindowCaps(planId);
    const limit5h = safeLimit(caps.window5h);
    const limit7d = safeLimit(caps.window7d);

    if (!isRedisAvailable()) {
      return {
        window5h: { used: 0, limit: limit5h, resetsAt: null },
        window7d: { used: 0, limit: limit7d, resetsAt: null },
      };
    }

    await this.ensureScripts();

    const now = Date.now();

    try {
      const redis = getRedisClient();
      const key5h = redisKey(userId, WINDOW_5H);
      const key7d = redisKey(userId, WINDOW_7D);

      let result: Array<number>;
      if (this.getStatusScriptHash) {
        result = await redis.evalsha(
          this.getStatusScriptHash,
          2,
          key5h, key7d,
          now, ROLLING_WINDOW_5H_MS, ROLLING_WINDOW_7D_MS,
        ) as Array<number>;
      } else {
        result = await redis.eval(
          GET_STATUS_SCRIPT,
          2,
          key5h, key7d,
          now, ROLLING_WINDOW_5H_MS, ROLLING_WINDOW_7D_MS,
        ) as Array<number>;
      }

      return {
        window5h: {
          used: result[0] || 0,
          limit: limit5h,
          resetsAt: resetsAt(result[2] || 0, ROLLING_WINDOW_5H_MS),
        },
        window7d: {
          used: result[1] || 0,
          limit: limit7d,
          resetsAt: resetsAt(result[3] || 0, ROLLING_WINDOW_7D_MS),
        },
      };
    } catch (error) {
      logger.warn('Rolling window status fetch failed.', {
        userId: userId.toString(),
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        window5h: { used: 0, limit: limit5h, resetsAt: null },
        window7d: { used: 0, limit: limit7d, resetsAt: null },
      };
    }
  }

  async getUsageSnapshot(
    userId: Types.ObjectId,
    planId: BillingPlanId,
  ): Promise<RollingWindowUsage> {
    const status = await this.getStatus(userId, planId);

    return {
      window5h: {
        used: status.window5h.used,
        limit: status.window5h.limit > 0 ? status.window5h.limit : null,
        remaining: status.window5h.limit > 0
          ? Math.max(0, status.window5h.limit - status.window5h.used)
          : null,
        resetsAt: status.window5h.resetsAt,
      },
      window7d: {
        used: status.window7d.used,
        limit: status.window7d.limit > 0 ? status.window7d.limit : null,
        remaining: status.window7d.limit > 0
          ? Math.max(0, status.window7d.limit - status.window7d.used)
          : null,
        resetsAt: status.window7d.resetsAt,
      },
    };
  }
}

export const rollingWindowService = new RollingWindowService();
