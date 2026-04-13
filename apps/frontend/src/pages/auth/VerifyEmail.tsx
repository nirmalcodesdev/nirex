import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, ArrowRight, CheckCircle2, RefreshCw, Hexagon } from "lucide-react";
import { APP_NAME, APP_NAME_SUFFIX } from "@nirex/shared";
import nirexLogo from "@nirex/assets/images/nirex.svg";

export function VerifyEmail() {
    const [isLoading, setIsLoading] = useState(false);
    const [isVerified, setIsVerified] = useState(false);
    const [countdown, setCountdown] = useState(60);
    const [canResend, setCanResend] = useState(false);
    const [resendSuccess, setResendSuccess] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (countdown > 0 && !canResend) {
            const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown, canResend]);

    useEffect(() => {
        if (countdown === 0 && !canResend) {
            const timer = setTimeout(() => setCanResend(true), 0);
            return () => clearTimeout(timer);
        }
    }, [countdown, canResend]);

    const handleResend = () => {
        setIsLoading(true);
        setResendSuccess(false);
        setTimeout(() => {
            setIsLoading(false);
            setCanResend(false);
            setCountdown(60);
            setResendSuccess(true);
        }, 1200);
    };

    const handleVerify = () => {
        setIsLoading(true);
        setTimeout(() => {
            setIsLoading(false);
            setIsVerified(true);
        }, 1200);
    };

    return (
        <div className="min-h-screen flex">
            {/* Left Side - Branding */}
            <div className="hidden lg:flex lg:w-[45%] bg-nirex-surface relative overflow-hidden">
                {/* Abstract Gradient Background */}
                <div className="absolute inset-0 bg-gradient-to-br from-nirex-accent/5 via-transparent to-nirex-accent/10" />

                {/* Floating Shapes */}
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

                    <AnimatePresence mode="wait">
                        {!isVerified ? (
                            <motion.div
                                key="verify"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="space-y-8"
                            >
                                {/* Large Visual Element */}
                                <div className="relative">
                                    <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-nirex-accent/20 to-nirex-accent/5 backdrop-blur-sm border border-nirex-accent/10 flex items-center justify-center">
                                        <Mail className="w-12 h-12 text-nirex-accent/60" strokeWidth={1.5} />
                                    </div>
                                    <div className="absolute -bottom-2 -right-2 w-16 h-16 rounded-xl bg-gradient-to-br from-nirex-accent/30 to-nirex-accent/10 backdrop-blur-sm border border-nirex-accent/10 flex items-center justify-center">
                                        <div className="w-3 h-3 rounded-full bg-nirex-accent animate-pulse" />
                                    </div>
                                </div>

                                <blockquote className="text-2xl font-medium text-nirex-text-primary/90 leading-relaxed max-w-md">
                                    "One click to secure your account. Verification takes just a moment."
                                </blockquote>
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-nirex-text-primary/10" />
                                    <div>
                                        <p className="text-nirex-text-primary font-medium">Jessica Liu</p>
                                        <p className="text-nirex-text-secondary text-sm">Product Designer at Figma</p>
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="verified"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="space-y-8"
                            >
                                {/* Large Visual Element */}
                                <div className="relative">
                                    <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-nirex-accent/20 to-nirex-accent/5 backdrop-blur-sm border border-nirex-accent/20 flex items-center justify-center">
                                        <CheckCircle2 className="w-12 h-12 text-nirex-accent" strokeWidth={1.5} />
                                    </div>
                                    <div className="absolute -bottom-2 -right-2 w-16 h-16 rounded-xl bg-gradient-to-br from-nirex-accent/30 to-nirex-accent/10 backdrop-blur-sm border border-nirex-accent/10 flex items-center justify-center">
                                        <Hexagon className="w-8 h-8 text-nirex-accent/60" strokeWidth={1.5} />

                                    </div>
                                </div>

                                <blockquote className="text-2xl font-medium text-nirex-text-primary/90 leading-relaxed max-w-md">
                                    "Welcome to the community. We're excited to have you on board."
                                </blockquote>
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-nirex-accent/10 flex items-center justify-center">
                                        <CheckCircle2 className="h-5 w-5 text-nirex-accent" />
                                    </div>
                                    <div>
                                        <p className="text-nirex-text-primary font-medium">Account Verified</p>
                                        <p className="text-nirex-text-secondary text-sm">You're all set</p>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <p className="text-nirex-text-muted/60 text-sm">{APP_NAME} {APP_NAME_SUFFIX}</p>
                </div>
            </div>

            {/* Right Side - Content */}
            <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 bg-nirex-base">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="w-full max-w-sm"
                >
                    {/* Mobile Logo */}
                    <div className="lg:hidden flex items-center justify-center gap-2 mb-10">
                        <img src={nirexLogo} alt={APP_NAME} className="w-8 h-8" />
                        <div className="flex items-center gap-0">
                            <span className="text-xl font-semibold tracking-tight text-nirex-text-primary">{APP_NAME}</span>
                            {APP_NAME_SUFFIX && <span className="font-mono text-[0.85em] text-nirex-text-primary">{APP_NAME_SUFFIX}</span>}
                        </div>
                    </div>

                    <AnimatePresence mode="wait">
                        {!isVerified ? (
                            <motion.div
                                key="verify-form"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0, y: -10 }}
                            >
                                <div className="text-center mb-8">
                                    <div className="w-14 h-14 bg-nirex-surface rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Mail className="h-7 w-7 text-nirex-text-primary" />
                                    </div>
                                    <h1 className="text-2xl font-semibold tracking-tight text-nirex-text-primary mb-2">
                                        Verify your email
                                    </h1>
                                    <p className="text-nirex-text-secondary text-sm">
                                        We've sent a verification link to{" "}
                                        <span className="text-nirex-text-primary font-medium">user@example.com</span>
                                    </p>
                                </div>

                                <div className="bg-nirex-surface rounded-lg p-4 mb-6">
                                    <h3 className="text-sm font-medium text-nirex-text-primary mb-2">Next steps:</h3>
                                    <ol className="text-sm text-nirex-text-secondary space-y-1.5 list-decimal list-inside">
                                        <li>Open your email inbox</li>
                                        <li>Find the email from nirex</li>
                                        <li>Click the verification link</li>
                                        <li>Return here to continue</li>
                                    </ol>
                                </div>

                                <button
                                    onClick={handleVerify}
                                    disabled={isLoading}
                                    className="w-full h-10 bg-nirex-accent text-nirex-text-inverse rounded-lg font-medium hover:bg-nirex-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-4"
                                >
                                    {isLoading ? (
                                        <div className="h-4 w-4 border-2 border-nirex-text-inverse/30 border-t-nirex-text-inverse rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            I've verified my email
                                            <ArrowRight className="h-4 w-4" />
                                        </>
                                    )}
                                </button>

                                <div className="text-center space-y-3">
                                    <p className="text-sm text-nirex-text-secondary">
                                        Didn't receive the email?
                                    </p>
                                    <button
                                        onClick={handleResend}
                                        disabled={!canResend || isLoading}
                                        className="inline-flex items-center gap-2 text-sm font-medium text-nirex-text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
                                    >
                                        <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                                        {canResend ? "Resend email" : `Resend in ${countdown}s`}
                                    </button>
                                    {resendSuccess && (
                                        <p className="text-sm text-nirex-accent flex items-center justify-center gap-1">
                                            <CheckCircle2 className="h-4 w-4" />
                                            Verification email resent successfully
                                        </p>
                                    )}
                                </div>

                                <div className="mt-6 pt-6 border-t border-border text-center">
                                    <p className="text-sm text-nirex-text-secondary mb-1">Wrong email?</p>
                                    <Link to="/auth/signup" className="text-sm font-medium text-nirex-text-primary hover:underline">
                                        Update email address
                                    </Link>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="verified-success"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-center"
                            >
                                <div className="w-14 h-14 bg-nirex-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <CheckCircle2 className="h-7 w-7 text-nirex-accent" />
                                </div>
                                <h1 className="text-2xl font-semibold tracking-tight text-nirex-text-primary mb-2">
                                    Email verified
                                </h1>
                                <p className="text-nirex-text-secondary text-sm mb-6">
                                    Your email has been verified. You can now access all features.
                                </p>
                                <button
                                    onClick={() => navigate("/")}
                                    className="w-full h-10 bg-nirex-accent text-nirex-text-inverse rounded-lg font-medium hover:bg-nirex-accent/90 transition-colors flex items-center justify-center gap-2"
                                >
                                    Go to dashboard
                                    <ArrowRight className="h-4 w-4" />
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </div>
        </div>
    );
}
