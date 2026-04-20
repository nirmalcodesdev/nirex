import { getRedisClient, isRedisAvailable } from '../../config/redis.js';
import { logger } from '../../utils/logger.js';

interface ModelPricing {
  input: number;  // per 1K tokens
  output: number; // per 1K tokens
  cached?: number; // per 1K cached tokens
  updatedAt: Date;
}

/**
 * Token Pricing Service
 * Manages pricing for different AI models with Redis caching
 */
class TokenPricingService {
  private readonly CACHE_KEY = 'token:pricing';
  private readonly CACHE_TTL = 3600; // 1 hour

  // Fallback pricing snapshot (last updated: 2026-04-20).
  // Keep this aligned with provider pricing pages because stats depend on it.
  private readonly fallbackPricing: Record<string, ModelPricing> = {
    'gpt-4': { input: 0.03, output: 0.06, cached: 0.015, updatedAt: new Date() },
    'gpt-4o': { input: 0.0025, output: 0.01, cached: 0.00125, updatedAt: new Date() },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006, cached: 0.000075, updatedAt: new Date() },
    'gpt-4o-latest': { input: 0.0025, output: 0.01, cached: 0.00125, updatedAt: new Date() },
    'gpt-5.4': { input: 0.0025, output: 0.015, cached: 0.00025, updatedAt: new Date() },
    'gpt-5.4-mini': { input: 0.00075, output: 0.0045, cached: 0.000075, updatedAt: new Date() },
    'gpt-5.4-nano': { input: 0.0002, output: 0.00125, cached: 0.00002, updatedAt: new Date() },
    'gpt-3.5-turbo': { input: 0.0005, output: 0.0015, updatedAt: new Date() },
    'gpt-3.5-turbo-16k': { input: 0.001, output: 0.002, updatedAt: new Date() },
    'claude-3-opus': { input: 0.015, output: 0.075, cached: 0.0015, updatedAt: new Date() },
    'claude-3-sonnet': { input: 0.003, output: 0.015, cached: 0.0003, updatedAt: new Date() },
    'claude-3-haiku': { input: 0.00025, output: 0.00125, cached: 0.00003, updatedAt: new Date() },
    'claude-3-5-sonnet': { input: 0.003, output: 0.015, cached: 0.0003, updatedAt: new Date() },
    'claude-3-5-sonnet-latest': { input: 0.003, output: 0.015, cached: 0.0003, updatedAt: new Date() },
    'claude-sonnet-4.6': { input: 0.003, output: 0.015, cached: 0.0003, updatedAt: new Date() },
    'claude-haiku-4.5': { input: 0.001, output: 0.005, cached: 0.0001, updatedAt: new Date() },
    'claude-opus-4.6': { input: 0.005, output: 0.025, cached: 0.0005, updatedAt: new Date() },
  };

  /**
   * Get pricing for a model
   */
  async getPricing(model: string): Promise<ModelPricing> {
    try {
      // Try to get from cache if Redis is available
      if (isRedisAvailable()) {
        const redis = getRedisClient();
        const cached = await redis.hget(this.CACHE_KEY, model);
        if (cached) {
          return JSON.parse(cached);
        }
      }
    } catch (err) {
      logger.warn('Failed to get pricing from cache', { error: (err as Error).message });
    }

    // Return fallback pricing
    return this.fallbackPricing[model] || this.fallbackPricing['gpt-4'] || {
      input: 0.03,
      output: 0.06,
      updatedAt: new Date(),
    };
  }

  /**
   * Calculate cost for token usage
   */
  async calculateCost(
    model: string,
    inputTokens: number,
    outputTokens: number,
    cachedTokens: number = 0
  ): Promise<{ cost: number; currency: string }> {
    const pricing = await this.getPricing(model);

    // Calculate costs (per 1K tokens)
    const inputCost = (inputTokens / 1000) * pricing.input;
    const outputCost = (outputTokens / 1000) * pricing.output;
    const cachedCost = cachedTokens > 0 && pricing.cached
      ? (cachedTokens / 1000) * pricing.cached
      : 0;

    const totalCost = inputCost + outputCost + cachedCost;

    return {
      cost: Number(totalCost.toFixed(6)),
      currency: 'USD',
    };
  }

  /**
   * Update pricing in cache
   */
  async updatePricing(model: string, pricing: Omit<ModelPricing, 'updatedAt'>): Promise<void> {
    const data: ModelPricing = {
      ...pricing,
      updatedAt: new Date(),
    };

    try {
      if (isRedisAvailable()) {
        const redis = getRedisClient();
        await redis.hset(this.CACHE_KEY, model, JSON.stringify(data));
        await redis.expire(this.CACHE_KEY, this.CACHE_TTL);
      }
    } catch (err) {
      logger.warn('Failed to update pricing cache', { error: (err as Error).message });
    }
  }

  /**
   * Get all available models and their pricing
   */
  getAvailableModels(): string[] {
    return Object.keys(this.fallbackPricing);
  }

  /**
   * Check if a model is supported
   */
  isModelSupported(model: string): boolean {
    return model in this.fallbackPricing;
  }
}

export const tokenPricingService = new TokenPricingService();
