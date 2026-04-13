import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, Mail, Lock, ArrowRight, User, Check, AlertCircle } from "lucide-react";
import { APP_NAME, APP_NAME_SUFFIX } from "@nirex/shared";
import nirexLogo from "@nirex/assets/images/nirex.svg";

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
    const [errors, setErrors] = useState<{
        name?: string;
        email?: string;
        password?: string;
        confirmPassword?: string;
        terms?: string;
    }>({});
    const navigate = useNavigate();

    const passwordStrength = (password: string) => {
        let strength = 0;
        if (password.length >= 8) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^A-Za-z0-9]/.test(password)) strength++;
        return strength;
    };

    const strength = passwordStrength(formData.password);
    const strengthLabels = ["Weak", "Fair", "Good", "Strong"];
    const strengthColors = ["bg-destructive", "bg-warning", "bg-success", "bg-nirex-accent"];

    const requirements = [
        { label: "At least 8 characters", met: formData.password.length >= 8 },
        { label: "One uppercase letter", met: /[A-Z]/.test(formData.password) },
        { label: "One number", met: /[0-9]/.test(formData.password) },
        { label: "One special character", met: /[^A-Za-z0-9]/.test(formData.password) },
    ];

    const validateForm = () => {
        const newErrors: {
            name?: string;
            email?: string;
            password?: string;
            confirmPassword?: string;
            terms?: string;
        } = {};

        if (!formData.name.trim()) {
            newErrors.name = "Full name is required";
        }

        if (!formData.email.trim()) {
            newErrors.email = "Email is required";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = "Please enter a valid email address";
        }

        if (!formData.password) {
            newErrors.password = "Password is required";
        } else if (strength < 2) {
            newErrors.password = "Please use a stronger password";
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
        setTimeout(() => {
            setIsLoading(false);
            navigate("/auth/verify-email");
        }, 1200);
    };

    const updateField = (field: keyof typeof formData, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors((prev) => ({ ...prev, [field]: undefined }));
        }
    };

    return (
        <div className="min-h-screen flex">
            {/* Left Side - Form */}
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
                            Create your account
                        </h1>
                        <p className="text-nirex-text-secondary text-sm">
                            Already have an account?{" "}
                            <Link to="/auth/signin" className="text-nirex-text-primary font-medium hover:underline">
                                Sign in
                            </Link>
                        </p>
                    </div>

                    {/* Social Login */}
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
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-nirex-text-primary mb-1.5">
                                Full name
                            </label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-nirex-text-muted" />
                                <input
                                    id="name"
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => updateField("name", e.target.value)}
                                    placeholder="John Doe"
                                    className={`w-full h-10 pl-10 pr-4 rounded-lg border bg-nirex-base text-sm text-nirex-text-primary placeholder:text-nirex-text-muted focus:outline-none focus:ring-2 focus:ring-nirex-accent focus:border-transparent transition-all ${errors.name ? "border-destructive focus:ring-destructive/20" : "border-border"}
                                        }`}
                                />
                            </div>
                            {errors.name && (
                                <p className="mt-1.5 text-sm text-destructive flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" />
                                    {errors.name}
                                </p>
                            )}
                        </div>

                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-nirex-text-primary mb-1.5">
                                Email
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-nirex-text-muted" />
                                <input
                                    id="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => updateField("email", e.target.value)}
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
                            <label htmlFor="password" className="block text-sm font-medium text-nirex-text-primary mb-1.5">
                                Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-nirex-text-muted" />
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    value={formData.password}
                                    onChange={(e) => updateField("password", e.target.value)}
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

                            {/* Password Strength */}
                            {formData.password && (
                                <div className="mt-2 space-y-2">
                                    <div className="flex gap-1 h-1">
                                        {[1, 2, 3, 4].map((level) => (
                                            <div
                                                key={level}
                                                className={`flex-1 rounded-full transition-colors ${level <= strength ? strengthColors[strength - 1] : "bg-nirex-surface"
                                                    }`}
                                            />
                                        ))}
                                    </div>
                                    <p className={`text-xs ${strength > 1 ? "text-nirex-accent" : "text-nirex-text-muted"}`}>
                                        {strength > 0 ? strengthLabels[strength - 1] : "Enter a password"}
                                    </p>
                                </div>
                            )}
                            {errors.password && (
                                <p className="mt-1.5 text-sm text-destructive flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" />
                                    {errors.password}
                                </p>
                            )}
                        </div>

                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-nirex-text-primary mb-1.5">
                                Confirm password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-nirex-text-muted" />
                                <input
                                    id="confirmPassword"
                                    type={showPassword ? "text" : "password"}
                                    value={formData.confirmPassword}
                                    onChange={(e) => updateField("confirmPassword", e.target.value)}
                                    placeholder="••••••••"
                                    className={`w-full h-10 pl-10 pr-4 rounded-lg border bg-nirex-base text-sm text-nirex-text-primary placeholder:text-nirex-text-muted focus:outline-none focus:ring-2 focus:ring-nirex-accent focus:border-transparent transition-all ${errors.confirmPassword ? "border-destructive focus:ring-destructive/20" : "border-border"}
                                        }`}
                                />
                            </div>
                            {formData.confirmPassword && formData.password === formData.confirmPassword && !errors.confirmPassword && (
                                <p className="mt-1 text-xs text-nirex-accent flex items-center gap-1">
                                    <Check className="h-3 w-3" /> Passwords match
                                </p>
                            )}
                            {errors.confirmPassword && (
                                <p className="mt-1.5 text-sm text-destructive flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" />
                                    {errors.confirmPassword}
                                </p>
                            )}
                        </div>

                        {/* Password Requirements */}
                        {formData.password && (
                            <div className="space-y-1.5 p-3 bg-nirex-surface rounded-lg">
                                {requirements.map((req) => (
                                    <div
                                        key={req.label}
                                        className={`flex items-center gap-2 text-xs ${req.met ? "text-nirex-accent" : "text-nirex-text-muted"
                                            }`}
                                    >
                                        <Check className={`h-3 w-3 ${req.met ? "opacity-100" : "opacity-0"}`} />
                                        {req.label}
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex items-start">
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
                                className={`h-4 w-4 mt-0.5 rounded text-nirex-accent focus:ring-nirex-accent ${errors.terms ? "border-destructive" : "border-border"}
                                    }`}
                            />
                            <label htmlFor="terms" className="ml-2 text-sm text-nirex-text-secondary">
                                I agree to the{" "}
                                <Link to="/terms" state={{ from: "/auth/signup" }} className="text-nirex-text-primary hover:underline">Terms</Link>
                                {" "}and{" "}
                                <Link to="/privacy" state={{ from: "/auth/signup" }} className="text-nirex-text-primary hover:underline">Privacy Policy</Link>
                            </label>
                        </div>
                        {errors.terms && (
                            <p className="-mt-2 text-sm text-destructive flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {errors.terms}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full h-10 bg-nirex-accent text-nirex-text-inverse rounded-lg font-medium hover:bg-nirex-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <div className="h-4 w-4 border-2 border-nirex-text-inverse/30 border-t-nirex-text-inverse rounded-full animate-spin" />
                            ) : (
                                <>
                                    Create account
                                    <ArrowRight className="h-4 w-4" />
                                </>
                            )}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-xs text-nirex-text-muted">
                        Free 14-day trial. No credit card required.
                    </p>
                </motion.div>
            </div>

            {/* Right Side - Branding */}
            <div className="hidden lg:flex lg:w-[45%] bg-nirex-surface relative overflow-hidden">
                {/* Abstract Gradient Background */}
                <div className="absolute inset-0 bg-gradient-to-bl from-nirex-accent/5 via-transparent to-nirex-accent/10" />

                {/* Floating Shapes */}
                <div className="absolute top-1/3 right-1/4 w-72 h-72 bg-nirex-accent/10 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-nirex-accent/5 rounded-full blur-3xl animate-pulse" />
                <div className="absolute top-1/4 left-1/3 w-40 h-40 bg-gradient-to-br from-nirex-accent/20 to-transparent rounded-full blur-2xl" />

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
                            <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-nirex-accent/20 to-nirex-accent/5 backdrop-blur-sm border border-nirex-accent/10 flex items-center justify-center">
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-nirex-accent/30" />
                                    <div className="w-8 h-8 rounded-lg bg-nirex-accent/20" />
                                    <div className="w-8 h-8 rounded-lg bg-nirex-accent/20" />
                                    <div className="w-8 h-8 rounded-lg bg-nirex-accent/40" />
                                </div>
                            </div>
                            <div className="absolute -bottom-3 -left-3 w-20 h-20 rounded-xl bg-gradient-to-br from-nirex-accent/30 to-nirex-accent/10 backdrop-blur-sm border border-nirex-accent/10 flex items-center justify-center">
                                <Check className="w-10 h-10 text-nirex-accent/60" strokeWidth={1.5} />
                            </div>
                        </div>

                        <blockquote className="text-2xl font-medium text-nirex-text-primary/90 leading-relaxed max-w-md">
                            "Join thousands of developers who trust {APP_NAME} {APP_NAME_SUFFIX} for their deployment workflow."
                        </blockquote>
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-nirex-text-primary/10" />
                            <div>
                                <p className="text-nirex-text-primary font-medium">Michael Park</p>
                                <p className="text-nirex-text-secondary text-sm">CTO at Linear</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-8 text-nirex-text-muted/60 text-sm">
                        <span>Trusted by</span>
                        <div className="flex gap-6">
                            <span className="text-nirex-text-secondary">Vercel</span>
                            <span className="text-nirex-text-secondary">Linear</span>
                            <span className="text-nirex-text-secondary">Notion</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
