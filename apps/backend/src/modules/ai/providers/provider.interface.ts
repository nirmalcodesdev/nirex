/**
 * AI Provider Interface
 *
 * Defines the contract every AI provider must implement.
 * Maps to the AIProvider interface described in PRODUCTION_CLI_PLAN.md 1.1.
 */

import type {
  ChatRequest,
  ChatResponse,
  CompleteRequest,
  CompleteResponse,
  EmbedRequest,
  EmbedResponse,
  AIProviderId,
  UnifiedStreamChunk,
} from '@nirex/shared';

export interface AIProvider {
  readonly id: AIProviderId;
  readonly name: string;
  readonly models: string[];
  readonly defaultModel: string;

  chat(request: ChatRequest): Promise<ChatResponse>;
  chatStream(request: ChatRequest): AsyncIterable<UnifiedStreamChunk>;
  complete(request: CompleteRequest): Promise<CompleteResponse>;
  embed(request: EmbedRequest): Promise<EmbedResponse>;
  tokenCount(text: string, model: string): number;
  healthCheck(): Promise<boolean>;
  listModels(): Promise<string[]>;
}
