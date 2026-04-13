/**
 * Centralized route paths for the application.
 * Using a constant object ensures type safety and easy refactoring.
 */
export const ROUTES = {
  // Public Routes
  LANDING: "/landing",
  TERMS: "/terms",
  PRIVACY: "/privacy",
  DOCS: "/docs",
  DOCUMENTATION: "/documentation",

  // Auth Routes
  AUTH: {
    ROOT: "/auth",
    SIGNIN: "/auth/signin",
    SIGNUP: "/auth/signup",
    FORGOT_PASSWORD: "/auth/forgot-password",
    RESET_PASSWORD: "/auth/reset-password",
    VERIFY_EMAIL: "/auth/verify-email",
  },

  // Dashboard / Protected Routes
  DASHBOARD: {
    ROOT: "/",
    SESSIONS: "/sessions",
    SESSION_DETAILS: (id: string) => `/sessions/${id}`,
    SESSION_DETAILS_RAW: "/sessions/:id",
    USAGE: "/usage",
    BILLING: "/billing",
    NOTIFICATIONS: "/notifications",
    SETTINGS: "/settings",
  },
} as const;

export type Routes = typeof ROUTES;
