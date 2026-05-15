import { Check } from "lucide-react";
import {
  getPasswordStrength,
  validatePasswordPolicy,
  type PasswordValidationContext,
} from "@nirex/shared";

interface PasswordPolicyFeedbackProps {
  password: string;
  context?: PasswordValidationContext;
  compact?: boolean;
}

const strengthColors = [
  "bg-nirex-surface",
  "bg-destructive",
  "bg-warning",
  "bg-success",
  "bg-nirex-accent",
] as const;

export function PasswordPolicyFeedback({ password, context, compact = false }: PasswordPolicyFeedbackProps) {
  if (!password) return null;

  const result = validatePasswordPolicy(password, context);
  const strength = getPasswordStrength(password, context, result.issues);
  const activeColor = strengthColors[strength.score] ?? "bg-nirex-surface";

  return (
    <div className={compact ? "space-y-2" : "mt-2 space-y-2"}>
      <div className="flex gap-1 h-1" aria-hidden="true">
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={`flex-1 rounded-full transition-colors ${
              level <= strength.score ? activeColor : "bg-nirex-surface"
            }`}
          />
        ))}
      </div>
      <p className={`text-xs ${strength.score >= 3 ? "text-nirex-accent" : "text-nirex-text-muted"}`}>
        {strength.label}
      </p>
      <div className="space-y-1.5 p-3 bg-nirex-surface rounded-lg">
        {result.requirements.map((requirement) => (
          <div
            key={requirement.code}
            className={`flex items-center gap-2 text-xs ${
              requirement.met ? "text-nirex-accent" : "text-nirex-text-muted"
            }`}
          >
            <Check className={`h-3 w-3 ${requirement.met ? "opacity-100" : "opacity-0"}`} />
            {requirement.label}
          </div>
        ))}
      </div>
    </div>
  );
}
