/**
 * API Client Utility
 *
 * HTTP client wrapper for communicating with the Nirex backend API.
 * Extracted from the CLI index.ts for reuse across commands.
 */

export interface ApiResponsePayload<TData = unknown> {
  status?: string;
  message?: string;
  code?: string;
  data?: TData;
}

export interface ApiCallResult<TData = unknown> {
  httpStatus: number;
  payload: ApiResponsePayload<TData>;
}

export function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function formatDate(date: Date | null): string {
  return date ? date.toISOString() : 'n/a';
}

export function normalizeBaseUrl(input: string): string {
  return input.replace(/\/+$/, '');
}

export async function callApi<TData = unknown>(input: {
  url: string;
  apiKey: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: Record<string, unknown>;
  timeoutMs: number;
}): Promise<ApiCallResult<TData>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

  try {
    const response = await fetch(input.url, {
      method: input.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        'x-api-key': input.apiKey,
        ...(input.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: input.body ? JSON.stringify(input.body) : undefined,
      signal: controller.signal,
    });

    const raw = await response.text();
    let payload: ApiResponsePayload<TData> = {};
    if (raw.trim().length > 0) {
      try {
        payload = JSON.parse(raw) as ApiResponsePayload<TData>;
      } catch {
        payload = {
          status: 'error',
          message: `Non-JSON response body: ${raw.slice(0, 240)}`,
        };
      }
    }

    return {
      httpStatus: response.status,
      payload,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function resolveErrorCode(payload: ApiResponsePayload): string | null {
  if (typeof payload.code === 'string') return payload.code;
  return null;
}
