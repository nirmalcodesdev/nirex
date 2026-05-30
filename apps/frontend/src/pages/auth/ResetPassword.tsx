import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, Eye, EyeOff, ArrowRight, CheckCircle2, Check, AlertCircle } from "lucide-react";
import { APP_NAME, APP_NAME_SUFFIX, PASSWORD_POLICY, resetPasswordSchema } from "@nirex/shared";
import nirexLogo from "@nirex/assets/images/nirex.svg";
import { authApi } from "../../features/auth/authApi";
import { PasswordPolicyFeedback } from "../../components/auth/PasswordPolicyFeedback";

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
        form?: string;
    }>({});
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token") ?? "";

    const validateForm = () => {
        const newErrors: { password?: string; confirmPassword?: string; form?: string } = {};
        const parsed = resetPasswordSchema.safeParse({
            token,
            password: formData.password,
        });

        if (!parsed.success) {
            for (const issue of parsed.error.issues) {
                const field = issue.path[0];
                if (field === "password") newErrors.password = issue.message;
                if (field === "token") newErrors.form = "This password reset link is invalid or incomplete.";
            }
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
        setErrors({});

        try {
            await authApi.resetPassword({
                token,
                password: formData.password,
            });
            setIsSuccess(true);
        } catch (error) {
            setErrors({
                form: error instanceof Error ? error.message : "Unable to reset password. Please request a new link.",
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

    if (isSuccess) {
        return (
            <div className="min-h-screen flex flex-col items-center bg-nirex-base relative px-4 py-16 overflow-y-auto">
                {/* Subtle ambient glow */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-emerald-500/[0.03] blur-[120px]" />
                </div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
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

                    <div className="flex items-center justify-center w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 mx-auto mb-5">
                        <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-2">
                        Password reset
                    </h1>
                    <p className="text-muted-foreground text-sm mb-8">
                        Your password has been successfully reset. You can now sign in with your new password.
                    </p>
                    <button
                        onClick={() => navigate("/auth/signin")}
                        className="w-full h-11 bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-all flex items-center justify-center gap-2 rounded-sm"
                    >
                        Sign in
                        <ArrowRight className="h-4 w-4" />
                    </button>
                </motion.div>
            </div>
        );
    }

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

                <div className="text-center mb-8">
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-2">
                        Set new password
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        Your new password must be different from your previous password
                    </p>
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

                    <div className="space-y-1.5">
                        <label htmlFor="password" className="block text-sm font-medium text-foreground">
                            New password
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
                                placeholder="Enter a strong password"
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

                        <PasswordPolicyFeedback password={formData.password} />
                        {errors.password && (
                            <p className="text-sm text-destructive flex items-center gap-1.5">
                                <AlertCircle className="h-3.5 w-3.5" />
                                {errors.password}
                            </p>
                        )}
                    </div>

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

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full h-11 bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 rounded-sm"
                    >
                        {isLoading ? (
                            <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin rounded-full" />
                        ) : (
                            <>
                                Reset password
                                <ArrowRight className="h-4 w-4" />
                            </>
                        )}
                    </button>
                </form>

                <p className="mt-8 text-center text-sm text-muted-foreground">
                    Remember your password?{" "}
                    <Link to="/auth/signin" className="text-foreground font-medium hover:underline underline-offset-2">
                        Sign in
                    </Link>
                </p>
            </motion.div>
        </div>
    );
}
