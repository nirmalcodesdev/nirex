/**
 * AI Provider Configuration
 *
 * Central config for all AI providers including model metadata,
 * pricing, capability flags, and runtime settings.
 * Reads provider API keys and settings from the validated env config.
 */

import type { AIProviderId, ModelCapabilities, AIModelInfo, ProviderConfig } from '@nirex/shared';
import { env } from '../../config/env.js';

interface ProviderModelEntry {
  id: string;
  name: string;
  capabilities: ModelCapabilities;
  credit_cost_per_1k_input_tokens: number;
  credit_cost_per_1k_output_tokens: number;
}

interface ProviderMeta {
  id: AIProviderId;
  name: string;
  apiKeyEnvVar: string;
  defaultModel: string;
  baseUrl: string;
  models: ProviderModelEntry[];
}

export const PROVIDER_REGISTRY: Record<AIProviderId, ProviderMeta> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    apiKeyEnvVar: 'OPENAI_API_KEY',
    defaultModel: 'gpt-4o',
    baseUrl: 'https://api.openai.com/v1',
    models: [
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        capabilities: {
          supports_tools: true,
          supports_streaming: true,
          supports_vision: true,
          supports_reasoning: false,
          supports_json_mode: true,
          supports_prompt_caching: false,
          max_context_tokens: 128000,
          max_output_tokens: 16384,
        },
        credit_cost_per_1k_input_tokens: 2.5,
        credit_cost_per_1k_output_tokens: 10,
      },
      {
        id: 'gpt-4.1',
        name: 'GPT-4.1',
        capabilities: {
          supports_tools: true,
          supports_streaming: true,
          supports_vision: true,
          supports_reasoning: false,
          supports_json_mode: true,
          supports_prompt_caching: true,
          max_context_tokens: 1000000,
          max_output_tokens: 32768,
        },
        credit_cost_per_1k_input_tokens: 2,
        credit_cost_per_1k_output_tokens: 8,
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        capabilities: {
          supports_tools: true,
          supports_streaming: true,
          supports_vision: true,
          supports_reasoning: false,
          supports_json_mode: true,
          supports_prompt_caching: false,
          max_context_tokens: 128000,
          max_output_tokens: 16384,
        },
        credit_cost_per_1k_input_tokens: 0.15,
        credit_cost_per_1k_output_tokens: 0.6,
      },
      {
        id: 'o3',
        name: 'O3',
        capabilities: {
          supports_tools: true,
          supports_streaming: true,
          supports_vision: true,
          supports_reasoning: true,
          supports_json_mode: true,
          supports_prompt_caching: false,
          max_context_tokens: 200000,
          max_output_tokens: 100000,
        },
        credit_cost_per_1k_input_tokens: 10,
        credit_cost_per_1k_output_tokens: 40,
      },
      {
        id: 'o4-mini',
        name: 'O4 Mini',
        capabilities: {
          supports_tools: true,
          supports_streaming: true,
          supports_vision: true,
          supports_reasoning: true,
          supports_json_mode: true,
          supports_prompt_caching: false,
          max_context_tokens: 200000,
          max_output_tokens: 100000,
        },
        credit_cost_per_1k_input_tokens: 1.1,
        credit_cost_per_1k_output_tokens: 4.4,
      },
    ],
  },

  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    defaultModel: 'claude-sonnet-4-20250514',
    baseUrl: 'https://api.anthropic.com/v1',
    models: [
      {
        id: 'claude-opus-4-20250514',
        name: 'Claude Opus 4',
        capabilities: {
          supports_tools: true,
          supports_streaming: true,
          supports_vision: true,
          supports_reasoning: false,
          supports_json_mode: true,
          supports_prompt_caching: true,
          max_context_tokens: 200000,
          max_output_tokens: 32000,
        },
        credit_cost_per_1k_input_tokens: 15,
        credit_cost_per_1k_output_tokens: 75,
      },
      {
        id: 'claude-sonnet-4-20250514',
        name: 'Claude Sonnet 4',
        capabilities: {
          supports_tools: true,
          supports_streaming: true,
          supports_vision: true,
          supports_reasoning: false,
          supports_json_mode: true,
          supports_prompt_caching: true,
          max_context_tokens: 200000,
          max_output_tokens: 16000,
        },
        credit_cost_per_1k_input_tokens: 3,
        credit_cost_per_1k_output_tokens: 15,
      },
      {
        id: 'claude-haiku-3-5-20241022',
        name: 'Claude 3.5 Haiku',
        capabilities: {
          supports_tools: true,
          supports_streaming: true,
          supports_vision: true,
          supports_reasoning: false,
          supports_json_mode: true,
          supports_prompt_caching: true,
          max_context_tokens: 200000,
          max_output_tokens: 8192,
        },
        credit_cost_per_1k_input_tokens: 0.8,
        credit_cost_per_1k_output_tokens: 4,
      },
    ],
  },

  google: {
    id: 'google',
    name: 'Google AI',
    apiKeyEnvVar: 'GOOGLE_AI_API_KEY',
    defaultModel: 'gemini-2.5-flash',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: [
      {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        capabilities: {
          supports_tools: true,
          supports_streaming: true,
          supports_vision: true,
          supports_reasoning: true,
          supports_json_mode: true,
          supports_prompt_caching: true,
          max_context_tokens: 1048576,
          max_output_tokens: 65536,
        },
        credit_cost_per_1k_input_tokens: 1.25,
        credit_cost_per_1k_output_tokens: 10,
      },
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        capabilities: {
          supports_tools: true,
          supports_streaming: true,
          supports_vision: true,
          supports_reasoning: false,
          supports_json_mode: true,
          supports_prompt_caching: true,
          max_context_tokens: 1048576,
          max_output_tokens: 65536,
        },
        credit_cost_per_1k_input_tokens: 0.15,
        credit_cost_per_1k_output_tokens: 0.6,
      },
    ],
  },

  local: {
    id: 'local' as const,
    name: 'Local (Ollama / LM Studio)',
    apiKeyEnvVar: 'LOCAL_AI_API_KEY',
    defaultModel: 'llama3',
    baseUrl: 'http://localhost:11434/v1',
    models: [],
  },

  custom: {
    id: 'custom' as const,
    name: 'Custom (OpenAI-compatible)',
    apiKeyEnvVar: 'CUSTOM_AI_API_KEY',
    defaultModel: '',
    baseUrl: '',
    models: [],
  },
};

