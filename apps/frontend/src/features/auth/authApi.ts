import type {
  AuthErrorCode,
  CheckAuthResponse,
  ForgotPasswordRequest,
  GetMeResponse,
  ListSessionsResponse,
  OAuthUrlResponse,
  ProviderType,
  ResetPasswordRequest,
  SessionDTO,
  SignInRequest,
  SignUpRequest,
  SignUpResponse,
  ChangePasswordRequest,
  TerminateDevicesRequest,
  TerminateDevicesResponse,
  TwoFactorStatusResponse,
  BeginTwoFactorSetupResponse,
  VerifyTwoFactorSetupResponse,
  UpdateProfileRequest,
  UpdateProfileResponse,
} from "@nirex/shared";

const rawBaseUrl =
  import.meta.env.VITE_API_URL ??
  "http://localhost:3001/api/v1";

export const API_BASE_URL = String(rawBaseUrl).replace(/\/+$/, "");
const AUTH_BASE = "/auth";

type BackendResponse<T> = {
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

export class AuthApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: Record<string, string> | Record<string, string[]>;

  constructor(message: string, status: number, code?: string, details?: Record<string, string> | Record<string, string[]>) {
    super(message);
    this.name = "AuthApiError";
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
    throw new AuthApiError("The server returned an invalid response.", response.status, "INVALID_RESPONSE");
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<BackendResponse<T>> {
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

  const response = await fetch(`${API_BASE_URL}${AUTH_BASE}${path}`, requestInit);

  const payload = await parseJson<T>(response);

  if (!response.ok) {
    const message = payload?.error?.message ?? payload?.message ?? "Request failed.";
    const code = payload?.error?.code ?? payload?.code;
    const details = payload?.error?.details ?? payload?.errors;
    throw new AuthApiError(message, response.status, code, details);
  }

  if (!payload) {
    return { status: "success" };
  }

  if (payload.status !== "success") {
    const message = payload.error?.message ?? payload.message ?? "Request failed.";
    const code = payload.error?.code ?? payload.code;
    const details = payload.error?.details ?? payload.errors;
    throw new AuthApiError(message, response.status, code, details);
  }

  return payload;
}

function dataOrThrow<T>(payload: BackendResponse<T>, fallbackCode: AuthErrorCode): T {
  if (payload.data === undefined) {
    throw new AuthApiError("The server response was missing required data.", 502, fallbackCode);
  }

  return payload.data;
}

export type SignInPayload = SignInRequest & {
  twoFactorCode?: string;
  rememberMe?: boolean;
};

export const authApi = {
  async signUp(input: SignUpRequest): Promise<SignUpResponse> {
    const payload = await request<SignUpResponse>("/sign-up", {
      method: "POST",
      body: input,
    });
    return dataOrThrow(payload, "SIGNUP_FAILED");
  },

  async signIn(input: SignInPayload): Promise<void> {
    await request<void>("/sign-in", {
      method: "POST",
      body: input,
    });
  },

  async refresh(): Promise<void> {
    await request<void>("/refresh", {
      method: "POST",
    });
  },

  async check(): Promise<CheckAuthResponse> {
    const payload = await request<CheckAuthResponse>("/check", {
      method: "GET",
    });
    return dataOrThrow(payload, "UNAUTHENTICATED");
  },

  async me(): Promise<GetMeResponse> {
    const payload = await request<GetMeResponse>("/me", {
      method: "GET",
    });
    return dataOrThrow(payload, "UNAUTHENTICATED");
  },

  async signOut(): Promise<void> {
    await request<void>("/sign-out", {
      method: "POST",
    });
  },

  async signOutAll(): Promise<void> {
    await request<void>("/sign-out-all", {
      method: "POST",
    });
  },

  async changePassword(input: ChangePasswordRequest): Promise<string | undefined> {
    const payload = await request<void>("/change-password", {
      method: "POST",
      body: input,
    });
    return payload.message;
  },

  async forgotPassword(input: ForgotPasswordRequest): Promise<string | undefined> {
    const payload = await request<void>("/forgot-password", {
      method: "POST",
      body: input,
    });
    return payload.message;
  },

  async resetPassword(input: ResetPasswordRequest): Promise<string | undefined> {
    const payload = await request<void>("/reset-password", {
      method: "POST",
      body: input,
    });
    return payload.message;
  },

  async verifyEmail(token: string): Promise<string | undefined> {
    const payload = await request<void>(`/verify-email?${new URLSearchParams({ token }).toString()}`, {
      method: "GET",
    });
    return payload.message;
  },

  async updateProfile(input: UpdateProfileRequest): Promise<UpdateProfileResponse> {
    const payload = await request<UpdateProfileResponse>("/profile", {
      method: "PATCH",
      body: input,
    });
    return dataOrThrow(payload, "PROFILE_UPDATE_FAILED");
  },

  async listSessions(): Promise<ListSessionsResponse> {
    const payload = await request<ListSessionsResponse>("/sessions", {
      method: "GET",
    });
    return dataOrThrow(payload, "UNAUTHENTICATED");
  },

  async listDevices(): Promise<SessionDTO[]> {
    const payload = await request<SessionDTO[]>("/devices", {
      method: "GET",
    });
    return dataOrThrow(payload, "UNAUTHENTICATED");
  },

  async deleteSession(sessionId: string): Promise<string | undefined> {
    const payload = await request<void>(`/sessions/${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
    });
    return payload.message;
  },

  async terminateDevices(input: TerminateDevicesRequest): Promise<TerminateDevicesResponse> {
    const payload = await request<TerminateDevicesResponse>("/devices/terminate", {
      method: "POST",
      body: input,
    });
    return dataOrThrow(payload, "UNAUTHENTICATED");
  },

  async getTwoFactorStatus(): Promise<TwoFactorStatusResponse> {
    const payload = await request<TwoFactorStatusResponse>("/2fa/status", {
      method: "GET",
    });
    return dataOrThrow(payload, "UNAUTHENTICATED");
  },

  async beginTwoFactorSetup(): Promise<BeginTwoFactorSetupResponse> {
    const payload = await request<BeginTwoFactorSetupResponse>("/2fa/setup", {
      method: "POST",
    });
    return dataOrThrow(payload, "UNAUTHENTICATED");
  },

  async verifyTwoFactorSetup(code: string): Promise<VerifyTwoFactorSetupResponse> {
    const payload = await request<VerifyTwoFactorSetupResponse>("/2fa/verify-setup", {
      method: "POST",
      body: { code },
    });
    return dataOrThrow(payload, "UNAUTHENTICATED");
  },

  async disableTwoFactor(code: string): Promise<string | undefined> {
    const payload = await request<void>("/2fa/disable", {
      method: "POST",
      body: { code },
    });
    return payload.message;
  },

  async getOAuthUrl(provider: Extract<ProviderType, "google" | "github">): Promise<OAuthUrlResponse> {
    const payload = await request<OAuthUrlResponse>(`/oauth/${provider}`, {
      method: "GET",
    });
    return dataOrThrow(payload, "OAUTH_ERROR");
  },
};
