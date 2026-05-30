/**
 * Health Checker
 *
 * Periodically checks provider health (every 30s).
 * Maintains health status per provider for the model router to use.
 * When a provider fails 3+ consecutive health checks, it's marked unhealthy
 * until it passes a health check again.
 */

import type { AIProvider } from '../providers/provider.interface.js';
import type { AIProviderId } from '@nirex/shared';
import { logger } from '../../../utils/logger.js';
import { CircuitBreaker } from './circuit-breaker.js';

export type ProviderHealth = 'healthy' | 'degraded' | 'unhealthy';

export class HealthChecker {
  private providers: Map<AIProviderId, AIProvider> = new Map();
  private statuses: Map<AIProviderId, ProviderHealth> = new Map();
  private consecutiveFailures: Map<AIProviderId, number> = new Map();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private readonly checkIntervalMs: number;
  private readonly unhealthyThreshold: number;

  constructor(checkIntervalMs: number = 30_000, unhealthyThreshold: number = 3) {
    this.checkIntervalMs = checkIntervalMs;
    this.unhealthyThreshold = unhealthyThreshold;
  }

  registerProvider(provider: AIProvider): void {
    this.providers.set(provider.id, provider);
    this.statuses.set(provider.id, 'healthy');
    this.consecutiveFailures.set(provider.id, 0);
  }

  start(): void {
    if (this.intervalId) return;

    // Run initial checks
    this.checkAll().catch(() => {});

    this.intervalId = setInterval(() => {
      this.checkAll().catch(() => {});
    }, this.checkIntervalMs);

    logger.info('Health checker started', {
      intervalMs: this.checkIntervalMs,
      providers: [...this.providers.keys()],
    });
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Health checker stopped');
    }
  }

  getHealth(providerId: AIProviderId): ProviderHealth {
    return this.statuses.get(providerId) || 'healthy';
  }

  isHealthy(providerId: AIProviderId): boolean {
    return this.statuses.get(providerId) !== 'unhealthy';
  }

  getAllHealth(): Record<AIProviderId, ProviderHealth> {
    const result: Record<string, ProviderHealth> = {};
    for (const [id, status] of this.statuses) {
      result[id] = status;
    }
    return result;
  }

  private async checkAll(): Promise<void> {
    const checks = [...this.providers.entries()].map(async ([id, provider]) => {
      try {
        const healthy = await provider.healthCheck();
        if (healthy) {
          this.consecutiveFailures.set(id, 0);
          this.statuses.set(id, 'healthy');
        } else {
          this.recordFailure(id);
        }
      } catch {
        this.recordFailure(id);
      }
    });

    await Promise.allSettled(checks);
  }

  private recordFailure(providerId: AIProviderId): void {
    const failures = (this.consecutiveFailures.get(providerId) || 0) + 1;
    this.consecutiveFailures.set(providerId, failures);
    this.statuses.set(providerId, failures >= this.unhealthyThreshold ? 'unhealthy' : 'degraded');
  }

  async updateModelStatuses(
    cb: (providerId: AIProviderId) => Promise<boolean>,
  ): Promise<void> {
    for (const [id] of this.providers) {
      try {
        const healthy = await cb(id);
        if (healthy) {
          this.statuses.set(id, 'healthy');
          this.consecutiveFailures.set(id, 0);
        } else {
          this.recordFailure(id);
        }
      } catch {
        this.recordFailure(id);
      }
    }
  }
}
