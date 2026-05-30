/**
 * AI Module Index
 *
 * Public API for the AI module.
 */

export { initAIModule, shutdownAIModule, modelRouter } from './ai.module.js';
export { aiService, AIService } from './ai.service.js';
export { aiCache } from './cache/ai-cache.js';
export { encryptApiKey, decryptApiKey } from './security/key-encryption.js';
export { listAllModels, getModelInfo } from './config.js';
export { normalizeChunk, normalizeChunkToSSE } from './streaming/stream-normalizer.js';
export type { AIProvider } from './providers/provider.interface.js';
export { BaseProvider } from './providers/base.provider.js';
export { OpenAIProvider } from './providers/openai.provider.js';
export { AnthropicProvider } from './providers/anthropic.provider.js';
export { GoogleProvider } from './providers/google.provider.js';
export { LocalProvider } from './providers/local.provider.js';
export { CustomProvider } from './providers/custom.provider.js';
export { CircuitBreaker } from './router/circuit-breaker.js';
export { HealthChecker } from './router/health-checker.js';
export { ModelRouter } from './router/model-router.js';
export * as aiController from './ai.controller.js';
export { default as aiRoutes } from './ai.routes.js';
