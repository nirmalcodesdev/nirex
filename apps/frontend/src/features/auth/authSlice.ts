import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { CheckAuthResponse, UserDTO } from "@nirex/shared";
import { authApi, AuthApiError, type SignInPayload } from "./authApi";

type AuthStatus = "idle" | "checking" | "authenticated" | "unauthenticated";
type AuthSession = NonNullable<CheckAuthResponse["session"]>;

interface AuthSuccessPayload {
  user: UserDTO;
  session: AuthSession | null;
}

interface AuthRejectPayload {
  message: string;
  code?: string;
  twoFactorRequired?: boolean;
}

interface SignInThunkPayload extends SignInPayload {
  rememberMe?: boolean;
}

export interface AuthState {
  status: AuthStatus;
  user: UserDTO | null;
  session: AuthSession | null;
  error: string | null;
  errorCode: string | null;
  twoFactorRequired: boolean;
}

const initialState: AuthState = {
  status: "idle",
  user: null,
  session: null,
  error: null,
  errorCode: null,
  twoFactorRequired: false,
};

function rejectFromError(error: unknown): AuthRejectPayload {
  if (error instanceof AuthApiError) {
    const payload: AuthRejectPayload = {
      message: error.message,
    };

    if (error.code) {
      payload.code = error.code;
    }

    if (error.code === "TWO_FACTOR_REQUIRED") {
      payload.twoFactorRequired = true;
    }

    return payload;
  }

  return {
    message: error instanceof Error ? error.message : "Authentication request failed.",
  };
}

async function hydrateFromCookieSession(): Promise<AuthSuccessPayload> {
  const checked = await authApi.check();

  if (!checked.isAuthenticated || !checked.user) {
    const reason = checked.reason ?? "UNAUTHENTICATED";
    throw new AuthApiError(
      reason === "NO_TOKEN" ? "" : "Your session has expired. Please sign in again.",
      401,
      reason,
    );
  }

  return {
    user: checked.user,
    session: checked.session ?? null,
  };
}

async function refreshAndHydrate(): Promise<AuthSuccessPayload> {
  await authApi.refresh();
  return hydrateFromCookieSession();
}

export const initializeAuth = createAsyncThunk<AuthSuccessPayload, void, { rejectValue: AuthRejectPayload }>(
  "auth/initialize",
  async (_, { rejectWithValue }) => {
    try {
      return await hydrateFromCookieSession();
    } catch (error) {
      if (error instanceof AuthApiError && error.code === "TOKEN_EXPIRED") {
        try {
          return await refreshAndHydrate();
        } catch (refreshError) {
          return rejectWithValue(rejectFromError(refreshError));
        }
      }

      return rejectWithValue(rejectFromError(error));
    }
  },
);

export const signInUser = createAsyncThunk<AuthSuccessPayload, SignInThunkPayload, { rejectValue: AuthRejectPayload }>(
  "auth/signIn",
  async (input, { rejectWithValue }) => {
    try {
      await authApi.signIn(input);
      return await hydrateFromCookieSession();
    } catch (error) {
      return rejectWithValue(rejectFromError(error));
    }
  },
);

export const completeOAuthSignIn = createAsyncThunk<AuthSuccessPayload, void, { rejectValue: AuthRejectPayload }>(
  "auth/completeOAuthSignIn",
  async (_, { rejectWithValue }) => {
    try {
      return await hydrateFromCookieSession();
    } catch (error) {
      if (error instanceof AuthApiError && error.code === "TOKEN_EXPIRED") {
        try {
          return await refreshAndHydrate();
        } catch (refreshError) {
          return rejectWithValue(rejectFromError(refreshError));
        }
      }
      return rejectWithValue(rejectFromError(error));
    }
  },
);

export const refreshAuthSession = createAsyncThunk<AuthSuccessPayload, void, { rejectValue: AuthRejectPayload }>(
  "auth/refresh",
  async (_, { rejectWithValue }) => {
    try {
      return await refreshAndHydrate();
    } catch (error) {
      return rejectWithValue(rejectFromError(error));
    }
  },
);

export const signOutUser = createAsyncThunk<void, void>(
  "auth/signOut",
  async () => {
    try {
      await authApi.signOut();
    } catch {
      // Local sign-out must still complete when the server session is already gone.
    }
  },
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    clearAuthError(state) {
      state.error = null;
      state.errorCode = null;
    },
    resetTwoFactor(state) {
      state.twoFactorRequired = false;
      state.error = null;
      state.errorCode = null;
    },

    signedOutLocally(state) {
      Object.assign(state, {
        ...initialState,
        status: "unauthenticated",
      });
    },
    authUserUpdated(state, action: PayloadAction<UserDTO>) {
      state.user = action.payload;
    },
  },
  extraReducers: (builder) => {
    const setPending = (state: AuthState) => {
      state.status = "checking";
      state.error = null;
      state.errorCode = null;
    };

    const setAuthenticated = (state: AuthState, action: PayloadAction<AuthSuccessPayload>) => {
      state.status = "authenticated";
      state.user = action.payload.user;
      state.session = action.payload.session;
      state.error = null;
      state.errorCode = null;
      state.twoFactorRequired = false;
    };

    const setRejected = (state: AuthState, action: { payload: AuthRejectPayload | undefined }) => {
      state.status = "unauthenticated";
      state.user = null;
      state.session = null;
      state.error = action.payload?.message || null;
      state.errorCode = action.payload?.code ?? null;
      if (action.payload?.twoFactorRequired !== undefined) {
        state.twoFactorRequired = action.payload.twoFactorRequired;
      }
    };

    builder
      .addCase(initializeAuth.pending, setPending)
      .addCase(initializeAuth.fulfilled, setAuthenticated)
      .addCase(initializeAuth.rejected, setRejected)
      .addCase(signInUser.pending, setPending)
      .addCase(signInUser.fulfilled, setAuthenticated)
      .addCase(signInUser.rejected, setRejected)
      .addCase(completeOAuthSignIn.pending, setPending)
      .addCase(completeOAuthSignIn.fulfilled, setAuthenticated)
      .addCase(completeOAuthSignIn.rejected, setRejected)
      .addCase(refreshAuthSession.pending, setPending)
      .addCase(refreshAuthSession.fulfilled, setAuthenticated)
      .addCase(refreshAuthSession.rejected, setRejected)
      .addCase(signOutUser.fulfilled, (state) => {
        Object.assign(state, {
          ...initialState,
          status: "unauthenticated",
        });
      });
  },
});

export const { clearAuthError, resetTwoFactor, signedOutLocally, authUserUpdated } = authSlice.actions;
export const authReducer = authSlice.reducer;
