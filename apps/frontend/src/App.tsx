import { Suspense, lazy } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Outlet } from "react-router-dom";
import { TooltipProvider } from "@nirex/ui/tooltip";
import { SonnerToaster } from "@nirex/ui";

// Layouts
import { Layout } from "./components/main/Layout";
import { ToastProvider } from "./components/ToastProvider"; // Keep ToastProvider import here
import { ThemeProvider } from "./components/ui/ThemeProvider";
import { RouteTransition } from "./components/main/RouteTransition";
import { AuthBootstrap } from "./features/auth/AuthBootstrap";
import { ProtectedRoute, PublicOnlyRoute } from "./features/auth/AuthGuards";
import { RealtimeProvider } from "./features/realtime/RealtimeProvider";

// Constants
import { ROUTES } from "./constant/routes";

// Pages - Direct imports for core dashboard to ensure immediate availability
import {
  Home,
  Usage,
  Billing,
  Notifications,
  Settings
} from "./pages/main";

import {
  Signin,
  Signup,
  ForgotPassword,
  ResetPassword,
  VerifyEmail
} from "./pages/auth";

// Lazy loaded standalone pages for production performance
const LandingPage = lazy(() => import("./pages/Landingpage"));
const Documentation = lazy(() => import("./pages/Documentation"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Terms = lazy(() => import("./pages/legal/Terms").then(m => ({ default: m.Terms })));
const Privacy = lazy(() => import("./pages/legal/Privacy").then(m => ({ default: m.Privacy })));

// Lazy load the Onboarding page
const OnboardingPage = lazy(() => import("./pages/main/Onboarding"));

const queryClient = new QueryClient();

// Professional loading fallback
const PageLoader = () => (
  <div className="h-screen w-full flex items-center justify-center bg-background" role="status" aria-live="polite">
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 border-4 border-primary/20 border-t-primary animate-spin" aria-hidden="true" />
      <span className="text-sm font-medium text-muted-foreground">Loading page...</span>
    </div>
  </div>
);

/**
 * Auth layout wrapper for shared auth page elements
 */
const AuthLayout = () => (
  <RouteTransition>
    <Outlet />
  </RouteTransition>
);

/**
 * Main dashboard layout wrapper with providers
 */
const MainLayout = () => (
  // ToastProvider is removed from here to be globally available
  <Layout />
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <ToastProvider> {/* ToastProvider moved here to be globally available */}
        <TooltipProvider> {/* Added closing tag for TooltipProvider */}
          <SonnerToaster />
          <BrowserRouter>
            <AuthBootstrap />
            <RealtimeProvider>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Public Marketing Routes */}
                  <Route path={ROUTES.LANDING} element={<LandingPage />} />
                  <Route path={ROUTES.TERMS} element={<Terms />} />
                  <Route path={ROUTES.PRIVACY} element={<Privacy />} />
                  <Route path={ROUTES.DOCS} element={<Documentation />} />
                  <Route path={ROUTES.DOCUMENTATION} element={<Documentation />} />
                  {/* Onboarding Route */}
                  <Route path={ROUTES.ONBOARDING} element={<ProtectedRoute><RouteTransition><OnboardingPage /></RouteTransition></ProtectedRoute>} />

                  {/* Authentication System */}
                  <Route path={ROUTES.AUTH.ROOT} element={<PublicOnlyRoute><AuthLayout /></PublicOnlyRoute>}>
                    <Route path="signin" element={<Signin />} />
                    <Route path="signup" element={<Signup />} />
                    <Route path="forgot-password" element={<ForgotPassword />} />
                    <Route path="reset-password" element={<ResetPassword />} />
                    <Route path="verify-email" element={<VerifyEmail />} />
                  </Route>

                  {/* Core Application (Protected Area) */}
                  <Route path={ROUTES.DASHBOARD.ROOT} element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
                    <Route index element={<RouteTransition><Home /></RouteTransition>} />
                    <Route path="usage" element={<RouteTransition><Usage /></RouteTransition>} />
                    <Route path="billing" element={<RouteTransition><Billing /></RouteTransition>} />
                    <Route path="notifications" element={<RouteTransition><Notifications /></RouteTransition>} />
                    <Route path="settings" element={<RouteTransition><Settings /></RouteTransition>} />
                  </Route>

                  {/* 404 - Not Found Catch-all */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </RealtimeProvider>
          </BrowserRouter>
        </TooltipProvider> {/* Closing tag for TooltipProvider */}
      </ToastProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
