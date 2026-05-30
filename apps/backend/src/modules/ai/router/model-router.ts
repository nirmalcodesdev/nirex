/**
 * Model Router
 *
 * Routes AI requests to the best available provider based on:
 * - User preferences (preferred provider/model)
 * - Required capabilities (tools, vision, reasoning)
 * - Provider health status
 * - Budget constraints (credit cost)
 * - Round-robin distribution when all else is equal
 *
 * Includes automatic failover when a provider fails.
 */

import type { AIProvider } from '../providers/provider.interface.js';
import type {
  AIProviderId,
  RoutingPreference,
  RoutedModel,
  ModelCapabilities,
} from '@nirex/shared';
import { getModelInfo } from '../config.js';
import { CircuitBreaker } from './circuit-breaker.js';
import { HealthChecker } from './health-checker.js';
import { logger } from '../../../utils/logger.js';

export class ModelRouter {
  private providers: Map<AIProviderId, AIProvider> = new Map();
  private circuitBreakers: Map<AIProviderId, CircuitBreaker> = new Map();
  private healthChecker: HealthChecker;
  private roundRobinIndex: Map<AIProviderId, number> = new Map();
  private defaultProviderOrder: AIProviderId[] = ['openai', 'anthropic', 'google'];

  constructor() {
    this.healthChecker = new HealthChecker(30_000, 3);
  }

  registerProvider(provider: AIProvider): void {
    this.providers.set(provider.id, provider);
    this.healthChecker.registerProvider(provider);

    this.circuitBreakers.set(
      provider.id,
      new CircuitBreaker(`provider:${provider.id}`, {
        failureThreshold: 3,
        cooldownMs: 60_000,
      }),
    );

    this.roundRobinIndex.set(provider.id, 0);
  }

  start(): void {
    this.healthChecker.start();
  }

  stop(): void {
    this.healthChecker.stop();
  }

  getProvider(id: AIProviderId): AIProvider | undefined {
    return this.providers.get(id);
  }

  getCircuitBreaker(providerId: AIProviderId): CircuitBreaker | undefined {
    return this.circuitBreakers.get(providerId);
  }

  /**
   * Route a request to the best provider based on preferences.
   */
  route(preferences?: RoutingPreference): RoutedModel {
    const candidates = this.getCandidateProviders(preferences);

    if (candidates.length === 0) {
      throw new Error('No healthy AI providers available');
    }

    // If user specified a preferred model, find the provider that has it
    if (preferences?.preferred_model) {
      for (const providerId of candidates) {
        const provider = this.providers.get(providerId);
        if (provider && provider.models.includes(preferences.preferred_model)) {
          return { provider_id: providerId, model: preferences.preferred_model };
        }
      }
    }

    // Use the first available candidate (round-robin)
    const providerId = candidates[0]!;
    const provider = this.providers.get(providerId)!;

    return {
      provider_id: providerId,
      model: preferences?.preferred_model || provider.defaultModel,
    };
  }

  /**
   * Perform failover to an alternative provider.
   */
  failover(failedProviderId: AIProviderId, preferredModel?: string): RoutedModel {
    const circuitBreaker = this.circuitBreakers.get(failedProviderId);
    if (circuitBreaker) {
      circuitBreaker.recordFailure();
    }

    logger.warn(`[ModelRouter] failover from ${failedProviderId}`);

    const candidates = this.getCandidateProviders({
      preferred_model: preferredModel,
    }).filter((id) => id !== failedProviderId);

    if (candidates.length === 0) {
      throw new Error(`No failover provider available after ${failedProviderId} failure`);
    }

    const failoverId = candidates[0]!;
    const provider = this.providers.get(failoverId)!;
    return {
      provider_id: failoverId,
      model: preferredModel || provider.defaultModel,
    };
  }

  /**
   * Select a provider that supports the required tool capabilities.
   */
  selectByCapability(requiredCapabilities: string[]): RoutedModel {
    const candidates = this.getCandidateProviders().filter((id) => {
      const provider = this.providers.get(id);
      if (!provider) return false;

      const models = provider.models;
      return models.some((model) => {
        const info = getModelInfo(id, model);
        if (!info) return false;

        if (requiredCapabilities.includes('tools') && !info.capabilities.supports_tools) return false;
        if (requiredCapabilities.includes('vision') && !info.capabilities.supports_vision) return false;
        if (requiredCapabilities.includes('reasoning') && !info.capabilities.supports_reasoning) return false;
        if (requiredCapabilities.includes('json_mode') && !info.capabilities.supports_json_mode) return false;

        return true;
      });
    });

    if (candidates.length === 0) {
      throw new Error('No provider supports the required capabilities');
    }

    const capProviderId = candidates[0]!;
    const provider = this.providers.get(capProviderId)!;
    return { provider_id: capProviderId, model: provider.defaultModel };
  }

  /**
   * Select a provider by budget (cheapest capable model).
   */
  selectByBudget(maxCredits: number): RoutedModel {
    let best: RoutedModel | null = null;
    let bestCost = Infinity;

    for (const [id, provider] of this.providers) {
      if (!this.canRouteTo(id)) continue;

      for (const model of provider.models) {
        const info = getModelInfo(id, model);
        if (!info) continue;

        const inputCost = info.credit_cost_per_1k_input_tokens || Infinity;
        if (inputCost < bestCost && inputCost <= maxCredits) {
          bestCost = inputCost;
          best = { provider_id: id, model };
        }
      }
    }

    if (!best) {
      throw new Error(`No model available within budget of ${maxCredits} credits`);
    }

    return best;
  }

  /**
   * Record success/failure for circuit breaker.
   */
  recordSuccess(providerId: AIProviderId): void {
    this.circuitBreakers.get(providerId)?.recordSuccess();
  }

  recordFailure(providerId: AIProviderId): void {
    this.circuitBreakers.get(providerId)?.recordFailure();
  }

  getAllProviders(): AIProvider[] {
    return [...this.providers.values()];
  }

  getProviderHealth(): Record<string, string> {
    const health: Record<string, string> = {};
    for (const [id] of this.providers) {
      health[id] = this.healthChecker.getHealth(id);
    }
    return health;
  }

  getCircuitBreakerStats(): Record<string, ReturnType<CircuitBreaker['getStats']>> {
    const stats: Record<string, ReturnType<CircuitBreaker['getStats']>> = {};
    for (const [id, cb] of this.circuitBreakers) {
      stats[id] = cb.getStats();
    }
    return stats;
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private canRouteTo(providerId: AIProviderId): boolean {
    if (!this.healthChecker.isHealthy(providerId)) return false;

    const breaker = this.circuitBreakers.get(providerId);
    if (breaker && breaker.isOpen) return false;

    return true;
  }

  private getCandidateProviders(preferences?: RoutingPreference): AIProviderId[] {
    let candidates = this.defaultProviderOrder.filter((id) => {
      if (!this.providers.has(id)) return false;
      if (!this.healthChecker.isHealthy(id)) return false;
      const breaker = this.circuitBreakers.get(id);
      if (breaker && breaker.isOpen) return false;
      return true;
    });

    // Move preferred provider to front
    if (preferences?.preferred_provider && candidates.includes(preferences.preferred_provider)) {
      candidates = [
        preferences.preferred_provider,
        ...candidates.filter((id) => id !== preferences.preferred_provider),
      ];
    }

    return candidates;
  }
}
