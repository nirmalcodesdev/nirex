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
  SearchMessagesQuery,
  SearchMessagesResponse,
  SessionStatsResponse,
} from "@nirex/shared";
import {
  dataOrThrow,
  request,
} from "../../lib/backendApi";

const SESSIONS_BASE = "/sessions";

function sessionRequest<T>(path: string, options?: Omit<RequestInit, "body"> & { body?: unknown }) {
  return request<T>(`${SESSIONS_BASE}${path}`, options);
}

export const sessionApi = {
  async listSessions(query?: ListSessionsQuery): Promise<ListChatSessionsResponse> {
    const params = new URLSearchParams();
    if (query) {
      if (query.page) params.append("page", query.page.toString());
      if (query.limit) params.append("limit", query.limit.toString());
      if (query.include_archived) params.append("include_archived", "true");
      if (query.working_directory_hash) params.append("working_directory_hash", query.working_directory_hash);
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

    const payload = await sessionRequest<SearchMessagesResponse>(`/search?${params.toString()}`, {
      method: "GET",
    });
    return dataOrThrow(payload, "SEARCH_FAILED");
  },
};
