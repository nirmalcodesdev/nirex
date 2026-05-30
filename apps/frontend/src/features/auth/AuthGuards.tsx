import { type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAppSelector } from "../../store/hooks";
import { ROUTES } from "../../constant/routes";

function AuthLoading() {
  return (
    <div className="h-screen w-full flex items-center justify-center bg-background" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary animate-spin" aria-hidden="true" />
        <span className="text-sm font-medium text-muted-foreground">Verifying your session...</span>
      </div>
    </div>
  );
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const location = useLocation();
  const status = useAppSelector((state) => state.auth.status);

  if (status === "idle" || status === "checking") {
    return <AuthLoading />;
  }

  if (status !== "authenticated") {
    return <Navigate to={ROUTES.AUTH.SIGNIN} replace state={{ from: location }} />;
  }

  return <>{children}</>;
}

export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const status = useAppSelector((state) => state.auth.status);

  if (status === "authenticated") {
    return <Navigate to={ROUTES.DASHBOARD.ROOT} replace />;
  }

  if (status === "idle" || status === "checking") {
    return <AuthLoading />;
  }

  return <>{children}</>;
}
