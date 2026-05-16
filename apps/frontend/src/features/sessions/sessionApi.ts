import type {
  ListSessionsQuery,
  ListChatSessionsResponse,
  GetSessionQuery,
  GetSessionResponse,
  CreateSessionRequest,
  CreateSessionResponse,
  UpdateSessionRequest,
  UpdateSessionResponse,
  DeleteChatSessionResponse,
  AddMessageRequest,
  AddMessageResponse,
  ClearSessionRequest,
  ClearSessionResponse,
  ExportFormat,
  ForkSessionRequest,
  ForkSessionResponse,
  ResumeSessionRequest,
  ResumeSessionResponse,
  ListCheckpointsResponse,
  SearchMessagesQuery,
  SearchMessagesResponse,
  SessionStatsResponse,
} from "@nirex/shared";
import {
  API_BASE_URL,
  BackendApiError,
  type BackendResponse,
  dataOrThrow,
  request,
} from "../../lib/backendApi";

const SESSIONS_BASE = "/sessions";

function sessionRequest<T>(path: string, options?: Omit<RequestInit, "body"> & { body?: unknown }) {
  return request<T>(`${SESSIONS_BASE}${path}`, options);
}

function parseContentDispositionFileName(disposition: string | null): string | null {
  if (!disposition) return null;

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const basicMatch = disposition.match(/filename="?([^";]+)"?/i);
  return basicMatch?.[1] ?? null;
}

async function parseJsonSafely<T>(response: Response): Promise<BackendResponse<T> | null> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as BackendResponse<T>;
  } catch {
    return null;
  }
}

export interface SessionExportResult {
  blob: Blob;
  fileName: string;
  contentType: string;
}

