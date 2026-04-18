/**
 * Common Helpers
 *
 * Utility functions for creating standardized API responses.
 */

import type { ApiResponse, ApiError, PaginatedResponse, ResponseMeta } from './types.js';

// ============================================================================
// API Response Helpers
// ============================================================================

/**
 * Creates a standardized success response
 */
export function createApiResponse<T>(
  data: T,
  message?: string,
  meta?: Partial<ResponseMeta>
): ApiResponse<T> {
  return {
    status: 'success',
    message,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };
}

/**
 * Creates a standardized error response
 */
export function createApiError(
  code: string,
  message: string,
  details?: Record<string, string[]>
): ApiResponse<never> {
  const error: ApiError = {
    code,
    message,
    details,
  };

  return {
    status: 'error',
    error,
    meta: {
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Creates a paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): ApiResponse<PaginatedResponse<T>> {
  const totalPages = Math.ceil(total / limit);

  return createApiResponse({
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  });
}

// ============================================================================
// Pagination Helpers
// ============================================================================

/**
 * Calculates pagination offset
 */
export function getOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}

/**
 * Validates and normalizes pagination parameters
 */
export function normalizePagination(
  page: number | undefined,
  limit: number | undefined,
  defaults: { defaultPage: number; defaultLimit: number; maxLimit: number }
): { page: number; limit: number; offset: number } {
  const normalizedPage = Math.max(1, page ?? defaults.defaultPage);
  const normalizedLimit = Math.min(
    defaults.maxLimit,
    Math.max(1, limit ?? defaults.defaultLimit)
  );

  return {
    page: normalizedPage,
    limit: normalizedLimit,
    offset: getOffset(normalizedPage, normalizedLimit),
  };
}
