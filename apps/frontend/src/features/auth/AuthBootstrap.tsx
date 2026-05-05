import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { completeOAuthSignIn, initializeAuth } from "./authSlice";
import { useAppDispatch } from "../../store/hooks";
import { useToast } from "../../components/ToastProvider";
import { ROUTES } from "../../constant/routes";

function getPostAuthRoute(): string {
  return window.localStorage.getItem("nirex-onboarding-complete") === "true"
    ? ROUTES.DASHBOARD.ROOT
    : ROUTES.ONBOARDING;
}

export function AuthBootstrap() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const params = new URLSearchParams(location.search);
    const oauthError = params.get("oauth_error");
    const oauthSuccess = params.get("oauth_success");

    if (oauthError) {
      toast(decodeURIComponent(oauthError), "error");
      navigate(location.pathname, { replace: true });
      void dispatch(initializeAuth());
      return;
    }

    if (oauthSuccess === "true") {
      params.delete("oauth_success");
      params.delete("provider");

      const cleanSearch = params.toString();
      const cleanPath = `${location.pathname}${cleanSearch ? `?${cleanSearch}` : ""}`;
      navigate(cleanPath, { replace: true });

      void dispatch(completeOAuthSignIn())
        .unwrap()
        .then(() => {
          toast("Signed in successfully.", "success");
          navigate(getPostAuthRoute(), { replace: true });
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "OAuth sign-in failed.";
          toast(message, "error");
          navigate(ROUTES.AUTH.SIGNIN, { replace: true });
        });
      return;
    }

    void dispatch(initializeAuth());
  }, [dispatch, location.pathname, location.search, navigate, toast]);

  return null;
}
