/**
 * Chat Session Module
 *
 * Complete module for managing AI conversation sessions.
 * Includes models, repository, service, controller, and routes.
 */

// Models
export {
  ChatSessionModel,
  type IChatSessionDocument,
} from './chat-session.model.js';

export {
  MessageModel,
  type IMessageDocument,
} from './message.model.js';

export {
  SessionCheckpointModel,
  type ISessionCheckpointDocument,
} from './session-checkpoint.model.js';

export {
  ArchivedMessagesModel,
  type IArchivedMessagesDocument,
} from './archived-messages.model.js';

// Repository
export {
  chatSessionRepository,
  type CreateChatSessionData,
  type UpdateChatSessionData,
  type ListSessionsFilters,
  type PaginatedResult,
  type MessagesPaginationResult,
} from './chat-session.repository.js';

export {
  messageRepository,
  type CreateMessageData,
  type UpdateMessageData,
  type MessageFilters,
} from './message.repository.js';

export {
  sessionCheckpointRepository,
  type CreateCheckpointData,
} from './session-checkpoint.repository.js';

export {
  archivedMessagesRepository,
  type CreateArchiveData,
} from './archived-messages.repository.js';

// Services
export {
  chatSessionService,
  ChatSessionService,
  hashWorkingDirectory,
  generateSessionName,
} from './chat-session.service.js';

export { tokenPricingService } from './token-pricing.service.js';
export { sseManager } from './sse.manager.js';
export { chatSessionCache, CACHE_PREFIXES, CACHE_TTL } from './chat-session.cache.js';

// Validation
export {
  validateMessageContent,
  validateMetadata,
  validateSessionName,
  validateWorkingDirectory,
  assertValidMessageContent,
  assertValidMetadata,
  assertValidWorkingDirectory,
} from './content-validator.js';

// Controller
export * as chatSessionController from './chat-session.controller.js';

// Routes
export { default as chatSessionRoutes } from './chat-session.routes.js';
