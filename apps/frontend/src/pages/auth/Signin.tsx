import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, Mail, Lock, ArrowRight, ShieldCheck, ChevronLeft } from "lucide-react";
import { AlertCircle } from "lucide-react";
import { APP_NAME, APP_NAME_SUFFIX, signInSchema } from "@nirex/shared";
import nirexLogo from "@nirex/assets/images/nirex.svg";
import { authApi } from "../../features/auth/authApi";
import {
    clearAuthError,
    resetTwoFactor,
    signInUser,
} from "../../features/auth/authSlice";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { ROUTES } from "../../constant/routes";

interface RedirectState {
    from?: {
        pathname?: string;
    };
}

function getPostAuthRoute(fallback?: string): string {
    if (fallback && !fallback.startsWith(ROUTES.AUTH.ROOT)) {
        return fallback;
    }

    return localStorage.getItem("nirex-onboarding-complete") === "true"
        ? ROUTES.DASHBOARD.ROOT
        : ROUTES.ONBOARDING;
}

export function Signin() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [twoFactorCode, setTwoFactorCode] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [oauthProvider, setOauthProvider] = useState<
        "google" | "github" | null
    >(null);
    const [errors, setErrors] = useState<{
        email?: string;
        password?: string;
        twoFactorCode?: string;
        form?: string;
    }>({});

    const dispatch = useAppDispatch();
    const authStatus = useAppSelector((state) => state.auth.status);
    const authError = useAppSelector((state) => state.auth.error);
    const twoFactorRequired = useAppSelector(
        (state) => state.auth.twoFactorRequired
    );

    const navigate = useNavigate();
    const location = useLocation();
    const isLoading = authStatus === "checking";

    const twoFactorInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (twoFactorRequired) {
            const timer = setTimeout(() => {
                twoFactorInputRef.current?.focus();
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [twoFactorRequired]);

    const validateForm = () => {
        const newErrors: {
            email?: string;
            password?: string;
            twoFactorCode?: string;
            form?: string;
        } = {};

        if (twoFactorRequired) {
            if (!twoFactorCode.trim()) {
                newErrors.twoFactorCode = "Two‑factor code is required";
            } else if (!/^\d{6}$/.test(twoFactorCode.trim())) {
                newErrors.twoFactorCode = "Code must be exactly 6 digits";
            }
            setErrors(newErrors);
            return Object.keys(newErrors).length === 0;
        }

        const parsed = signInSchema.safeParse({ email, password });
        if (!parsed.success) {
            for (const issue of parsed.error.issues) {
                const field = issue.path[0];
                if (field === "email") newErrors.email = issue.message;
                if (field === "password") newErrors.password = issue.message;
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        const payload: Parameters<typeof signInUser>[0] = {
            email,
            password,
            rememberMe,
        };
        if (twoFactorRequired && twoFactorCode.trim()) {
            payload.twoFactorCode = twoFactorCode.trim();
        }

        const result = await dispatch(signInUser(payload));

        if (signInUser.fulfilled.match(result)) {
            const state = location.state as RedirectState | null;
            navigate(getPostAuthRoute(state?.from?.pathname), { replace: true });
            return;
        }

        setErrors((prev) => ({
            ...prev,
            form:
                result.payload?.message ?? "Unable to sign in. Please try again.",
        }));
    };

    const handleOAuth = async (provider: "google" | "github") => {
        setErrors({});
        setOauthProvider(provider);

        try {
            const { authUrl } = await authApi.getOAuthUrl(provider);
            window.location.assign(authUrl);
        } catch (error) {
            setOauthProvider(null);
            setErrors({
                form:
                    error instanceof Error
                        ? error.message
                        : "OAuth sign‑in is unavailable.",
            });
        }
    };

    const handleBackToCredentials = () => {
        dispatch(resetTwoFactor());
        setTwoFactorCode("");
        setErrors((prev) => {
            const rest = { ...prev };
            delete rest.twoFactorCode;
            return rest;
        });
    };

    const clearFieldError = (field: keyof typeof errors) => {
        if (errors[field]) {
            setErrors((prev) => {
                const rest = { ...prev };
                delete rest[field];
                return rest;
            });
        }
        dispatch(clearAuthError());
    };

    return (
        <div className="min-h-screen flex flex-col items-center bg-nirex-base relative px-4 py-16 overflow-y-auto">
            {/* Subtle ambient glow */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/[0.03] blur-[120px]" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="relative z-10 w-full max-w-[420px] my-auto"
            >
                {/* Logo */}
                <div className="flex items-center justify-center gap-3 mb-10">
                    <div className="flex items-center justify-center w-10 h-10 bg-primary/10 border border-primary/20">
                        <img src={nirexLogo} alt={APP_NAME} className="w-6 h-6" />
                    </div>
                    <div className="flex items-center gap-0">
                        <span className="text-lg font-semibold tracking-tight text-foreground">{APP_NAME}</span>
                        {APP_NAME_SUFFIX && <span className="font-mono text-[0.85em] text-foreground">{APP_NAME_SUFFIX}</span>}
                    </div>
                </div>

                {/* Header */}
                <div className="text-center mb-8">
                    {twoFactorRequired ? (
                        <button
                            type="button"
                            onClick={handleBackToCredentials}
                            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
                        >
                            <ChevronLeft size={16} />
                            Back to sign in
                        </button>
                    ) : null}
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-2">
                        {twoFactorRequired ? "Two-factor authentication" : "Welcome back"}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {twoFactorRequired
                            ? "Enter the 6-digit code from your authenticator app."
                            : "Don't have an account?"}
                        {!twoFactorRequired && (
                            <>
                                {" "}
                                <Link
                                    to="/auth/signup"
                                    className="text-primary font-medium hover:underline underline-offset-2"
                                >
                                    Get started
                                </Link>
                            </>
                        )}
                    </p>
                </div>

                {/* Social Login */}
                {!twoFactorRequired && (
                    <>
                        <div className="grid grid-cols-2 gap-3 mb-6">
                            <OAuthButton
                                provider="google"
                                onClick={() => void handleOAuth("google")}
                                isLoading={oauthProvider === "google"}
                                disabled={oauthProvider !== null || isLoading}
                            />
                            <OAuthButton
                                provider="github"
                                onClick={() => void handleOAuth("github")}
                                isLoading={oauthProvider === "github"}
                                disabled={oauthProvider !== null || isLoading}
                            />
                        </div>

                        <div className="relative mb-6">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-border" />
                            </div>
                            <div className="relative flex justify-center">
                                <span className="bg-nirex-base px-3 text-xs text-muted-foreground uppercase tracking-wider">
                                    or continue with email
                                </span>
                            </div>
                        </div>
                    </>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    {(errors.form || authError) && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-3.5 bg-destructive/5 border border-destructive/15 rounded-sm flex items-start gap-2.5"
                        >
                            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                            <p className="text-sm text-destructive">{errors.form ?? authError}</p>
                        </motion.div>
                    )}

                    {/* Email */}
                    <div className="space-y-1.5">
                        <label htmlFor="email" className="block text-sm font-medium text-foreground">
                            Email
                        </label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                    clearFieldError("email");
                                }}
                                readOnly={twoFactorRequired}
                                placeholder="name@company.com"
                                className={`w-full h-11 pl-10 pr-4 rounded-sm border bg-nirex-base text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-[1.5px] focus:ring-primary/30 focus:border-primary transition-all ${
                                    twoFactorRequired
                                        ? "opacity-50 cursor-not-allowed border-border/50"
                                        : errors.email
                                            ? "border-destructive focus:ring-destructive/20 focus:border-destructive"
                                            : "border-border hover:border-border/80"
                                }`}
                            />
                        </div>
                        {errors.email && !twoFactorRequired && (
                            <p className="text-sm text-destructive flex items-center gap-1.5">
                                <AlertCircle className="h-3.5 w-3.5" />
                                {errors.email}
                            </p>
                        )}
                    </div>

                    {/* Password */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <label htmlFor="password" className="block text-sm font-medium text-foreground">
                                Password
                            </label>
                            {!twoFactorRequired && (
                                <Link
                                    to="/auth/forgot-password"
                                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    Forgot?
                                </Link>
                            )}
                        </div>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                    clearFieldError("password");
                                }}
                                readOnly={twoFactorRequired}
                                placeholder="Enter your password"
                                className={`w-full h-11 pl-10 pr-10 rounded-sm border bg-nirex-base text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-[1.5px] focus:ring-primary/30 focus:border-primary transition-all ${
                                    twoFactorRequired
                                        ? "opacity-50 cursor-not-allowed border-border/50"
                                        : errors.password
                                            ? "border-destructive focus:ring-destructive/20 focus:border-destructive"
                                            : "border-border hover:border-border/80"
                                }`}
                            />
                            {!twoFactorRequired && (
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            )}
                        </div>
                        {errors.password && !twoFactorRequired && (
                            <p className="text-sm text-destructive flex items-center gap-1.5">
                                <AlertCircle className="h-3.5 w-3.5" />
                                {errors.password}
                            </p>
                        )}
                    </div>

                    {/* 2FA Code */}
                    {twoFactorRequired && (
                        <div className="space-y-1.5">
                            <label htmlFor="twoFactorCode" className="block text-sm font-medium text-foreground">
                                Authentication code
                            </label>
                            <div className="relative">
                                <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    ref={twoFactorInputRef}
                                    id="twoFactorCode"
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    maxLength={6}
                                    value={twoFactorCode}
                                    onChange={(e) => {
                                        const value = e.target.value.replace(/\D/g, "").slice(0, 6);
                                        setTwoFactorCode(value);
                                        clearFieldError("twoFactorCode");
                                    }}
                                    placeholder="000000"
                                    className={`w-full h-11 pl-10 pr-4 rounded-sm border bg-nirex-base text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-[1.5px] focus:ring-primary/30 focus:border-primary transition-all tracking-[0.3em] font-mono ${
                                        errors.twoFactorCode
                                            ? "border-destructive focus:ring-destructive/20 focus:border-destructive"
                                            : "border-border hover:border-border/80"
                                    }`}
                                />
                            </div>
                            {errors.twoFactorCode && (
                                <p className="text-sm text-destructive flex items-center gap-1.5">
                                    <AlertCircle className="h-3.5 w-3.5" />
                                    {errors.twoFactorCode}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Remember me */}
                    {!twoFactorRequired && (
                        <div className="flex items-center">
                            <input
                                id="remember"
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                className="h-5 w-5 rounded border-2 border-border accent-primary cursor-pointer focus:ring-2 focus:ring-primary/20"
                            />
                            <label htmlFor="remember" className="ml-2.5 text-sm text-muted-foreground">
                                Remember me for 30 days
                            </label>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full h-11 bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 rounded-sm"
                    >
                        {isLoading ? (
                            <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin rounded-full" />
                        ) : twoFactorRequired ? (
                            <>
                                Verify code
                                <ArrowRight className="h-4 w-4" />
                            </>
                        ) : (
                            <>
                                Sign in
                                <ArrowRight className="h-4 w-4" />
                            </>
                        )}
                    </button>
                </form>

                <p className="mt-8 text-center text-xs text-muted-foreground">
                    By signing in, you agree to our{" "}
                    <Link to="/terms" state={{ from: "/auth/signin" }} className="text-foreground hover:underline underline-offset-2">Terms</Link>
                    {" "}and{" "}
                    <Link to="/privacy" state={{ from: "/auth/signin" }} className="text-foreground hover:underline underline-offset-2">Privacy Policy</Link>
                </p>
            </motion.div>
        </div>
    );
}

function OAuthButton({
    provider,
    onClick,
    isLoading,
    disabled,
}: {
    provider: "google" | "github";
    onClick: () => void;
    isLoading: boolean;
    disabled: boolean;
}) {
    const isGoogle = provider === "google";

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="flex items-center justify-center gap-2.5 h-11 px-4 rounded-sm border border-border bg-nirex-surface hover:bg-nirex-elevated hover:border-border/80 transition-all text-sm font-medium text-foreground disabled:opacity-50"
        >
            {isGoogle ? (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
            ) : (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
            )}
            <span>{isLoading ? "Connecting..." : isGoogle ? "Google" : "GitHub"}</span>
        </button>
    );
}
