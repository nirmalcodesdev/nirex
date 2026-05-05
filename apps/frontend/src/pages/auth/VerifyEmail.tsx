import { useEffect, useState } from "react";
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
    const [status, setStatus] = useState<VerificationStatus>(token ? "verifying" : "idle");
    const [message, setMessage] = useState<string>("");

    useEffect(() => {
        if (!token) return;

        const parsed = verifyEmailSchema.safeParse({ token });
        if (!parsed.success) {
            setStatus("error");
            setMessage("This verification link is invalid or incomplete.");
            return;
        }

        let cancelled = false;

        async function verify() {
            try {
                const responseMessage = await authApi.verifyEmail(token);
                if (cancelled) return;
                setStatus("success");
                setMessage(responseMessage ?? "Email verified successfully.");
            } catch (error) {
                if (cancelled) return;
                setStatus("error");
                setMessage(error instanceof Error ? error.message : "Unable to verify this email link.");
            }
        }

        void verify();

        return () => {
            cancelled = true;
        };
    }, [token]);

    const isVerifying = status === "verifying";
    const isSuccess = status === "success";
    const isError = status === "error";

    return (
        <div className="min-h-screen flex">
            <div className="hidden lg:flex lg:w-[45%] bg-nirex-surface relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-nirex-accent/5 via-transparent to-nirex-accent/10" />
                <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-nirex-accent/10 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-nirex-accent/5 rounded-full blur-3xl" />

                <div className="relative z-10 flex flex-col justify-between p-16 w-full">
                    <Link to="/" className="flex items-center gap-3">
                        <img src={nirexLogo} alt={APP_NAME} className="w-9 h-9" />
                        <div className="flex items-center gap-0">
                            <span className="text-xl font-semibold tracking-tight text-nirex-text-primary">{APP_NAME}</span>
                            {APP_NAME_SUFFIX && <span className="font-mono text-[0.85em] text-nirex-text-primary">{APP_NAME_SUFFIX}</span>}
                        </div>
                    </Link>

                    <div className="space-y-8">
                        <div className="relative">
                            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-nirex-accent/20 to-nirex-accent/5 backdrop-blur-sm border border-nirex-accent/10 flex items-center justify-center">
                                {isSuccess ? (
                                    <CheckCircle2 className="w-12 h-12 text-nirex-accent" strokeWidth={1.5} />
                                ) : (
                                    <Mail className="w-12 h-12 text-nirex-accent/60" strokeWidth={1.5} />
                                )}
                            </div>
                        </div>

                        <blockquote className="text-2xl font-medium text-nirex-text-primary/90 leading-relaxed max-w-md">
                            {isSuccess
                                ? "Your account email is verified and ready to use."
                                : "Email verification protects your account and keeps recovery secure."}
                        </blockquote>
                    </div>

                    <p className="text-nirex-text-muted/60 text-sm">{APP_NAME} {APP_NAME_SUFFIX}</p>
                </div>
            </div>

            <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 bg-nirex-base">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="w-full max-w-sm"
                >
                    <div className="lg:hidden flex items-center justify-center gap-2 mb-10">
                        <img src={nirexLogo} alt={APP_NAME} className="w-8 h-8" />
                        <div className="flex items-center gap-0">
                            <span className="text-xl font-semibold tracking-tight text-nirex-text-primary">{APP_NAME}</span>
                            {APP_NAME_SUFFIX && <span className="font-mono text-[0.85em] text-nirex-text-primary">{APP_NAME_SUFFIX}</span>}
                        </div>
                    </div>

                    <div className="text-center">
                        <div className="w-14 h-14 bg-nirex-surface rounded-full flex items-center justify-center mx-auto mb-4">
                            {isVerifying && <div className="h-7 w-7 border-2 border-nirex-accent/30 border-t-nirex-accent rounded-full animate-spin" />}
                            {isSuccess && <CheckCircle2 className="h-7 w-7 text-nirex-accent" />}
                            {isError && <AlertCircle className="h-7 w-7 text-destructive" />}
                            {status === "idle" && <Mail className="h-7 w-7 text-nirex-text-primary" />}
                        </div>

                        <h1 className="text-2xl font-semibold tracking-tight text-nirex-text-primary mb-2">
                            {isVerifying && "Verifying email"}
                            {isSuccess && "Email verified"}
                            {isError && "Verification failed"}
                            {status === "idle" && "Check your email"}
                        </h1>

                        <p className="text-nirex-text-secondary text-sm mb-6">
                            {isVerifying && "Please wait while we confirm your verification link."}
                            {isSuccess && message}
                            {isError && message}
                            {status === "idle" && (
                                <>
                                    We sent a verification link
                                    {state?.email ? (
                                        <>
                                            {" "}to <span className="text-nirex-text-primary font-medium">{state.email}</span>
                                        </>
                                    ) : null}
                                    . Open the link in that email to activate your account.
                                </>
                            )}
                        </p>

                        {isSuccess && (
                            <Link
                                to={ROUTES.AUTH.SIGNIN}
                                className="w-full h-10 bg-nirex-accent text-nirex-text-inverse rounded-lg font-medium hover:bg-nirex-accent/90 transition-colors flex items-center justify-center gap-2"
                            >
                                Sign in
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        )}

                        {isError && (
                            <Link
                                to={ROUTES.AUTH.SIGNIN}
                                className="w-full h-10 bg-nirex-accent text-nirex-text-inverse rounded-lg font-medium hover:bg-nirex-accent/90 transition-colors flex items-center justify-center gap-2"
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
                                    className="w-full h-10 bg-nirex-accent text-nirex-text-inverse rounded-lg font-medium hover:bg-nirex-accent/90 transition-colors"
                                >
                                    Open email app
                                </button>
                                <Link
                                    to={ROUTES.AUTH.SIGNIN}
                                    className="inline-flex items-center gap-2 text-sm text-nirex-text-secondary hover:text-nirex-text-primary transition-colors"
                                >
                                    Back to sign in
                                </Link>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
