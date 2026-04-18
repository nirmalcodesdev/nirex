/**
 * Common Types
 *
 * Shared types that are used across multiple domains and applications.
 */

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Standard API response wrapper
 * Used for consistent API responses across all endpoints
 */
export interface ApiResponse<T = unknown> {
  status: 'success' | 'error';
  message?: string;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

/**
 * API error structure
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
  stack?: string; // Only in development
}

/**
 * Response metadata for pagination, caching, etc.
 */
export interface ResponseMeta {
  timestamp: string;
  requestId?: string;
  version?: string;
}

// ============================================================================
// Pagination Types
// ============================================================================

/**
 * Pagination parameters for list requests
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  cursor?: string;
}

/**
 * Sort direction for ordering results
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Sort configuration
 */
export interface SortConfig {
  field: string;
  direction: SortDirection;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Cursor-based paginated response
 * More efficient for large datasets
 */
export interface CursorPaginatedResponse<T> {
  data: T[];
  pagination: {
    nextCursor?: string;
    prevCursor?: string;
    hasNext: boolean;
    hasPrev: boolean;
    limit: number;
  };
}

// ============================================================================
// Date & Time Types
// ============================================================================

/**
 * Date range for filtering
 */
export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * ISO 8601 date string type
 */
export type ISODateString = string;

/**
 * Timestamp in milliseconds
 */
export type Timestamp = number;

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Nullable type shorthand
 */
export type Nullable<T> = T | null;

/**
 * Optional type shorthand
 */
export type Optional<T> = T | undefined;

/**
 * Deep partial type - makes all properties optional recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Deep readonly type - makes all properties readonly recursively
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/**
 * Entity with timestamps
 */
export interface Timestamped {
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Entity with soft delete
 */
export interface SoftDeletable {
  deletedAt?: Date;
  isDeleted: boolean;
}

/**
 * Entity with ID
 */
export interface Identifiable {
  id: string;
}

/**
 * Base entity combining common fields
 */
export interface BaseEntity extends Identifiable, Timestamped {}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Application environment
 */
export type Environment = 'development' | 'staging' | 'production' | 'test';

/**
 * Log level
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Feature flag configuration
 */
export interface FeatureFlags {
  [key: string]: boolean;
}