function buildCustomProviderConfig(): ProviderConfig {
  const models = env.CUSTOM_AI_MODELS
    ? env.CUSTOM_AI_MODELS.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  return {
    id: 'custom',
    enabled: true,
    api_key_env_var: 'CUSTOM_AI_API_KEY',
    base_url: env.CUSTOM_AI_BASE_URL,
    default_model: env.CUSTOM_AI_DEFAULT_MODEL || models[0] || 'custom-model',
    models,
    timeout_ms: env.CUSTOM_AI_TIMEOUT_MS ?? 120000,
    max_retries: env.CUSTOM_AI_MAX_RETRIES ?? 3,
    rate_limit_per_minute: env.CUSTOM_AI_RATE_LIMIT_PER_MIN ?? 100,
    rate_limit_per_day: env.CUSTOM_AI_RATE_LIMIT_PER_DAY ?? 100_000,
  };
}

export const DEFAULT_PROVIDER_CONFIG = {
  openai: {
    id: 'openai' as const,
    enabled: true,
    api_key_env_var: 'OPENAI_API_KEY',
    default_model: 'gpt-4o',
    models: PROVIDER_REGISTRY.openai.models.map((m) => m.id),
    timeout_ms: 120000,
    max_retries: 3,
    rate_limit_per_minute: 500,
    rate_limit_per_day: 1000000,
  },
  anthropic: {
    id: 'anthropic' as const,
    enabled: true,
    api_key_env_var: 'ANTHROPIC_API_KEY',
    default_model: 'claude-sonnet-4-20250514',
    models: PROVIDER_REGISTRY.anthropic.models.map((m) => m.id),
    timeout_ms: 120000,
    max_retries: 3,
    rate_limit_per_minute: 200,
    rate_limit_per_day: 500000,
  },
  google: {
    id: 'google' as const,
    enabled: true,
    api_key_env_var: 'GOOGLE_AI_API_KEY',
    default_model: 'gemini-2.5-flash',
    models: PROVIDER_REGISTRY.google.models.map((m) => m.id),
    timeout_ms: 120000,
    max_retries: 3,
    rate_limit_per_minute: 100,
    rate_limit_per_day: 300000,
  },
  local: {
    id: 'local' as const,
    enabled: false,
    api_key_env_var: 'LOCAL_AI_API_KEY',
    default_model: 'llama3',
    models: [],
    timeout_ms: 300000,
    max_retries: 2,
    rate_limit_per_minute: 50,
    rate_limit_per_day: 50000,
  },
  custom: buildCustomProviderConfig(),
} satisfies Record<AIProviderId, ProviderConfig>;

export function getModelInfo(provider: AIProviderId, model: string): AIModelInfo | undefined {
  const meta = PROVIDER_REGISTRY[provider];
  if (!meta) return undefined;
  const entry = meta.models.find((m) => m.id === model);
  if (!entry) return undefined;
  return {
    id: entry.id,
    provider: meta.id,
    name: entry.name,
    capabilities: entry.capabilities,
    credit_cost_per_1k_input_tokens: entry.credit_cost_per_1k_input_tokens,
    credit_cost_per_1k_output_tokens: entry.credit_cost_per_1k_output_tokens,
    status: 'available',
  };
}

export function resolveChatModel(provider?: AIProviderId, model?: string): string {
  if (model) return model;

  if (provider) {
    const meta = PROVIDER_REGISTRY[provider];
    if (meta) return meta.defaultModel;
  }

  // Fall through: first enabled provider's default
  const first = Object.values(PROVIDER_REGISTRY).find((m) => m.models.length > 0);
  return first?.defaultModel ?? 'gpt-4o';
}

export function resolveEmbedModel(model?: string): string {
  return model || 'text-embedding-3-small';
}

export function listAllModels(): AIModelInfo[] {
  const models: AIModelInfo[] = [];
  for (const [providerId, meta] of Object.entries(PROVIDER_REGISTRY)) {
    for (const model of meta.models) {
      models.push({
        id: model.id,
        provider: providerId as AIProviderId,
        name: model.name,
        capabilities: model.capabilities,
        credit_cost_per_1k_input_tokens: model.credit_cost_per_1k_input_tokens,
        credit_cost_per_1k_output_tokens: model.credit_cost_per_1k_output_tokens,
        status: 'available',
      });
    }
  }
  return models;
}
