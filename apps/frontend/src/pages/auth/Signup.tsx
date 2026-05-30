import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, Mail, Lock, ArrowRight, User, Check, AlertCircle } from "lucide-react";
import { APP_NAME, APP_NAME_SUFFIX, PASSWORD_POLICY, signUpSchema } from "@nirex/shared";
import nirexLogo from "@nirex/assets/images/nirex.svg";
import { authApi } from "../../features/auth/authApi";
import { ROUTES } from "../../constant/routes";
import { PasswordPolicyFeedback } from "../../components/auth/PasswordPolicyFeedback";

export function Signup() {
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
    });
    const [showPassword, setShowPassword] = useState(false);
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [oauthProvider, setOauthProvider] = useState<"google" | "github" | null>(null);
    const [errors, setErrors] = useState<{
        name?: string;
        email?: string;
        password?: string;
        confirmPassword?: string;
        terms?: string;
        form?: string;
    }>({});
    const navigate = useNavigate();

    const validateForm = () => {
        const newErrors: {
            name?: string;
            email?: string;
            password?: string;
            confirmPassword?: string;
            terms?: string;
            form?: string;
        } = {};
        const parsed = signUpSchema.safeParse({
            email: formData.email,
            fullName: formData.name,
            password: formData.password,
        });

        if (!parsed.success) {
            for (const issue of parsed.error.issues) {
                const field = issue.path[0];
                if (field === "fullName") newErrors.name = issue.message;
                if (field === "email") newErrors.email = issue.message;
                if (field === "password") newErrors.password = issue.message;
            }
        }

        if (!formData.confirmPassword) {
            newErrors.confirmPassword = "Please confirm your password";
        } else if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = "Passwords do not match";
        }

        if (!agreedToTerms) {
            newErrors.terms = "You must agree to the terms and privacy policy";
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
        setErrors({});

        try {
            await authApi.signUp({
                email: formData.email,
                fullName: formData.name,
                password: formData.password,
            });
            navigate(ROUTES.AUTH.VERIFY_EMAIL, {
                state: { email: formData.email.trim().toLowerCase() },
            });
        } catch (error) {
            setErrors({
                form: error instanceof Error ? error.message : "Unable to create account. Please try again.",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const updateField = (field: keyof typeof formData, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors((prev) => ({ ...prev, [field]: undefined }));
        }
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
                form: error instanceof Error ? error.message : "OAuth sign-in is unavailable.",
            });
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

                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-2">
                        Create your account
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Already have an account?{" "}
                        <Link to="/auth/signin" className="text-primary font-medium hover:underline underline-offset-2">
                            Sign in
                        </Link>
                    </p>
                </div>

                {/* Social Login */}
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
                            or use email
                        </span>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {errors.form && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-3.5 bg-destructive/5 border border-destructive/15 rounded-sm flex items-start gap-2.5"
                        >
                            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                            <p className="text-sm text-destructive">{errors.form}</p>
                        </motion.div>
                    )}

                    {/* Full name */}
                    <div className="space-y-1.5">
                        <label htmlFor="name" className="block text-sm font-medium text-foreground">
                            Full name
                        </label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                id="name"
                                type="text"
                                value={formData.name}
                                onChange={(e) => updateField("name", e.target.value)}
                                placeholder="John Doe"
                                className={`w-full h-11 pl-10 pr-4 rounded-sm border bg-nirex-base text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-[1.5px] focus:ring-primary/30 focus:border-primary transition-all ${
                                    errors.name
                                        ? "border-destructive focus:ring-destructive/20 focus:border-destructive"
                                        : "border-border hover:border-border/80"
                                }`}
                            />
                        </div>
                        {errors.name && (
                            <p className="text-sm text-destructive flex items-center gap-1.5">
                                <AlertCircle className="h-3.5 w-3.5" />
                                {errors.name}
                            </p>
                        )}
                    </div>

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
                                value={formData.email}
                                onChange={(e) => updateField("email", e.target.value)}
                                placeholder="name@company.com"
                                className={`w-full h-11 pl-10 pr-4 rounded-sm border bg-nirex-base text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-[1.5px] focus:ring-primary/30 focus:border-primary transition-all ${
                                    errors.email
                                        ? "border-destructive focus:ring-destructive/20 focus:border-destructive"
                                        : "border-border hover:border-border/80"
                                }`}
                            />
                        </div>
                        {errors.email && (
                            <p className="text-sm text-destructive flex items-center gap-1.5">
                                <AlertCircle className="h-3.5 w-3.5" />
                                {errors.email}
                            </p>
                        )}
                    </div>

                    {/* Password */}
                    <div className="space-y-1.5">
                        <label htmlFor="password" className="block text-sm font-medium text-foreground">
                            Password
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                value={formData.password}
                                onChange={(e) => updateField("password", e.target.value)}
                                autoComplete="new-password"
                                minLength={PASSWORD_POLICY.minLength}
                                maxLength={PASSWORD_POLICY.maxLength}
                                spellCheck={false}
                                placeholder="Create a strong password"
                                className={`w-full h-11 pl-10 pr-10 rounded-sm border bg-nirex-base text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-[1.5px] focus:ring-primary/30 focus:border-primary transition-all ${
                                    errors.password
                                        ? "border-destructive focus:ring-destructive/20 focus:border-destructive"
                                        : "border-border hover:border-border/80"
                                }`}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>

                        <PasswordPolicyFeedback
                            password={formData.password}
                            context={{ email: formData.email, fullName: formData.name }}
                        />
                        {errors.password && (
                            <p className="text-sm text-destructive flex items-center gap-1.5">
                                <AlertCircle className="h-3.5 w-3.5" />
                                {errors.password}
                            </p>
                        )}
                    </div>

                    {/* Confirm password */}
                    <div className="space-y-1.5">
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground">
                            Confirm password
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                id="confirmPassword"
                                type={showPassword ? "text" : "password"}
                                value={formData.confirmPassword}
                                onChange={(e) => updateField("confirmPassword", e.target.value)}
                                autoComplete="new-password"
                                minLength={PASSWORD_POLICY.minLength}
                                maxLength={PASSWORD_POLICY.maxLength}
                                spellCheck={false}
                                placeholder="Re-enter your password"
                                className={`w-full h-11 pl-10 pr-4 rounded-sm border bg-nirex-base text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-[1.5px] focus:ring-primary/30 focus:border-primary transition-all ${
                                    errors.confirmPassword
                                        ? "border-destructive focus:ring-destructive/20 focus:border-destructive"
                                        : "border-border hover:border-border/80"
                                }`}
                            />
                        </div>
                        {formData.confirmPassword && formData.password === formData.confirmPassword && !errors.confirmPassword && (
                            <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                <Check className="h-3 w-3" /> Passwords match
                            </p>
                        )}
                        {errors.confirmPassword && (
                            <p className="text-sm text-destructive flex items-center gap-1.5">
                                <AlertCircle className="h-3.5 w-3.5" />
                                {errors.confirmPassword}
                            </p>
                        )}
                    </div>

                    {/* Terms */}
                    <div className="space-y-2">
                        <div className="flex items-start gap-2.5">
                            <input
                                id="terms"
                                type="checkbox"
                                checked={agreedToTerms}
                                onChange={(e) => {
                                    setAgreedToTerms(e.target.checked);
                                    if (errors.terms) {
                                        setErrors(Object.fromEntries(Object.entries(errors).filter(([k]) => k !== 'terms')));
                                    }
                                }}
                                className={`h-5 w-5 mt-0.5 rounded border-2 accent-primary cursor-pointer focus:ring-2 focus:ring-primary/20 ${
                                    errors.terms ? "border-destructive" : "border-border"
                                }`}
                            />
                            <label htmlFor="terms" className="text-sm text-muted-foreground leading-relaxed">
                                I agree to the{" "}
                                <Link to="/terms" state={{ from: "/auth/signup" }} className="text-foreground hover:underline underline-offset-2">Terms</Link>
                                {" "}and{" "}
                                <Link to="/privacy" state={{ from: "/auth/signup" }} className="text-foreground hover:underline underline-offset-2">Privacy Policy</Link>
                            </label>
                        </div>
                        {errors.terms && (
                            <p className="text-sm text-destructive flex items-center gap-1.5 ml-6">
                                <AlertCircle className="h-3.5 w-3.5" />
                                {errors.terms}
                            </p>
                        )}
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
                                Create account
                                <ArrowRight className="h-4 w-4" />
                            </>
                        )}
                    </button>
                </form>

                <p className="mt-6 text-center text-xs text-muted-foreground">
                    Free 14-day trial. No credit card required.
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
