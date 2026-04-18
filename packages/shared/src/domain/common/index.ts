/**
 * Common Domain
 *
 * Shared types, helpers, and utilities used across multiple domains.
 */

export type {
  ApiResponse,
  ApiError,
  ResponseMeta,
  PaginationParams,
  SortDirection,
  SortConfig,
  PaginatedResponse,
  CursorPaginatedResponse,
  DateRange,
  ISODateString,
  Timestamp,
  Nullable,
  Optional,
  DeepPartial,
  DeepReadonly,
  Timestamped,
  SoftDeletable,
  Identifiable,
  BaseEntity,
  Environment,
  LogLevel,
  FeatureFlags,
} from './types.js';

export {
  createApiResponse,
  createApiError,
  createPaginatedResponse,
  getOffset,
  normalizePagination,
} from './helpers.js';
