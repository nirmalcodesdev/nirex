import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, Mail, Lock, ArrowRight } from "lucide-react";
import { AlertCircle } from "lucide-react";
import { APP_NAME, APP_NAME_SUFFIX } from "@nirex/shared";
import nirexLogo from "@nirex/assets/images/nirex.svg";

export function Signin() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
    const navigate = useNavigate();

    const validateForm = () => {
        const newErrors: { email?: string; password?: string; form?: string } = {};

        if (!email.trim()) {
            newErrors.email = "Email is required";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            newErrors.email = "Please enter a valid email address";
        }

        if (!password) {
            newErrors.password = "Password is required";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setIsLoading(true);
        setTimeout(() => {
            setIsLoading(false);
            
            // Check if onboarding is complete
            const onboardingComplete = localStorage.getItem("nirex-onboarding-complete");

            if (onboardingComplete === "true") {
                navigate("/"); // Redirect to dashboard if onboarding is complete
            } else {
                navigate("/onboarding"); // Redirect to onboarding if not complete
            }
        }, 1200);
    };

    return (
        <div className="min-h-screen flex">
            {/* Left Side - Branding */}
            <div className="hidden lg:flex lg:w-[45%] bg-nirex-surface relative overflow-hidden">
                {/* Abstract Gradient Background */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10" />

                {/* Floating Shapes */}
                <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
                <div className="absolute top-1/2 right-1/3 w-48 h-48 bg-gradient-to-br from-primary/20 to-transparent rounded-full blur-2xl" />

                {/* Content */}
                <div className="relative z-10 flex flex-col justify-between p-16 w-full">
                    <Link to="/" className="flex items-center gap-3">
                        <img src={nirexLogo} alt={APP_NAME} className="w-9 h-9" />
                        <div className="flex items-center gap-0">
                            <span className="text-xl font-semibold tracking-tight text-nirex-text-primary">{APP_NAME}</span>
                            {APP_NAME_SUFFIX && <span className="font-mono text-[0.85em] text-nirex-text-primary">{APP_NAME_SUFFIX}</span>}
                        </div>
                    </Link>

                    <div className="space-y-8">
                        {/* Large Visual Element */}
                        <div className="relative">
                            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 backdrop-blur-sm border border-primary/10 flex items-center justify-center">
                                <img src={nirexLogo} alt={APP_NAME} className="w-14 h-14" />

                            </div>
                            <div className="absolute -bottom-2 -right-2 w-16 h-16 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 backdrop-blur-sm border border-primary/10 flex items-center justify-center">
                                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                                    <div className="w-3 h-3 rounded-full bg-primary/60" />
                                </div>
                            </div>
                        </div>

                        <blockquote className="text-2xl font-medium text-nirex-text-primary/90 leading-relaxed max-w-md">
                            "The most efficient way to manage and deploy your development environments."
                        </blockquote>
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-nirex-text-primary/10" />
                            <div>
                                <p className="text-nirex-text-primary font-medium">Sarah Chen</p>
                                <p className="text-nirex-text-secondary text-sm">Engineering Lead at Vercel</p>
                            </div>
                        </div>
                    </div>

                    <p className="text-nirex-text-muted text-sm">{APP_NAME} {APP_NAME_SUFFIX}</p>
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
                        <img src={nirexLogo} alt={APP_NAME} className="w-8 h-8" />
                        <div className="flex items-center gap-0">
                            <span className="text-xl font-semibold tracking-tight text-nirex-text-primary">{APP_NAME}</span>
                            {APP_NAME_SUFFIX && <span className="font-mono text-[0.85em] text-nirex-text-primary">{APP_NAME_SUFFIX}</span>}
                        </div>
                    </div>

                    <div className="text-center mb-8">
                        <h1 className="text-2xl font-semibold tracking-tight text-nirex-text-primary mb-2">
                            Sign in to your account
                        </h1>
                        <p className="text-nirex-text-secondary text-sm">
                            Don't have an account?{" "}
                            <Link to="/auth/signup" className="text-nirex-text-primary font-medium hover:underline">
                                Sign up
                            </Link>
                        </p>
                    </div>

                    {/* Social Sign in */}
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        <button
                            type="button"
                            className="flex items-center justify-center gap-2 h-10 px-4 rounded-lg border border-border bg-nirex-surface hover:bg-nirex-elevated transition-colors text-sm font-medium text-nirex-text-primary"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            Google
                        </button>
                        <button
                            type="button"
                            className="flex items-center justify-center gap-2 h-10 px-4 rounded-lg border border-border bg-nirex-surface hover:bg-nirex-elevated transition-colors text-sm font-medium text-nirex-text-primary"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                            </svg>
                            GitHub
                        </button>
                    </div>

                    <div className="relative mb-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-border" />
                        </div>
                        <div className="relative flex justify-center text-xs">
                            <span className="bg-nirex-base px-2 text-nirex-text-muted">or</span>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {errors.form && (
                            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-sm text-destructive">
                                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                                {errors.form}
                            </div>
                        )}

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
                                        if (errors.email) {
                                            setErrors(Object.fromEntries(Object.entries(errors).filter(([k]) => k !== 'email')));
                                        }
                                    }}
                                    placeholder="name@company.com"
                                    className={`w-full h-10 pl-10 pr-4 rounded-lg border bg-nirex-base text-sm text-nirex-text-primary placeholder:text-nirex-text-muted focus:outline-none focus:ring-2 focus:ring-nirex-accent focus:border-transparent transition-all ${errors.email ? "border-destructive focus:ring-destructive/20" : "border-border"}
                                        }`}
                                />
                            </div>
                            {errors.email && (
                                <p className="mt-1.5 text-sm text-destructive flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" />
                                    {errors.email}
                                </p>
                            )}
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label htmlFor="password" className="block text-sm font-medium text-nirex-text-primary">
                                    Password
                                </label>
                                <Link
                                    to="/auth/forgot-password"
                                    className="text-sm text-nirex-text-secondary hover:text-nirex-text-primary transition-colors"
                                >
                                    Forgot?
                                </Link>
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-nirex-text-muted" />
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => {
                                        setPassword(e.target.value);
                                        if (errors.password) {
                                            setErrors(Object.fromEntries(Object.entries(errors).filter(([k]) => k !== 'password')));
                                        }
                                    }}
                                    placeholder="••••••••"
                                    className={`w-full h-10 pl-10 pr-10 rounded-lg border bg-nirex-base text-sm text-nirex-text-primary placeholder:text-nirex-text-muted focus:outline-none focus:ring-2 focus:ring-nirex-accent focus:border-transparent transition-all ${errors.password ? "border-destructive focus:ring-destructive/20" : "border-border"}
                                        }`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-nirex-text-muted hover:text-nirex-text-primary transition-colors"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            {errors.password && (
                                <p className="mt-1.5 text-sm text-destructive flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" />
                                    {errors.password}
                                </p>
                            )}
                        </div>

                        <div className="flex items-center">
                            <input
                                id="remember"
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                className="h-4 w-4 rounded border-border text-nirex-accent focus:ring-nirex-accent"
                            />
                            <label htmlFor="remember" className="ml-2 text-sm text-nirex-text-secondary">
                                Remember me for 30 days
                            </label>
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
                                    Sign in
                                    <ArrowRight className="h-4 w-4" />
                                </>
                            )}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-xs text-nirex-text-muted">
                        By signing in, you agree to our{" "}
                        <Link to="/terms" state={{ from: "/auth/signin" }} className="text-nirex-text-primary hover:underline">Terms</Link>
                        {" "}and{" "}
                        <Link to="/privacy" state={{ from: "/auth/signin" }} className="text-nirex-text-primary hover:underline">Privacy</Link>
                    </p>
                </motion.div>
            </div>
        </div>
    );
}
