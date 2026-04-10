import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, Eye, EyeOff, ArrowRight, CheckCircle2, Check, Hexagon, AlertCircle } from "lucide-react";

export function ResetPassword() {
    const [formData, setFormData] = useState({
        password: "",
        confirmPassword: "",
    });
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [errors, setErrors] = useState<{
        password?: string;
        confirmPassword?: string;
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
        const newErrors: { password?: string; confirmPassword?: string } = {};

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
            setIsSuccess(true);
        }, 1200);
    };

    const updateField = (field: keyof typeof formData, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors((prev) => ({ ...prev, [field]: undefined }));
        }
    };

    if (isSuccess) {
        return (
            <div className="min-h-screen flex">
                {/* Left Side */}
                <div className="hidden lg:flex lg:w-[45%] bg-nirex-surface relative overflow-hidden">
                    {/* Abstract Gradient Background */}
                    <div className="absolute inset-0 bg-gradient-to-br from-nirex-accent/5 via-transparent to-nirex-accent/10" />

                    {/* Floating Shapes */}
                    <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-nirex-accent/10 rounded-full blur-3xl" />
                    <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-nirex-accent/5 rounded-full blur-3xl" />

                    <div className="relative z-10 flex flex-col justify-between p-16 w-full">
                        <Link to="/" className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-nirex-accent text-nirex-text-inverse flex items-center justify-center">
                                <Hexagon size={20} strokeWidth={2.5} />
                            </div>
                            <span className="text-xl font-semibold tracking-tight text-nirex-text-primary">nirex</span>
                        </Link>
                        <div />
                        <p className="text-nirex-text-muted/60 text-sm">© 2025 nirex</p>
                    </div>
                </div>

                {/* Right Side - Success */}
                <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 bg-nirex-base">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full max-w-sm text-center"
                    >
                        {/* Mobile Logo */}
                        <div className="lg:hidden flex items-center justify-center gap-2 mb-10">
                            <div className="w-8 h-8 rounded-lg bg-nirex-accent text-nirex-text-inverse flex items-center justify-center">
                                <Hexagon size={18} strokeWidth={2.5} />
                            </div>
                            <span className="text-xl font-semibold tracking-tight text-nirex-text-primary">nirex</span>
                        </div>

                        <div className="w-14 h-14 bg-nirex-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 className="h-7 w-7 text-nirex-accent" />
                        </div>
                        <h1 className="text-2xl font-semibold tracking-tight text-nirex-text-primary mb-2">
                            Password reset
                        </h1>
                        <p className="text-nirex-text-secondary text-sm mb-6">
                            Your password has been successfully reset. You can now sign in with your new password.
                        </p>
                        <button
                            onClick={() => navigate("/auth/signin")}
                            className="w-full h-10 bg-nirex-accent text-nirex-text-inverse rounded-lg font-medium hover:bg-nirex-accent/90 transition-colors flex items-center justify-center gap-2"
                        >
                            Sign in
                            <ArrowRight className="h-4 w-4" />
                        </button>
                    </motion.div>
                </div>
            </div>
        );
    }

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
                        <div className="w-8 h-8 rounded-lg bg-nirex-accent text-nirex-text-inverse flex items-center justify-center">
                            <Hexagon size={18} strokeWidth={2.5} />
                        </div>
                        <span className="text-xl font-semibold tracking-tight text-nirex-text-primary">nirex</span>
                    </div>

                    <div className="text-center mb-8">
                        <h1 className="text-2xl font-semibold tracking-tight text-nirex-text-primary mb-2">
                            Set new password
                        </h1>
                        <p className="text-nirex-text-secondary text-sm">
                            Your new password must be different from your previous password
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-nirex-text-primary mb-1.5">
                                New password
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
                                        className={`flex items-center gap-2 text-xs ${req.met ? "text-nirex-accent" : "text-nirex-text-muted"}
                                            }`}
                                    >
                                        <Check className={`h-3 w-3 ${req.met ? "opacity-100" : "opacity-0"}`} />
                                        {req.label}
                                    </div>
                                ))}
                            </div>
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
                                    Reset password
                                    <ArrowRight className="h-4 w-4" />
                                </>
                            )}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-sm text-nirex-text-secondary">
                        Remember your password?{" "}
                        <Link to="/auth/signin" className="text-nirex-text-primary font-medium hover:underline">
                            Sign in
                        </Link>
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

                {/* Content */}
                <div className="relative z-10 flex flex-col justify-between p-16 w-full">
                    <Link to="/" className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-nirex-accent text-nirex-text-inverse flex items-center justify-center">
                            <Hexagon size={20} strokeWidth={2.5} />
                        </div>
                        <span className="text-xl font-semibold tracking-tight text-nirex-text-primary">nirex</span>
                    </Link>

                    <div className="space-y-8">
                        {/* Large Visual Element */}
                        <div className="relative">
                            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-nirex-accent/20 to-nirex-accent/5 backdrop-blur-sm border border-nirex-accent/10 flex items-center justify-center">
                                <Lock className="w-12 h-12 text-nirex-accent/60" strokeWidth={1.5} />
                            </div>
                            <div className="absolute -bottom-2 -right-2 w-16 h-16 rounded-xl bg-gradient-to-br from-nirex-accent/30 to-nirex-accent/10 backdrop-blur-sm border border-nirex-accent/20 flex items-center justify-center">
                                <Check className="w-8 h-8 text-nirex-accent" strokeWidth={2} />
                            </div>
                        </div>

                        <blockquote className="text-2xl font-medium text-nirex-text-primary/90 leading-relaxed max-w-md">
                            "Security is not a product, but a process. We take your account protection seriously."
                        </blockquote>
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-nirex-text-primary/10" />
                            <div>
                                <p className="text-nirex-text-primary font-medium">Alex Rivera</p>
                                <p className="text-nirex-text-secondary text-sm">Head of Security at nirex</p>
                            </div>
                        </div>
                    </div>

                    <p className="text-nirex-text-muted/60 text-sm">© 2025 nirex</p>
                </div>
            </div>
        </div>
    );
}
