/**
 * Stream Normalizer
 *
 * Converts provider-specific SSE chunks into a unified StreamEvent format.
 *
 * The existing StreamEvent types from @nirex/shared are reused here as the
 * unified output format. Each provider yields UnifiedStreamChunk objects
 * from their chatStream method, and this normalizer passes them through
 * (they are already in the unified format).
 *
 * This module exists as the centralized point where future provider-specific
 * format conversions would be implemented. For now, providers directly emit
 * UnifiedStreamChunk types.
 */

import type { StreamEvent, UnifiedStreamChunk, AIProviderId } from '@nirex/shared';

export function normalizeChunk(
  chunk: UnifiedStreamChunk,
  providerId: AIProviderId,
): StreamEvent {
  const base = {
    sequence: chunk.sequence,
  };

  switch (chunk.type) {
    case 'content_delta':
      return {
        ...base,
        type: 'text_delta',
        content: chunk.content || '',
      } as StreamEvent;

    case 'tool_call_start':
      return {
        ...base,
        type: 'tool_call_start',
        id: chunk.id || '',
        name: chunk.name || '',
      } as StreamEvent;

    case 'tool_call_delta':
      return {
        ...base,
        type: 'tool_call_delta',
        id: chunk.id || '',
        arguments_delta: chunk.arguments_delta || '',
      } as StreamEvent;

    case 'tool_call_end':
      return {
        ...base,
        type: 'tool_call_end',
        id: chunk.id || '',
        name: chunk.name || '',
        arguments: chunk.arguments || {},
      } as StreamEvent;

    case 'tool_call_result':
      return {
        ...base,
        type: 'tool_result',
        result: chunk.result || { id: '', tool_call_id: '', content: '', is_error: false },
      } as StreamEvent;

    case 'tool_call_error':
      return {
        ...base,
        type: 'error',
        code: chunk.code || 'TOOL_ERROR',
        message: chunk.message || 'Unknown tool error',
        retryable: chunk.retryable ?? false,
      } as StreamEvent;

    case 'reasoning_start':
    case 'reasoning_step':
      return {
        ...base,
        type: 'thinking',
        content: chunk.content || '',
      } as StreamEvent;

    case 'completion':
      return {
        ...base,
        type: 'done',
        token_usage: chunk.token_usage || {
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: 0,
        },
        finish_reason: chunk.finish_reason || 'stop',
      } as StreamEvent;

    case 'error':
      return {
        ...base,
        type: 'error',
        code: chunk.code || 'PROVIDER_ERROR',
        message: chunk.message || 'Unknown error',
        retryable: chunk.retryable ?? false,
      } as StreamEvent;

    case 'metadata':
      return {
        ...base,
        type: 'metadata',
        model: chunk.model || '',
        session_id: chunk.session_id || '',
        turn_number: chunk.turn_number ?? 0,
        timestamp: chunk.timestamp || new Date(),
      } as StreamEvent;

    default:
      return {
        ...base,
        type: 'text_delta',
        content: `[unknown chunk type: ${chunk.type}]`,
      } as StreamEvent;
  }
}

export function normalizeChunkToSSE(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}
