/**
 * AI Provider Domain Schemas
 *
 * Zod validation schemas for AI provider types.
 */

import { z } from 'zod';
import { toolDefinitionSchema, toolCallSchema } from '../agent/schemas.js';

// ============================================================================
// Provider Schemas
// ============================================================================

export const aiProviderIdSchema = z.enum(['openai', 'anthropic', 'google', 'local', 'custom']);

export const modelCapabilitiesSchema = z.object({
  supports_tools: z.boolean(),
  supports_streaming: z.boolean(),
  supports_vision: z.boolean(),
  supports_reasoning: z.boolean(),
  supports_json_mode: z.boolean(),
  supports_prompt_caching: z.boolean(),
  max_context_tokens: z.number().int().positive(),
  max_output_tokens: z.number().int().positive(),
});

export const textContentBlockSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
});

export const imageContentBlockSchema = z.object({
  type: z.literal('image_url'),
  image_url: z.object({
    url: z.string().url(),
    detail: z.enum(['low', 'high', 'auto']).optional(),
  }),
});

export const openAIToolUseContentBlockSchema = z.object({
  type: z.literal('tool_use'),
  id: z.string().min(1),
  name: z.string().min(1),
  input: z.record(z.unknown()),
});

export const openAIToolResultContentBlockSchema = z.object({
  type: z.literal('tool_result'),
  tool_use_id: z.string().min(1),
  content: z.string(),
  is_error: z.boolean().optional(),
});

export const providerContentBlockSchema = z.discriminatedUnion('type', [
  textContentBlockSchema,
  imageContentBlockSchema,
  openAIToolUseContentBlockSchema,
  openAIToolResultContentBlockSchema,
]);

export const providerMessageRoleSchema = z.enum(['system', 'user', 'assistant', 'tool']);

export const providerMessageSchema = z.object({
  role: providerMessageRoleSchema,
  content: z.union([z.string(), z.array(providerContentBlockSchema)]),
  name: z.string().optional(),
  tool_call_id: z.string().optional(),
  tool_calls: z.array(toolCallSchema).optional(),
});

// ============================================================================
// Request/Response Schemas
// ============================================================================

export const chatRequestSchema = z.object({
  model: z.string().min(1),
  messages: z.array(providerMessageSchema).min(1),
  system: z.string().optional(),
  max_tokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  tools: z.array(toolDefinitionSchema).optional(),
  tool_choice: z
    .union([
      z.enum(['auto', 'none', 'required']),
      z.object({
        type: z.literal('function'),
        function: z.object({ name: z.string() }),
      }),
    ])
    .optional(),
  stop: z.array(z.string()).optional(),
  reasoning_effort: z.enum(['low', 'medium', 'high']).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const completeRequestSchema = z.object({
  model: z.string().min(1),
  prompt: z.string().min(1),
  suffix: z.string().optional(),
  max_tokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  stop: z.array(z.string()).optional(),
});

export const embedRequestSchema = z.object({
  model: z.string().min(1),
  input: z.union([z.string(), z.array(z.string())]),
  encoding_format: z.enum(['float', 'base64']).optional(),
});

// ============================================================================
// Routing Schemas
// ============================================================================

export const routingPreferenceSchema = z.object({
  preferred_provider: aiProviderIdSchema.optional(),
  preferred_model: z.string().optional(),
  min_capabilities: modelCapabilitiesSchema.partial().optional(),
  max_credits_per_request: z.number().positive().optional(),
  require_streaming: z.boolean().optional(),
});

export const modelStatusSchema = z.enum(['available', 'degraded', 'unavailable']);

export const aiModelInfoSchema = z.object({
  id: z.string().min(1),
  provider: aiProviderIdSchema,
  name: z.string().min(1),
  capabilities: modelCapabilitiesSchema,
  credit_cost_per_1k_input_tokens: z.number().min(0),
  credit_cost_per_1k_output_tokens: z.number().min(0),
  status: modelStatusSchema,
});

// ============================================================================
// Provider Config Schema
// ============================================================================

export const providerConfigSchema = z.object({
  id: aiProviderIdSchema,
  enabled: z.boolean(),
  api_key_env_var: z.string().min(1),
  base_url: z.string().url().optional(),
  default_model: z.string().min(1),
  models: z.array(z.string().min(1)).min(1),
  timeout_ms: z.number().int().min(1000).max(300000),
  max_retries: z.number().int().min(0).max(10),
  rate_limit_per_minute: z.number().int().min(1),
  rate_limit_per_day: z.number().int().min(1),
});

// ============================================================================
// Unified Stream Chunk Schemas
// ============================================================================

export const unifiedStreamChunkTypeSchema = z.enum([
  'content_delta',
  'tool_call_start',
  'tool_call_delta',
  'tool_call_end',
  'tool_call_result',
  'tool_call_error',
  'reasoning_start',
  'reasoning_step',
  'completion',
  'error',
  'metadata',
]);

export const unifiedStreamChunkSchema = z.object({
  type: unifiedStreamChunkTypeSchema,
  sequence: z.number().int().min(0),
  content: z.string().optional(),
  id: z.string().optional(),
  name: z.string().optional(),
  arguments: z.record(z.unknown()).optional(),
  arguments_delta: z.string().optional(),
  token_usage: z
    .object({
      input_tokens: z.number(),
      output_tokens: z.number(),
      cached_tokens: z.number().optional(),
      reasoning_tokens: z.number().optional(),
      total_tokens: z.number(),
    })
    .optional(),
  finish_reason: z.string().optional(),
  code: z.string().optional(),
  message: z.string().optional(),
  retryable: z.boolean().optional(),
  model: z.string().optional(),
  session_id: z.string().optional(),
  turn_number: z.number().int().min(0).optional(),
  timestamp: z.date().or(z.string()).optional(),
});

// ============================================================================
// AI Chat API Schemas (for POST /api/ai/chat and /api/ai/chat/stream)
// ============================================================================

export const aiChatRequestSchema = z.object({
  provider: aiProviderIdSchema.optional(),
  model: z.string().optional(),
  system: z.string().optional(),
  messages: z.array(providerMessageSchema).min(1),
  max_tokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  tools: z.array(toolDefinitionSchema).optional(),
  tool_choice: z
    .union([
      z.enum(['auto', 'none', 'required']),
      z.object({
        type: z.literal('function'),
        function: z.object({ name: z.string() }),
      }),
    ])
    .optional(),
  stop: z.array(z.string()).optional(),
  reasoning_effort: z.enum(['low', 'medium', 'high']).optional(),
  stream: z.boolean().optional(),
  session_id: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const aiChatQuerySchema = z.object({
  provider: aiProviderIdSchema.optional(),
  model: z.string().optional(),
});

export type AiChatQuerySchema = z.infer<typeof aiChatQuerySchema>;
