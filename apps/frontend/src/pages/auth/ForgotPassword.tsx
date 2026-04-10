import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, ArrowLeft, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";
import nirexLogo from "@nirex/assets/images/nirex.svg";
import { APP_NAME, APP_NAME_SUFFIX } from "@nirex/shared";

export function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [error, setError] = useState<string>("");

    const validateEmail = () => {
        if (!email.trim()) {
            setError("Email is required");
            return false;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setError("Please enter a valid email address");
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
        setTimeout(() => {
            setIsLoading(false);
            setIsSubmitted(true);
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

                {/* Content */}
                <div className="relative z-10 flex flex-col justify-between p-16 w-full">
                    <Link to="/" className="flex items-center gap-3">
                        <img src={nirexLogo} alt="nirex" className="w-9 h-9" />
                        <span className="text-xl font-semibold tracking-tight text-nirex-text-primary">{APP_NAME}</span>
                        {APP_NAME_SUFFIX && <span className="font-mono text-[0.85em] text-nirex-text-primary">{APP_NAME_SUFFIX}</span>}
                    </Link>

                    <div className="space-y-8">
                        {/* Large Visual Element */}
                        <div className="relative">
                            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-nirex-accent/20 to-nirex-accent/5 backdrop-blur-sm border border-nirex-accent/10 flex items-center justify-center">
                                <Mail className="w-12 h-12 text-nirex-accent/60" strokeWidth={1.5} />
                            </div>
                            <div className="absolute -bottom-2 -right-2 w-16 h-16 rounded-xl bg-gradient-to-br from-nirex-accent/30 to-nirex-accent/10 backdrop-blur-sm border border-nirex-accent/10 flex items-center justify-center">
                                <ArrowRight className="w-8 h-8 text-nirex-accent/60" strokeWidth={1.5} />
                            </div>
                        </div>

                        <blockquote className="text-2xl font-medium text-nirex-text-primary/90 leading-relaxed max-w-md">
                            "Secure, fast, and reliable. The password reset process took less than a minute."
                        </blockquote>
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-nirex-text-primary/10" />
                            <div>
                                <p className="text-nirex-text-primary font-medium">Emily Watson</p>
                                <p className="text-nirex-text-secondary text-sm">Security Engineer at Stripe</p>
                            </div>
                        </div>
                    </div>

                    <p className="text-nirex-text-muted/60 text-sm">{APP_NAME} {APP_NAME_SUFFIX}</p>
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 bg-nirex-base">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="w-full max-w-sm"
                >
                    {/* Mobile Logo */}
                    <div className="lg:hidden flex items-center justify-center gap-2 mb-10">
                        <img src={nirexLogo} alt="nirex" className="w-8 h-8" />
                        <span className="text-xl font-semibold tracking-tight text-nirex-text-primary">{APP_NAME}</span>
                        {APP_NAME_SUFFIX && <span className="font-mono text-[0.85em] text-nirex-text-primary">{APP_NAME_SUFFIX}</span>}
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
                                    <h1 className="text-2xl font-semibold tracking-tight text-nirex-text-primary mb-2">
                                        Reset your password
                                    </h1>
                                    <p className="text-nirex-text-secondary text-sm">
                                        Enter your email and we'll send you a reset link
                                    </p>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div>
                                        <label htmlFor="email" className="block text-sm font-medium text-nirex-text-primary mb-1.5">
                                            Email
                                        </label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-nirex-text-muted" />
                                            <input
                                                id="email"
                                                type="email"
                                                value={email}
                                                onChange={(e) => {
                                                    setEmail(e.target.value);
                                                    if (error) setError("");
                                                }}
                                                placeholder="name@company.com"
                                                className={`w-full h-10 pl-10 pr-4 rounded-lg border bg-nirex-base text-sm text-nirex-text-primary placeholder:text-nirex-text-muted focus:outline-none focus:ring-2 focus:ring-nirex-accent focus:border-transparent transition-all ${error ? "border-destructive focus:ring-destructive/20" : "border-border"
                                                    }`}
                                            />
                                        </div>
                                        {error && (
                                            <p className="mt-1.5 text-sm text-destructive flex items-center gap-1">
                                                <AlertCircle className="h-3 w-3" />
                                                {error}
                                            </p>
                                        )}
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className="w-full h-10 bg-nirex-accent text-nirex-text-inverse rounded-lg font-medium hover:bg-nirex-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {isLoading ? (
                                            <div className="h-4 w-4 border-2 border-nirex-text-inverse/30 border-t-nirex-text-inverse rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                Send reset link
                                                <ArrowRight className="h-4 w-4" />
                                            </>
                                        )}
                                    </button>
                                </form>

                                <div className="mt-6 text-center">
                                    <Link
                                        to="/auth/signin"
                                        className="inline-flex items-center gap-2 text-sm text-nirex-text-secondary hover:text-nirex-text-primary transition-colors"
                                    >
                                        <ArrowLeft className="h-4 w-4" />
                                        Back to sign in
                                    </Link>
                                </div>
                            </motion.div >
                        ) : (
                            <motion.div
                                key="success"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-center"
                            >
                                <div className="w-14 h-14 bg-nirex-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <CheckCircle2 className="h-7 w-7 text-nirex-accent" />
                                </div>
                                <h2 className="text-xl font-semibold text-nirex-text-primary mb-2">
                                    Check your email
                                </h2>
                                <p className="text-nirex-text-secondary text-sm mb-6">
                                    We've sent a password reset link to{" "}
                                    <span className="text-nirex-text-primary font-medium">{email}</span>
                                </p>
                                <div className="space-y-3">
                                    <button
                                        onClick={() => window.open("mailto:", "_blank")}
                                        className="w-full h-10 bg-nirex-accent text-nirex-text-inverse rounded-lg font-medium hover:bg-nirex-accent/90 transition-colors"
                                    >
                                        Open email app
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsSubmitted(false);
                                            setEmail("");
                                        }}
                                        className="text-sm text-nirex-text-secondary hover:text-nirex-text-primary transition-colors"
                                    >
                                        Didn't receive it? Resend
                                    </button>
                                </div>
                            </motion.div>
                        )
                        }
                    </AnimatePresence >
                </motion.div >
            </div >
        </div >
    );
}