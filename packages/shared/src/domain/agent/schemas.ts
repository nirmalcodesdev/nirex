/**
 * Agent Domain Schemas
 *
 * Zod validation schemas for agent types.
 */

import { z } from 'zod';

// ============================================================================
// Tool System Schemas
// ============================================================================

export const jsonSchemaPropertySchema: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    type: z.string().optional(),
    description: z.string().optional(),
    enum: z.array(z.string()).optional(),
    items: jsonSchemaPropertySchema.optional(),
    properties: z.record(jsonSchemaPropertySchema).optional(),
    required: z.array(z.string()).optional(),
    default: z.unknown().optional(),
  }),
);

export const toolParameterSchemaSchema = z.object({
  type: z.literal('object'),
  properties: z.record(jsonSchemaPropertySchema),
  required: z.array(z.string()).optional(),
});

export const toolDefinitionSchema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().min(1).max(1024),
  parameters: toolParameterSchemaSchema,
});

export const toolCallSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  arguments: z.record(z.unknown()),
});

export const toolResultSchema = z.object({
  id: z.string().min(1),
  tool_call_id: z.string().min(1),
  content: z.string(),
  is_error: z.boolean(),
  metadata: z.record(z.unknown()).optional(),
});

export const toolCategorySchema = z.enum([
  'file',
  'bash',
  'git',
  'lsp',
  'web',
  'sandbox',
  'custom',
]);

export const toolRegistrationSchema = z.object({
  definition: toolDefinitionSchema,
  category: toolCategorySchema,
  executor: z.string(),
  requires_approval: z.boolean(),
  is_destructive: z.boolean(),
});

// ============================================================================
// Agent State Schemas
// ============================================================================

export const agentStatusSchema = z.enum([
  'idle',
  'thinking',
  'executing',
  'responding',
  'waiting_permission',
  'error',
  'cancelled',
]);

export const agentTurnSchema = z.object({
  sequence_number: z.number().int().min(0),
  tool_calls: z.array(toolCallSchema),
  tool_results: z.array(toolResultSchema),
  token_usage: z.object({
    input_tokens: z.number().int().min(0),
    output_tokens: z.number().int().min(0),
    cached_tokens: z.number().int().min(0).optional(),
    reasoning_tokens: z.number().int().min(0).optional(),
    total_tokens: z.number().int().min(0),
  }),
  started_at: z.date().or(z.string()),
  completed_at: z.date().or(z.string()).optional(),
  error: z.string().optional(),
});

// ============================================================================
// Agent Message Schemas
// ============================================================================

export const toolUseBlockSchema = z.object({
  type: z.literal('tool_use'),
  id: z.string().min(1),
  name: z.string().min(1),
  arguments: z.record(z.unknown()),
});

export const toolResultBlockSchema = z.object({
  type: z.literal('tool_result'),
  id: z.string().min(1),
  tool_call_id: z.string().min(1),
  content: z.string(),
  is_error: z.boolean(),
});

export const thinkingBlockSchema = z.object({
  type: z.literal('thinking'),
  content: z.string(),
});

export const textBlockSchema = z.object({
  type: z.literal('text'),
  content: z.string(),
});

export const contentBlockSchema = z.discriminatedUnion('type', [
  textBlockSchema,
  toolUseBlockSchema,
  toolResultBlockSchema,
  thinkingBlockSchema,
]);

// ============================================================================
// Permission System Schemas
// ============================================================================

export const permissionActionSchema = z.enum(['allow', 'deny', 'ask']);

export const permissionRuleSchema = z.object({
  id: z.string().min(1),
  tool_name: z.string().min(1),
  action: permissionActionSchema,
  pattern: z.string().optional(),
  description: z.string().optional(),
  expires_at: z.date().or(z.string()).optional(),
  created_at: z.date().or(z.string()),
});

export const permissionRequestSchema = z.object({
  id: z.string().min(1),
  tool_call: toolCallSchema,
  tool_definition: toolDefinitionSchema,
  is_destructive: z.boolean(),
  reason: z.string().optional(),
});

export const permissionResponseSchema = z.object({
  request_id: z.string().min(1),
  action: permissionActionSchema,
  remember: z.boolean().optional(),
  reason: z.string().optional(),
});

export const permissionConfigSchema = z.object({
  default_action: permissionActionSchema,
  rules: z.array(permissionRuleSchema),
  auto_allow_list: z.array(z.string()),
  auto_deny_list: z.array(z.string()),
  ask_timeout_ms: z.number().int().min(1000),
});

// ============================================================================
// Hook System Schemas
// ============================================================================

