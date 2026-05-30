/**
 * AI Domain
 *
 * Types, interfaces, and schemas for AI provider proxying and model routing.
 */

export type {
  AIProviderId,
  ModelCapabilities,
  TextContentBlock,
  ImageContentBlock,
  OpenAIToolUseContentBlock,
  OpenAIToolResultContentBlock,
  ProviderContentBlock,
  ProviderMessageRole,
  ProviderMessage,
  ChatRequest,
  ChatResponse,
  CompleteRequest,
  CompleteResponse,
  EmbedRequest,
  EmbedResponse,
  RoutingPreference,
  RoutedModel,
  ModelStatus,
  AIModelInfo,
  ProviderConfig,
  UnifiedStreamChunkType,
  UnifiedStreamChunk,
  AIApiError,
} from './types.js';

export {
  aiProviderIdSchema,
  modelCapabilitiesSchema,
  textContentBlockSchema,
  imageContentBlockSchema,
  openAIToolUseContentBlockSchema,
  openAIToolResultContentBlockSchema,
  providerContentBlockSchema,
  providerMessageRoleSchema,
  providerMessageSchema,
  chatRequestSchema,
  completeRequestSchema,
  embedRequestSchema,
  routingPreferenceSchema,
  modelStatusSchema,
  aiModelInfoSchema,
  providerConfigSchema,
  unifiedStreamChunkTypeSchema,
  unifiedStreamChunkSchema,
  aiChatRequestSchema,
  aiChatQuerySchema,
  type AiChatQuerySchema,
} from './schemas.js';
