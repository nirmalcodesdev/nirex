import { Suspense, lazy } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Outlet } from "react-router-dom";
import { TooltipProvider } from "@nirex/ui/tooltip";
import { SonnerToaster } from "@nirex/ui";
import { Toaster } from "@nirex/ui/toaster";
import CustomCursor from "@nirex/ui/CustomCursor";

// Layouts
import { Layout } from "./components/main/Layout";
import { ToastProvider } from "./components/ToastProvider";
import { ThemeProvider } from "./components/ui/ThemeProvider";
import { RouteTransition } from "./components/main/RouteTransition";

// Constants
import { ROUTES } from "./constant/routes";

// Pages - Direct imports for core dashboard to ensure immediate availability
import { 
  Home, 
  Sessions, 
  SessionDetails, 
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

const queryClient = new QueryClient();

// Professional loading fallback
const PageLoader = () => (
  <div className="h-screen w-full flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 border-4 border-nirex-accent/20 border-t-nirex-accent rounded-full animate-spin" />
      <span className="text-sm font-medium text-muted-foreground">Loading...</span>
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
  <ToastProvider>
    <Layout />
  </ToastProvider>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <CustomCursor />
      <TooltipProvider>
        <Toaster />
        <SonnerToaster />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public Marketing Routes */}
              <Route path={ROUTES.LANDING} element={<LandingPage />} />
              <Route path={ROUTES.TERMS} element={<Terms />} />
              <Route path={ROUTES.PRIVACY} element={<Privacy />} />
              <Route path={ROUTES.DOCS} element={<Documentation />} />
              <Route path={ROUTES.DOCUMENTATION} element={<Documentation />} />

              {/* Authentication System */}
              <Route path={ROUTES.AUTH.ROOT} element={<AuthLayout />}>
                <Route path="signin" element={<Signin />} />
                <Route path="signup" element={<Signup />} />
                <Route path="forgot-password" element={<ForgotPassword />} />
                <Route path="reset-password" element={<ResetPassword />} />
                <Route path="verify-email" element={<VerifyEmail />} />
              </Route>

              {/* Core Application (Protected Area) */}
              <Route path={ROUTES.DASHBOARD.ROOT} element={<MainLayout />}>
                <Route index element={<RouteTransition><Home /></RouteTransition>} />
                <Route path="sessions" element={<RouteTransition><Sessions /></RouteTransition>} />
                <Route path={ROUTES.DASHBOARD.SESSION_DETAILS_RAW} element={<RouteTransition><SessionDetails /></RouteTransition>} />
                <Route path="usage" element={<RouteTransition><Usage /></RouteTransition>} />
                <Route path="billing" element={<RouteTransition><Billing /></RouteTransition>} />
                <Route path="notifications" element={<RouteTransition><Notifications /></RouteTransition>} />
                <Route path="settings" element={<RouteTransition><Settings /></RouteTransition>} />
              </Route>

              {/* 404 - Not Found Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
