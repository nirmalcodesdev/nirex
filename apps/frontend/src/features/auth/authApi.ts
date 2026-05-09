import type {
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
import {
  API_BASE_URL,
  BackendApiError,
  dataOrThrow,
  request,
} from "../../lib/backendApi";

const AUTH_BASE = "/auth";

export { API_BASE_URL };
export { BackendApiError as AuthApiError };

function authRequest<T>(path: string, options?: Omit<RequestInit, "body"> & { body?: unknown }) {
  return request<T>(`${AUTH_BASE}${path}`, options);
}

export type SignInPayload = SignInRequest & {
  twoFactorCode?: string;
  rememberMe?: boolean;
};

export const authApi = {
  async signUp(input: SignUpRequest): Promise<SignUpResponse> {
    const payload = await authRequest<SignUpResponse>("/sign-up", {
      method: "POST",
      body: input,
    });
    return dataOrThrow(payload, "SIGNUP_FAILED");
  },

  async signIn(input: SignInPayload): Promise<void> {
    await authRequest<void>("/sign-in", {
      method: "POST",
      body: input,
    });
  },

  async refresh(): Promise<void> {
    await authRequest<void>("/refresh", {
      method: "POST",
    });
  },

  async check(): Promise<CheckAuthResponse> {
    const payload = await authRequest<CheckAuthResponse>("/check", {
      method: "GET",
    });
    return dataOrThrow(payload, "UNAUTHENTICATED");
  },

  async me(): Promise<GetMeResponse> {
    const payload = await authRequest<GetMeResponse>("/me", {
      method: "GET",
    });
    return dataOrThrow(payload, "UNAUTHENTICATED");
  },

  async signOut(): Promise<void> {
    await authRequest<void>("/sign-out", {
      method: "POST",
    });
  },

  async signOutAll(): Promise<void> {
    await authRequest<void>("/sign-out-all", {
      method: "POST",
    });
  },

  async changePassword(input: ChangePasswordRequest): Promise<string | undefined> {
    const payload = await authRequest<void>("/change-password", {
      method: "POST",
      body: input,
    });
    return payload.message;
  },

  async forgotPassword(input: ForgotPasswordRequest): Promise<string | undefined> {
    const payload = await authRequest<void>("/forgot-password", {
      method: "POST",
      body: input,
    });
    return payload.message;
  },

  async resetPassword(input: ResetPasswordRequest): Promise<string | undefined> {
    const payload = await authRequest<void>("/reset-password", {
      method: "POST",
      body: input,
    });
    return payload.message;
  },

  async verifyEmail(token: string): Promise<string | undefined> {
    const payload = await authRequest<void>(`/verify-email?${new URLSearchParams({ token }).toString()}`, {
      method: "GET",
    });
    return payload.message;
  },

  async updateProfile(input: UpdateProfileRequest): Promise<UpdateProfileResponse> {
    const payload = await authRequest<UpdateProfileResponse>("/profile", {
      method: "PATCH",
      body: input,
    });
    return dataOrThrow(payload, "PROFILE_UPDATE_FAILED");
  },

  async listSessions(): Promise<ListSessionsResponse> {
    const payload = await authRequest<ListSessionsResponse>("/sessions", {
      method: "GET",
    });
    return dataOrThrow(payload, "UNAUTHENTICATED");
  },

  async listDevices(): Promise<SessionDTO[]> {
    const payload = await authRequest<SessionDTO[]>("/devices", {
      method: "GET",
    });
    return dataOrThrow(payload, "UNAUTHENTICATED");
  },

  async deleteSession(sessionId: string): Promise<string | undefined> {
    const payload = await authRequest<void>(`/sessions/${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
    });
    return payload.message;
  },

  async terminateDevices(input: TerminateDevicesRequest): Promise<TerminateDevicesResponse> {
    const payload = await authRequest<TerminateDevicesResponse>("/devices/terminate", {
      method: "POST",
      body: input,
    });
    return dataOrThrow(payload, "UNAUTHENTICATED");
  },

  async getTwoFactorStatus(): Promise<TwoFactorStatusResponse> {
    const payload = await authRequest<TwoFactorStatusResponse>("/2fa/status", {
      method: "GET",
    });
    return dataOrThrow(payload, "UNAUTHENTICATED");
  },

  async beginTwoFactorSetup(): Promise<BeginTwoFactorSetupResponse> {
    const payload = await authRequest<BeginTwoFactorSetupResponse>("/2fa/setup", {
      method: "POST",
    });
    return dataOrThrow(payload, "UNAUTHENTICATED");
  },

  async verifyTwoFactorSetup(code: string): Promise<VerifyTwoFactorSetupResponse> {
    const payload = await authRequest<VerifyTwoFactorSetupResponse>("/2fa/verify-setup", {
      method: "POST",
      body: { code },
    });
    return dataOrThrow(payload, "UNAUTHENTICATED");
  },

  async disableTwoFactor(code: string): Promise<string | undefined> {
    const payload = await authRequest<void>("/2fa/disable", {
      method: "POST",
      body: { code },
    });
    return payload.message;
  },

  async getOAuthUrl(provider: Extract<ProviderType, "google" | "github">): Promise<OAuthUrlResponse> {
    const payload = await authRequest<OAuthUrlResponse>(`/oauth/${provider}`, {
      method: "GET",
    });
    return dataOrThrow(payload, "OAUTH_ERROR");
  },
};
