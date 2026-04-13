import nirexLogo from "@nirex/assets/images/nirex.svg";
import { APP_NAME, APP_NAME_SUFFIX } from "@nirex/shared";
import { Link } from "react-router-dom";

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

export function StepIndicator({ currentStep, totalSteps }: StepIndicatorProps) {
  return (
    <header className="relative z-10 h-20 flex items-center justify-between px-6 lg:px-12">
      <div className="flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2">
          <img src={nirexLogo} alt={APP_NAME} className="w-8 h-8" />
          <div className="flex items-center gap-0">
            <span className="font-display font-bold text-lg">{APP_NAME}</span>
            {APP_NAME_SUFFIX && <span className="font-mono text-[0.85em]">{APP_NAME_SUFFIX}</span>}
          </div>
        </Link>
      </div>

      {currentStep > 0 && currentStep < totalSteps && (
        <div className="flex items-center gap-6">
          <span className="text-[10px] text-nirex-text-muted uppercase font-black tracking-[0.2em] hidden sm:inline">
            Phase {currentStep} of {totalSteps - 1}
          </span>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalSteps - 1 }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-500 ease-out ${i + 1 === currentStep
                  ? "w-8 bg-nirex-accent shadow-[0_0_8px_hsl(var(--nirex-accent)/0.5)]"
                  : i + 1 < currentStep
                    ? "w-2 bg-nirex-accent/40"
                    : "w-2 bg-nirex-accent/10"
                  }`}
              />
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
