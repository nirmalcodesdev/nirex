import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, ArrowLeft, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";
import { APP_NAME, APP_NAME_SUFFIX, forgotPasswordSchema } from "@nirex/shared";
import nirexLogo from "@nirex/assets/images/nirex.svg";
import { authApi } from "../../features/auth/authApi";

export function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [error, setError] = useState<string>("");

    const validateEmail = () => {
        const parsed = forgotPasswordSchema.safeParse({ email });
        if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? "Please enter a valid email address");
            return false;
        }

        setError("");
        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateEmail()) {
            return;
        }

        setIsLoading(true);

        try {
            await authApi.forgotPassword({ email });
            setIsSubmitted(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to send reset link. Please try again.");
        } finally {
            setIsLoading(false);
        }
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

                <AnimatePresence mode="wait">
                    {!isSubmitted ? (
                        <motion.div
                            key="form"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <div className="text-center mb-8">
                                <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-2">
                                    Reset your password
                                </h1>
                                <p className="text-sm text-muted-foreground">
                                    Enter your email and we'll send you a reset link
                                </p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-5">
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="p-3.5 bg-destructive/5 border border-destructive/15 rounded-sm flex items-start gap-2.5"
                                    >
                                        <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                                        <p className="text-sm text-destructive">{error}</p>
                                    </motion.div>
                                )}

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
                                                if (error) setError("");
                                            }}
                                            placeholder="name@company.com"
                                            className={`w-full h-11 pl-10 pr-4 rounded-sm border bg-nirex-base text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-[1.5px] focus:ring-primary/30 focus:border-primary transition-all ${
                                                error
                                                    ? "border-destructive focus:ring-destructive/20 focus:border-destructive"
                                                    : "border-border hover:border-border/80"
                                            }`}
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full h-11 bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 rounded-sm"
                                >
                                    {isLoading ? (
                                        <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin rounded-full" />
                                    ) : (
                                        <>
                                            Send reset link
                                            <ArrowRight className="h-4 w-4" />
                                        </>
                                    )}
                                </button>
                            </form>

                            <div className="mt-8 text-center">
                                <Link
                                    to="/auth/signin"
                                    className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                    Back to sign in
                                </Link>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center"
                        >
                            <div className="flex items-center justify-center w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 mx-auto mb-5">
                                <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                            </div>
                            <h2 className="text-xl font-semibold text-foreground mb-2">
                                Check your email
                            </h2>
                            <p className="text-muted-foreground text-sm mb-6">
                                We've sent a password reset link to{" "}
                                <span className="text-foreground font-medium">{email}</span>
                            </p>
                            <div className="space-y-3">
                                <button
                                    onClick={() => window.open("mailto:", "_blank")}
                                    className="w-full h-11 bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-all rounded-sm"
                                >
                                    Open email app
                                </button>
                                <button
                                    onClick={() => {
                                        setIsSubmitted(false);
                                        setEmail("");
                                    }}
                                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    Didn't receive it? Resend
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
}
