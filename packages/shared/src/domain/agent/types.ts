/**
 * Agent Domain Types
 *
 * Core types for the Nirex AI coding agent: tool definitions, agent state,
 * permission rules, hooks, sandbox configuration, and streaming events.
 */

import type { ChatMessage, MessageRole, TokenUsage } from '../chat-session/types.js';

// ============================================================================
// Tool System Types
// ============================================================================

export interface JsonSchemaProperty {
  type?: string;
  description?: string;
  enum?: string[];
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  default?: unknown;
}

export interface ToolParameterSchema {
  type: 'object';
  properties: Record<string, JsonSchemaProperty>;
  required?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  id: string;
  tool_call_id: string;
  content: string;
  is_error: boolean;
  metadata?: Record<string, unknown>;
}

export type ToolCategory =
  | 'file'
  | 'bash'
  | 'git'
  | 'lsp'
  | 'web'
  | 'sandbox'
  | 'custom';

export interface ToolRegistration {
  definition: ToolDefinition;
  category: ToolCategory;
  executor: string;
  requires_approval: boolean;
  is_destructive: boolean;
}

// ============================================================================
// Agent State Machine
// ============================================================================

export type AgentStatus =
  | 'idle'
  | 'thinking'
  | 'executing'
  | 'responding'
  | 'waiting_permission'
  | 'error'
  | 'cancelled';

export interface AgentState {
  session_id: string;
  status: AgentStatus;
  turn_number: number;
  model: string;
  token_usage: TokenUsage;
  messages: AgentMessage[];
  pending_tool_calls: ToolCall[];
  pending_permissions: PermissionRequest[];
  context_summary?: string;
  checkpoint_id?: string;
  metadata?: Record<string, unknown>;
  started_at: Date;
  updated_at: Date;
}

export interface AgentTurn {
  sequence_number: number;
  user_message?: AgentMessage;
  assistant_message?: AgentMessage;
  tool_calls: ToolCall[];
  tool_results: ToolResult[];
  token_usage: TokenUsage;
  started_at: Date;
  completed_at?: Date;
  error?: string;
}

// ============================================================================
// Agent Message Types
// ============================================================================

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResultBlock {
  type: 'tool_result';
  id: string;
  tool_call_id: string;
  content: string;
  is_error: boolean;
}

export interface ThinkingBlock {
  type: 'thinking';
  content: string;
}

export interface TextBlock {
  type: 'text';
  content: string;
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock | ThinkingBlock;

export interface AgentMessage extends Omit<ChatMessage, 'content'> {
  content: string | ContentBlock[];
  role: MessageRole | 'tool';
  client_message_id?: string;
  provider_message_id?: string;
}

// ============================================================================
// Permission System Types
// ============================================================================

export type PermissionAction = 'allow' | 'deny' | 'ask';

export interface PermissionRule {
  id: string;
  tool_name: string;
  action: PermissionAction;
  pattern?: string;
  description?: string;
  expires_at?: Date;
  created_at: Date;
}

export interface PermissionRequest {
  id: string;
  tool_call: ToolCall;
  tool_definition: ToolDefinition;
  is_destructive: boolean;
  reason?: string;
}

export interface PermissionResponse {
  request_id: string;
  action: PermissionAction;
  remember?: boolean;
  reason?: string;
}

export interface PermissionConfig {
  default_action: PermissionAction;
  rules: PermissionRule[];
  auto_allow_list: string[];
  auto_deny_list: string[];
  ask_timeout_ms: number;
}

// ============================================================================
// Hook System Types
// ============================================================================

export type HookEventType =
  | 'pre_tool_execute'
  | 'post_tool_execute'
  | 'pre_llm_call'
  | 'post_llm_call'
  | 'session_start'
  | 'session_end'
  | 'turn_start'
  | 'turn_end'
  | 'permission_request'
  | 'error'
  | 'file_changed';

export interface HookEvent {
  type: HookEventType;
  session_id?: string;
  timestamp: Date;
  data: Record<string, unknown>;
}

export interface HookDefinition {
  id: string;
  event: HookEventType;
  command: string;
  timeout_ms: number;
  enabled: boolean;
}

// ============================================================================
// Sandbox Configuration
// ============================================================================

export type SandboxProvider = 'docker' | 'firecracker' | 'process' | 'wasm';

export interface DockerSandboxConfig {
  image: string;
  network_mode?: 'none' | 'bridge' | 'host';
  memory_limit?: string;
  cpu_limit?: string;
  timeout_seconds?: number;
  read_only_rootfs?: boolean;
  volumes?: Array<{ host: string; container: string; readonly: boolean }>;
}

export interface ProcessSandboxConfig {
  timeout_seconds: number;
  max_memory_mb: number;
  allowed_binaries: string[];
  working_directory?: string;
  env_whitelist?: string[];
}

export interface FirecrackerSandboxConfig {
  kernel_image_path: string;
  rootfs_path: string;
  vcpu_count: number;
  mem_size_mib: number;
  timeout_seconds: number;
}

export interface SandboxConfig {
  provider: SandboxProvider;
  enabled: boolean;
  docker?: DockerSandboxConfig;
  process?: ProcessSandboxConfig;
  firecracker?: FirecrackerSandboxConfig;
}

// ============================================================================
// SSE Streaming Contract
// ============================================================================

export interface StreamChunkText {
  type: 'text_delta';
  sequence: number;
  content: string;
}

export interface StreamChunkToolCallStart {
  type: 'tool_call_start';
  sequence: number;
  id: string;
  name: string;
}

export interface StreamChunkToolCallDelta {
  type: 'tool_call_delta';
  sequence: number;
  id: string;
  arguments_delta: string;
}

export interface StreamChunkToolCallEnd {
  type: 'tool_call_end';
  sequence: number;
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface StreamChunkToolResult {
  type: 'tool_result';
  sequence: number;
  result: ToolResult;
}

export interface StreamChunkThinking {
  type: 'thinking';
  sequence: number;
  content: string;
}

export interface StreamChunkError {
  type: 'error';
  sequence: number;
  code: string;
  message: string;
  retryable: boolean;
}

export interface StreamChunkDone {
  type: 'done';
  sequence: number;
  token_usage: TokenUsage;
  finish_reason: string;
}

export interface StreamChunkMetadata {
  type: 'metadata';
  sequence: number;
  model: string;
  session_id: string;
  turn_number: number;
  timestamp: Date;
}

export type StreamEvent =
  | StreamChunkText
  | StreamChunkToolCallStart
  | StreamChunkToolCallDelta
  | StreamChunkToolCallEnd
  | StreamChunkToolResult
  | StreamChunkThinking
  | StreamChunkError
  | StreamChunkDone
  | StreamChunkMetadata;
