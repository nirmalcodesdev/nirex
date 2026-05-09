import type {
  ApiKeyIdentityResponse,
  CreateApiKeyRequest,
  CreateApiKeyResponse,
  ListApiKeysResponse,
  RevokeApiKeyRequest,
  RotateApiKeyRequest,
  RotateApiKeyResponse,
} from "@nirex/shared";
import { dataOrThrow, request } from "../../lib/backendApi";

const API_KEYS_BASE = "/api-keys";

export const apiKeysApi = {
  async list(): Promise<ListApiKeysResponse> {
    const payload = await request<ListApiKeysResponse>(API_KEYS_BASE, {
      method: "GET",
    });
    return dataOrThrow(payload, "API_KEYS_LIST_FAILED");
  },

  async create(input: CreateApiKeyRequest): Promise<CreateApiKeyResponse> {
    const payload = await request<CreateApiKeyResponse>(API_KEYS_BASE, {
      method: "POST",
      body: input,
    });
    return dataOrThrow(payload, "API_KEY_CREATE_FAILED");
  },

  async rotate(keyId: string, input: RotateApiKeyRequest = {}): Promise<RotateApiKeyResponse> {
    const payload = await request<RotateApiKeyResponse>(
      `${API_KEYS_BASE}/${encodeURIComponent(keyId)}/rotate`,
      {
        method: "POST",
        body: input,
      },
    );
    return dataOrThrow(payload, "API_KEY_ROTATE_FAILED");
  },

  async revoke(keyId: string, input: RevokeApiKeyRequest = {}): Promise<string | undefined> {
    const payload = await request<void>(`${API_KEYS_BASE}/${encodeURIComponent(keyId)}`, {
      method: "DELETE",
      body: input,
    });
    return payload.message;
  },

  async self(): Promise<ApiKeyIdentityResponse> {
    const payload = await request<ApiKeyIdentityResponse>(`${API_KEYS_BASE}/self`, {
      method: "GET",
    });
    return dataOrThrow(payload, "INVALID_API_KEY");
  },
};
