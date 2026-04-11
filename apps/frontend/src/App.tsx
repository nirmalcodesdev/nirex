import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Outlet, Navigate } from "react-router-dom";
import NotFound from "./pages/NotFound.tsx";
import LandingPage from "./pages/Landingpage.tsx";
import { TooltipProvider } from "@nirex/ui/tooltip";
import { SonnerToaster } from "@nirex/ui";
import { Toaster } from "@nirex/ui/toaster";
import { Signin, Signup, ForgotPassword, ResetPassword, VerifyEmail } from "./pages/auth";
import CustomCursor from "@nirex/ui/CustomCursor";
import { Terms } from "./pages/legal/Terms.tsx";
import { Privacy } from "./pages/legal/Privacy.tsx";
import Documentation from "./pages/Documentation.tsx";

const queryClient = new QueryClient();

// Auth layout wrapper for shared auth page elements
const AuthLayout = () => <Outlet />;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <CustomCursor />
    <TooltipProvider>
      <Toaster />
      <SonnerToaster />
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/landing" element={<Navigate to="/" replace />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/docs" element={<Documentation />} />

          {/* Auth Routes - Nested under /auth parent */}
          <Route path="/auth" element={<AuthLayout />}>
            <Route path="signin" element={<Signin />} />
            <Route path="signup" element={<Signup />} />
            <Route path="forgot-password" element={<ForgotPassword />} />
            <Route path="reset-password" element={<ResetPassword />} />
            <Route path="verify-email" element={<VerifyEmail />} />
          </Route>



          {/* 404 - Not Found */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