export const sessionApi = {
  async listSessions(query?: ListSessionsQuery): Promise<ListChatSessionsResponse> {
    const params = new URLSearchParams();
    if (query) {
      if (query.page) params.append("page", query.page.toString());
      if (query.limit) params.append("limit", query.limit.toString());
      if (query.include_archived) params.append("include_archived", "true");
      if (query.archived_only) params.append("archived_only", "true");
      if (query.working_directory_hash) params.append("working_directory_hash", query.working_directory_hash);
      if (query.q) params.append("q", query.q);
      if (query.model) params.append("model", query.model);
      if (query.parent_session_id) params.append("parent_session_id", query.parent_session_id);
      if (query.root_session_id) params.append("root_session_id", query.root_session_id);
      if (query.sort_by) params.append("sort_by", query.sort_by);
      if (query.sort_order) params.append("sort_order", query.sort_order);
    }

    const queryString = params.toString();
    const path = queryString ? `?${queryString}` : "";

    const payload = await sessionRequest<ListChatSessionsResponse>(path, {
      method: "GET",
    });
    return dataOrThrow(payload, "SESSIONS_LOAD_FAILED");
  },

  async getSession(id: string, query?: GetSessionQuery): Promise<GetSessionResponse> {
    const params = new URLSearchParams();
    if (query) {
      if (query.page) params.append("page", query.page.toString());
      if (query.limit) params.append("limit", query.limit.toString());
    }

    const queryString = params.toString();
    const path = `/${id}${queryString ? `?${queryString}` : ""}`;

    const payload = await sessionRequest<GetSessionResponse>(path, {
      method: "GET",
    });
    return dataOrThrow(payload, "SESSION_LOAD_FAILED");
  },

  async createSession(input: CreateSessionRequest): Promise<CreateSessionResponse> {
    const payload = await sessionRequest<CreateSessionResponse>("", {
      method: "POST",
      body: input,
    });
    return dataOrThrow(payload, "SESSION_CREATE_FAILED");
  },

  async updateSession(id: string, input: UpdateSessionRequest): Promise<UpdateSessionResponse> {
    const payload = await sessionRequest<UpdateSessionResponse>(`/${id}`, {
      method: "PATCH",
      body: input,
    });
    return dataOrThrow(payload, "SESSION_UPDATE_FAILED");
  },

  async deleteSession(id: string): Promise<DeleteChatSessionResponse> {
    const payload = await sessionRequest<DeleteChatSessionResponse>(`/${id}`, {
      method: "DELETE",
    });
    return dataOrThrow(payload, "SESSION_DELETE_FAILED");
  },

  async resumeSession(id: string, input: ResumeSessionRequest = {}): Promise<ResumeSessionResponse> {
    const payload = await sessionRequest<ResumeSessionResponse>(`/${id}/resume`, {
      method: "POST",
      body: input,
    });
    return dataOrThrow(payload, "SESSION_RESUME_FAILED");
  },

  async forkSession(id: string, input: ForkSessionRequest = {}): Promise<ForkSessionResponse> {
    const payload = await sessionRequest<ForkSessionResponse>(`/${id}/fork`, {
      method: "POST",
      body: input,
    });
    return dataOrThrow(payload, "SESSION_FORK_FAILED");
  },

  async clearSession(id: string, input: ClearSessionRequest = {}): Promise<ClearSessionResponse> {
    const payload = await sessionRequest<ClearSessionResponse>(`/${id}/clear`, {
      method: "POST",
      body: input,
    });
    return dataOrThrow(payload, "SESSION_CLEAR_FAILED");
  },

  async listCheckpoints(id: string, query?: { page?: number; limit?: number }): Promise<ListCheckpointsResponse> {
    const params = new URLSearchParams();
    if (query?.page) params.append("page", query.page.toString());
    if (query?.limit) params.append("limit", query.limit.toString());

    const queryString = params.toString();
    const payload = await sessionRequest<ListCheckpointsResponse>(
      `/${id}/checkpoints${queryString ? `?${queryString}` : ""}`,
      { method: "GET" }
    );
    return dataOrThrow(payload, "CHECKPOINTS_LOAD_FAILED");
  },

  async exportSession(id: string, format: ExportFormat = "json"): Promise<SessionExportResult> {
    const params = new URLSearchParams({ format });
    const response = await fetch(`${API_BASE_URL}${SESSIONS_BASE}/${id}/export?${params.toString()}`, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: format === "markdown" ? "text/markdown,application/json,*/*" : "application/json,text/plain,*/*",
      },
    });

    if (!response.ok) {
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const payload = await parseJsonSafely<unknown>(response);
        const message = payload?.error?.message ?? payload?.message ?? "Export request failed.";
        const code = payload?.error?.code ?? payload?.code;
        const details = payload?.error?.details ?? payload?.errors;
        throw new BackendApiError(message, response.status, code, details);
      }

      const message = await response.text();
      throw new BackendApiError(message || "Export request failed.", response.status, "SESSION_EXPORT_FAILED");
    }

    const blob = await response.blob();
    const extension = format === "markdown" ? "md" : "json";
    const fileName =
      parseContentDispositionFileName(response.headers.get("content-disposition")) ??
      `session-${id}.${extension}`;

    return {
      blob,
      fileName,
      contentType: response.headers.get("content-type") ?? blob.type ?? "application/octet-stream",
    };
  },

  async getStats(): Promise<SessionStatsResponse> {
    const payload = await sessionRequest<SessionStatsResponse>("/stats", {
      method: "GET",
    });
    return dataOrThrow(payload, "STATS_LOAD_FAILED");
  },

  async addMessage(sessionId: string, input: AddMessageRequest): Promise<AddMessageResponse> {
    const payload = await sessionRequest<AddMessageResponse>(`/${sessionId}/messages`, {
      method: "POST",
      body: input,
    });
    return dataOrThrow(payload, "MESSAGE_ADD_FAILED");
  },

  async searchMessages(query: SearchMessagesQuery): Promise<SearchMessagesResponse> {
    const params = new URLSearchParams();
    params.append("q", query.q);
    if (query.session_id) params.append("session_id", query.session_id);
    if (query.page) params.append("page", query.page.toString());
    if (query.limit) params.append("limit", query.limit.toString());
    if (query.role) params.append("role", query.role);
    if (query.date_from) params.append("date_from", query.date_from.toISOString());
    if (query.date_to) params.append("date_to", query.date_to.toISOString());

    const payload = await sessionRequest<SearchMessagesResponse>(`/search?${params.toString()}`, {
      method: "GET",
    });
    return dataOrThrow(payload, "SEARCH_FAILED");
  },
};
