/**
 * AI Module
 *
 * Initialises all providers, the model router, health checker, and caches.
 * The ModelRouter singleton is created here and used by AIService.
 */

import { ModelRouter } from './router/model-router.js';
import { DEFAULT_PROVIDER_CONFIG } from './config.js';
import { OpenAIProvider } from './providers/openai.provider.js';
import { AnthropicProvider } from './providers/anthropic.provider.js';
import { GoogleProvider } from './providers/google.provider.js';
import { LocalProvider } from './providers/local.provider.js';
import { CustomProvider } from './providers/custom.provider.js';
import { logger } from '../../utils/logger.js';

// Singleton model router for the application
export const modelRouter = new ModelRouter();

/**
 * Initialize the AI module.
 * Registers enabled providers, starts health checks.
 * Safe to call multiple times (idempotent check).
 */
let initialized = false;

export function initAIModule(): void {
  if (initialized) return;
  initialized = true;

  // Register OpenAI
  const openaiConfig = DEFAULT_PROVIDER_CONFIG.openai;
  if (openaiConfig.enabled && envHasApiKey(openaiConfig.api_key_env_var)) {
    const provider = new OpenAIProvider(openaiConfig);
    modelRouter.registerProvider(provider);
    logger.info('[AI Module] OpenAI provider registered');
  } else {
    logger.info('[AI Module] OpenAI provider disabled or missing API key');
  }

  // Register Anthropic
  const anthropicConfig = DEFAULT_PROVIDER_CONFIG.anthropic;
  if (anthropicConfig.enabled && envHasApiKey(anthropicConfig.api_key_env_var)) {
    const provider = new AnthropicProvider(anthropicConfig);
    modelRouter.registerProvider(provider);
    logger.info('[AI Module] Anthropic provider registered');
  } else {
    logger.info('[AI Module] Anthropic provider disabled or missing API key');
  }

  // Register Google
  const googleConfig = DEFAULT_PROVIDER_CONFIG.google;
  if (googleConfig.enabled && envHasApiKey(googleConfig.api_key_env_var)) {
    const provider = new GoogleProvider(googleConfig);
    modelRouter.registerProvider(provider);
    logger.info('[AI Module] Google provider registered');
  } else {
    logger.info('[AI Module] Google provider disabled or missing API key');
  }

  // Register Local (always register but may fail health checks)
  const localConfig = DEFAULT_PROVIDER_CONFIG.local;
  if (localConfig.enabled) {
    const provider = new LocalProvider(localConfig);
    modelRouter.registerProvider(provider);
    logger.info('[AI Module] Local provider registered');
  }

  // Register Custom (user-supplied OpenAI-compatible endpoint)
  const customConfig = DEFAULT_PROVIDER_CONFIG.custom;
  const hasCustomEndpoint = customConfig.enabled &&
    (!!customConfig.base_url || customConfig.models.length > 0);
  if (hasCustomEndpoint) {
    const provider = new CustomProvider(customConfig);
    modelRouter.registerProvider(provider);
    logger.info('[AI Module] Custom provider registered', {
      baseUrl: customConfig.base_url,
      models: customConfig.models,
    });
  }

  // Start health checks
  modelRouter.start();

  logger.info('[AI Module] initialized');
}

export function shutdownAIModule(): void {
  modelRouter.stop();
  logger.info('[AI Module] shutdown');
}

function envHasApiKey(envVar: string): boolean {
  return !!process.env[envVar] && process.env[envVar]!.length > 0;
}
