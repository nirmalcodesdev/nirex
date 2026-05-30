/**
 * AI Provider Domain Types
 *
 * Core types for AI model proxying: provider interfaces, chat/embed requests,
 * model routing, streaming contracts, and model information.
 */

import type { ToolCall, ToolDefinition, ToolResult } from '../agent/types.js';
import type { TokenUsage } from '../chat-session/types.js';

// ============================================================================
// Provider Identification
// ============================================================================

export type AIProviderId = 'openai' | 'anthropic' | 'google' | 'local' | 'custom';

// ============================================================================
// Model Capabilities
// ============================================================================

export interface ModelCapabilities {
  supports_tools: boolean;
  supports_streaming: boolean;
  supports_vision: boolean;
  supports_reasoning: boolean;
  supports_json_mode: boolean;
  supports_prompt_caching: boolean;
  max_context_tokens: number;
  max_output_tokens: number;
}

// ============================================================================
// Content Blocks (multimodal messages for provider APIs)
// ============================================================================

export interface TextContentBlock {
  type: 'text';
  text: string;
}

export interface ImageContentBlock {
  type: 'image_url';
  image_url: {
    url: string;
    detail?: 'low' | 'high' | 'auto';
  };
}

export interface OpenAIToolUseContentBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface OpenAIToolResultContentBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export type ProviderContentBlock =
  | TextContentBlock
  | ImageContentBlock
  | OpenAIToolUseContentBlock
  | OpenAIToolResultContentBlock;

// ============================================================================
// Provider API Messages
// ============================================================================

export type ProviderMessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ProviderMessage {
  role: ProviderMessageRole;
  content: string | ProviderContentBlock[];
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

// ============================================================================
// Chat Request / Response
// ============================================================================

export interface ChatRequest {
  model: string;
  messages: ProviderMessage[];
  system?: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  tools?: ToolDefinition[];
  tool_choice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };
  stop?: string[];
  reasoning_effort?: 'low' | 'medium' | 'high';
  metadata?: Record<string, unknown>;
}

export interface ChatResponse {
  id: string;
  model: string;
  provider: AIProviderId;
  content: string;
  role: 'assistant';
  tool_calls?: ToolCall[];
  usage: TokenUsage;
  finish_reason: string;
  created_at: Date;
}

// ============================================================================
// Completion Request / Response
// ============================================================================

export interface CompleteRequest {
  model: string;
  prompt: string;
  suffix?: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stop?: string[];
}

export interface CompleteResponse {
  id: string;
  model: string;
  provider: AIProviderId;
  text: string;
  usage: TokenUsage;
}

// ============================================================================
// Embedding Request / Response
// ============================================================================

export interface EmbedRequest {
  model: string;
  input: string | string[];
  encoding_format?: 'float' | 'base64';
}

export interface EmbedResponse {
  model: string;
  provider: AIProviderId;
  embeddings: number[][];
  usage: TokenUsage;
}

// ============================================================================
// Routing
// ============================================================================

export interface RoutingPreference {
  preferred_provider?: AIProviderId;
  preferred_model?: string;
  min_capabilities?: Partial<ModelCapabilities>;
  max_credits_per_request?: number;
  require_streaming?: boolean;
}

export interface RoutedModel {
  provider_id: AIProviderId;
  model: string;
}

// ============================================================================
// Model Information (for GET /api/ai/models)
// ============================================================================

export type ModelStatus = 'available' | 'degraded' | 'unavailable';

export interface AIModelInfo {
  id: string;
  provider: AIProviderId;
  name: string;
  capabilities: ModelCapabilities;
  credit_cost_per_1k_input_tokens: number;
  credit_cost_per_1k_output_tokens: number;
  status: ModelStatus;
}

// ============================================================================
// Provider Configuration
// ============================================================================

export interface ProviderConfig {
  id: AIProviderId;
  enabled: boolean;
  api_key_env_var: string;
  base_url?: string;
  default_model: string;
  models: string[];
  timeout_ms: number;
  max_retries: number;
  rate_limit_per_minute: number;
  rate_limit_per_day: number;
}

// ============================================================================
// Unified Stream Chunk
// ============================================================================

export type UnifiedStreamChunkType =
  | 'content_delta'
  | 'tool_call_start'
  | 'tool_call_delta'
  | 'tool_call_end'
  | 'tool_call_result'
  | 'tool_call_error'
  | 'reasoning_start'
  | 'reasoning_step'
  | 'completion'
  | 'error'
  | 'metadata';

export interface UnifiedStreamChunk {
  type: UnifiedStreamChunkType;
  sequence: number;
  content?: string;
  id?: string;
  name?: string;
  arguments?: Record<string, unknown>;
  arguments_delta?: string;
  result?: ToolResult;
  token_usage?: TokenUsage;
  finish_reason?: string;
  code?: string;
  message?: string;
  retryable?: boolean;
  model?: string;
  session_id?: string;
  turn_number?: number;
  timestamp?: Date;
}

// ============================================================================
// AI API Error
// ============================================================================

export interface AIApiError {
  status: number;
  code: string;
  message: string;
  provider: AIProviderId;
  retryable: boolean;
  retry_after_ms?: number;
}
