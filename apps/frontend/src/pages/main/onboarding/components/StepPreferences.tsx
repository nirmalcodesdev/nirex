import type { OnboardingPreferences } from "@/types/onboarding";
import { Zap, BarChart3, Sparkles, ArrowRight, Loader2, type LucideIcon } from "lucide-react";

interface PreferenceItem {
  id: keyof OnboardingPreferences;
  title: string;
  desc: string;
  icon: LucideIcon;
}

interface StepPreferencesProps {
  preferences: OnboardingPreferences;
  isLoading: boolean;
  onToggle: (id: keyof OnboardingPreferences) => void;
  onComplete: () => void;
}

const PREFERENCE_ITEMS: PreferenceItem[] = [
  { id: "emailNotifications", title: "Deployment notifications", desc: "Get notified when deployments succeed or fail", icon: Zap },
  { id: "weeklyReports", title: "Weekly usage reports", desc: "Receive a summary of your deployments and usage", icon: BarChart3 },
  { id: "betaAccess", title: "Early access to features", desc: "Try new features before they're released", icon: Sparkles },
];

export function StepPreferences({ preferences, isLoading, onToggle, onComplete }: StepPreferencesProps) {
  return (
    <div className="max-w-xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl sm:text-3xl font-display font-bold mb-2 text-nirex-text-primary">Almost done</h2>
        <p className="text-nirex-text-secondary">Customize your experience and communication</p>
      </div>

      <div className="space-y-3">
        {PREFERENCE_ITEMS.map((item) => (
          <label
            key={item.id}
            className="flex items-center gap-4 p-5 rounded-2xl border border-nirex-accent/10 bg-nirex-surface/40 hover:bg-nirex-surface/60 cursor-pointer transition-all hover:border-nirex-accent/30 group"
          >
            <div className="w-11 h-11 rounded-xl bg-nirex-accent/10 flex items-center justify-center shrink-0 border border-nirex-accent/10 group-hover:scale-110 transition-transform">
              <item.icon size={20} className="text-nirex-accent" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-sm text-nirex-text-primary">{item.title}</h3>
              <p className="text-xs text-nirex-text-muted mt-0.5">{item.desc}</p>
            </div>
            <div className="relative inline-flex items-center">
              <input
                type="checkbox"
                checked={preferences[item.id]}
                onChange={() => onToggle(item.id)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-nirex-void/50 border border-white/5 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-nirex-text-muted after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-nirex-accent peer-checked:after:bg-white" />
            </div>
          </label>
        ))}
      </div>

      <div className="mt-10 text-center">
        <button
          onClick={onComplete}
          disabled={isLoading}
          className="inline-flex items-center gap-2 bg-nirex-accent text-white hover:bg-nirex-accent-hi disabled:opacity-50 disabled:cursor-not-allowed rounded-xl px-8 py-3.5 font-bold transition-all shadow-lg shadow-nirex-accent/20 hover:shadow-xl hover:shadow-nirex-accent/30 min-w-[200px] justify-center"
        >
          {isLoading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Finalizing...
            </>
          ) : (
            <>
              Complete Setup
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
