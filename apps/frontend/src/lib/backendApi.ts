export const API_BASE_URL = String(
  import.meta.env.VITE_API_URL ?? "http://localhost:3001/api/v1",
).replace(/\/+$/, "");

export type BackendResponse<T> = {
  status: "success" | "fail" | "error";
  message?: string;
  data?: T;
  code?: string;
  errors?: Record<string, string>;
  error?: {
    code?: string;
    message?: string;
    details?: Record<string, string[]>;
  };
};

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

export class BackendApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: Record<string, string> | Record<string, string[]>;

  constructor(
    message: string,
    status: number,
    code?: string,
    details?: Record<string, string> | Record<string, string[]>,
  ) {
    super(message);
    this.name = "BackendApiError";
    this.status = status;
    if (code) this.code = code;
    if (details) this.details = details;
  }
}

function createHeaders(body: unknown): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}

async function parseJson<T>(response: Response): Promise<BackendResponse<T> | null> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as BackendResponse<T>;
  } catch {
    throw new BackendApiError(
      "The server returned an invalid response.",
      response.status,
      "INVALID_RESPONSE",
    );
  }
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<BackendResponse<T>> {
  const { body, ...init } = options;
  const requestInit: RequestInit = {
    ...init,
    credentials: "include",
    headers: {
      ...createHeaders(body),
      ...init.headers,
    },
  };

  if (body !== undefined) {
    requestInit.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, requestInit);
  const payload = await parseJson<T>(response);

  if (!response.ok) {
    const message = payload?.error?.message ?? payload?.message ?? "Request failed.";
    const code = payload?.error?.code ?? payload?.code;
    const details = payload?.error?.details ?? payload?.errors;
    throw new BackendApiError(message, response.status, code, details);
  }

  if (!payload) {
    return { status: "success" };
  }

  if (payload.status !== "success") {
    const message = payload.error?.message ?? payload.message ?? "Request failed.";
    const code = payload.error?.code ?? payload.code;
    const details = payload.error?.details ?? payload.errors;
    throw new BackendApiError(message, response.status, code, details);
  }

  return payload;
}

export function dataOrThrow<T>(payload: BackendResponse<T>, fallbackCode: string): T {
  if (payload.data === undefined) {
    throw new BackendApiError(
      "The server response was missing required data.",
      502,
      fallbackCode,
    );
  }

  return payload.data;
}
