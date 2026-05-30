import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertCircle, ArrowRight, CheckCircle2, Mail } from "lucide-react";
import { APP_NAME, APP_NAME_SUFFIX, verifyEmailSchema } from "@nirex/shared";
import nirexLogo from "@nirex/assets/images/nirex.svg";
import { authApi } from "../../features/auth/authApi";
import { ROUTES } from "../../constant/routes";

type VerificationStatus = "idle" | "verifying" | "success" | "error";

interface VerifyEmailState {
    email?: string;
}

export function VerifyEmail() {
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const state = location.state as VerifyEmailState | null;
    const token = searchParams.get("token") ?? "";

    const isTokenValid = token ? verifyEmailSchema.safeParse({ token }).success : false;

    const [status, setStatus] = useState<VerificationStatus>(() => {
        if (!token) return "idle";
        return isTokenValid ? "verifying" : "error";
    });
    const [message, setMessage] = useState<string>(() => {
        if (!token || isTokenValid) return "";
        return "This verification link is invalid or incomplete.";
    });
    const verificationPromiseRef = useRef<Record<string, Promise<string | undefined>>>({});

    useEffect(() => {
        if (!token || !isTokenValid) return;

        if (!verificationPromiseRef.current[token]) {
            verificationPromiseRef.current[token] = authApi.verifyEmail(token);
        }

        let cancelled = false;

        async function verify() {
            try {
                const responseMessage = await verificationPromiseRef.current[token];
                if (cancelled) return;
                setStatus("success");
                setMessage(responseMessage ?? "Email verified successfully.");
            } catch (error) {
                if (cancelled) return;
                setStatus("error");
                setMessage(
                    error instanceof Error
                        ? error.message
                        : "Unable to verify this email link."
                );
            }
        }

        void verify();

        return () => {
            cancelled = true;
        };
    }, [token, isTokenValid]);

    const isVerifying = status === "verifying";
    const isSuccess = status === "success";
    const isError = status === "error";

    return (
        <div className="min-h-screen flex flex-col items-center bg-nirex-base relative px-4 py-16 overflow-y-auto">
            {/* Subtle ambient glow */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div
                    className={`absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[120px] ${
                        isSuccess ? "bg-emerald-500/[0.03]" : isError ? "bg-destructive/[0.03]" : "bg-primary/[0.03]"
                    }`}
                />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="relative z-10 w-full max-w-[420px] text-center my-auto"
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

                {/* Status Icon */}
                <div className="flex items-center justify-center w-14 h-14 border mx-auto mb-5">
                    {isVerifying && <div className="h-7 w-7 border-2 border-primary/30 border-t-primary animate-spin" />}
                    {isSuccess && <CheckCircle2 className="h-7 w-7 text-emerald-500" />}
                    {isError && <AlertCircle className="h-7 w-7 text-destructive" />}
                    {status === "idle" && <Mail className="h-7 w-7 text-foreground" />}
                </div>

                <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-2">
                    {isVerifying && "Verifying email"}
                    {isSuccess && "Email verified"}
                    {isError && "Verification failed"}
                    {status === "idle" && "Check your email"}
                </h1>

                <p className="text-muted-foreground text-sm mb-8">
                    {isVerifying && "Please wait while we confirm your verification link."}
                    {isSuccess && message}
                    {isError && message}
                    {status === "idle" && (
                        <>
                            We sent a verification link
                            {state?.email ? (
                                <>
                                    {" "}to <span className="text-foreground font-medium">{state.email}</span>
                                </>
                            ) : null}
                            . Open the link in that email to activate your account.
                        </>
                    )}
                </p>

                {isSuccess && (
                    <Link
                        to={ROUTES.AUTH.SIGNIN}
                        className="w-full h-11 bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-all flex items-center justify-center gap-2 rounded-sm"
                    >
                        Sign in
                        <ArrowRight className="h-4 w-4" />
                    </Link>
                )}

                {isError && (
                    <Link
                        to={ROUTES.AUTH.SIGNIN}
                        className="w-full h-11 bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-all flex items-center justify-center gap-2 rounded-sm"
                    >
                        Back to sign in
                        <ArrowRight className="h-4 w-4" />
                    </Link>
                )}

                {status === "idle" && (
                    <div className="space-y-3">
                        <button
                            type="button"
                            onClick={() => window.open("mailto:", "_blank")}
                            className="w-full h-11 bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-all rounded-sm"
                        >
                            Open email app
                        </button>
                        <Link
                            to={ROUTES.AUTH.SIGNIN}
                            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Back to sign in
                        </Link>
                    </div>
                )}
            </motion.div>
        </div>
    );
}