export const hookEventTypeSchema = z.enum([
  'pre_tool_execute',
  'post_tool_execute',
  'pre_llm_call',
  'post_llm_call',
  'session_start',
  'session_end',
  'turn_start',
  'turn_end',
  'permission_request',
  'error',
  'file_changed',
]);

export const hookDefinitionSchema = z.object({
  id: z.string().min(1),
  event: hookEventTypeSchema,
  command: z.string().min(1),
  timeout_ms: z.number().int().min(0).max(300000),
  enabled: z.boolean(),
});

// ============================================================================
// Sandbox Configuration Schemas
// ============================================================================

export const sandboxProviderSchema = z.enum(['docker', 'firecracker', 'process', 'wasm']);

export const dockerSandboxConfigSchema = z.object({
  image: z.string(),
  network_mode: z.enum(['none', 'bridge', 'host']).optional(),
  memory_limit: z.string().optional(),
  cpu_limit: z.string().optional(),
  timeout_seconds: z.number().int().min(1).optional(),
  read_only_rootfs: z.boolean().optional(),
  volumes: z
    .array(
      z.object({
        host: z.string(),
        container: z.string(),
        readonly: z.boolean(),
      }),
    )
    .optional(),
});

export const processSandboxConfigSchema = z.object({
  timeout_seconds: z.number().int().min(1),
  max_memory_mb: z.number().int().min(1),
  allowed_binaries: z.array(z.string()),
  working_directory: z.string().optional(),
  env_whitelist: z.array(z.string()).optional(),
});

export const firecrackerSandboxConfigSchema = z.object({
  kernel_image_path: z.string(),
  rootfs_path: z.string(),
  vcpu_count: z.number().int().min(1),
  mem_size_mib: z.number().int().min(128),
  timeout_seconds: z.number().int().min(1),
});

export const sandboxConfigSchema = z.object({
  provider: sandboxProviderSchema,
  enabled: z.boolean(),
  docker: dockerSandboxConfigSchema.optional(),
  process: processSandboxConfigSchema.optional(),
  firecracker: firecrackerSandboxConfigSchema.optional(),
});

// ============================================================================
// Stream Event Schemas
// ============================================================================

export const streamChunkTextSchema = z.object({
  type: z.literal('text_delta'),
  sequence: z.number().int().min(0),
  content: z.string(),
});

export const streamChunkToolCallStartSchema = z.object({
  type: z.literal('tool_call_start'),
  sequence: z.number().int().min(0),
  id: z.string(),
  name: z.string(),
});

export const streamChunkToolCallDeltaSchema = z.object({
  type: z.literal('tool_call_delta'),
  sequence: z.number().int().min(0),
  id: z.string(),
  arguments_delta: z.string(),
});

export const streamChunkToolCallEndSchema = z.object({
  type: z.literal('tool_call_end'),
  sequence: z.number().int().min(0),
  id: z.string(),
  name: z.string(),
  arguments: z.record(z.unknown()),
});

export const streamChunkToolResultSchema = z.object({
  type: z.literal('tool_result'),
  sequence: z.number().int().min(0),
  result: toolResultSchema,
});

export const streamChunkThinkingSchema = z.object({
  type: z.literal('thinking'),
  sequence: z.number().int().min(0),
  content: z.string(),
});

export const streamChunkErrorSchema = z.object({
  type: z.literal('error'),
  sequence: z.number().int().min(0),
  code: z.string(),
  message: z.string(),
  retryable: z.boolean(),
});

export const streamChunkDoneSchema = z.object({
  type: z.literal('done'),
  sequence: z.number().int().min(0),
  token_usage: z.object({
    input_tokens: z.number(),
    output_tokens: z.number(),
    cached_tokens: z.number().optional(),
    reasoning_tokens: z.number().optional(),
    total_tokens: z.number(),
  }),
  finish_reason: z.string(),
});

export const streamChunkMetadataSchema = z.object({
  type: z.literal('metadata'),
  sequence: z.number().int().min(0),
  model: z.string(),
  session_id: z.string(),
  turn_number: z.number().int().min(0),
  timestamp: z.date().or(z.string()),
});

export const streamEventSchema = z.discriminatedUnion('type', [
  streamChunkTextSchema,
  streamChunkToolCallStartSchema,
  streamChunkToolCallDeltaSchema,
  streamChunkToolCallEndSchema,
  streamChunkToolResultSchema,
  streamChunkThinkingSchema,
  streamChunkErrorSchema,
  streamChunkDoneSchema,
  streamChunkMetadataSchema,
]);
