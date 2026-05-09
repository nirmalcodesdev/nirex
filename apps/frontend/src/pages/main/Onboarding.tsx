import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { StepIndicator } from "./onboarding/components/StepIndicator";
import { StepWelcome } from "./onboarding/components/StepWelcome";
import { StepTemplate } from "./onboarding/components/StepTemplate";
import { StepTerminal } from "./onboarding/components/StepTerminal";
import { StepApiKey } from "./onboarding/components/StepApiKey";
import { StepPreferences } from "./onboarding/components/StepPreferences";
import { StepSuccess } from "./onboarding/components/StepSuccess";
import { useToast } from "@/components/ToastProvider"; // Assuming "@/components" is a valid alias
import type { OnboardingPreferences, Template } from "../../types/onboarding";
import { useTerminalSimulation } from "@/hooks/useTerminalSimulation"; // Assuming "@/hooks" is a valid alias
import { DEFAULT_ONBOARDING_API_KEY_SCOPES } from "../../features/api-keys/apiKeyScopes";
import { useCreateApiKeyMutation } from "../../features/api-keys/useApiKeys";

const TEMPLATES: Template[] = [
  { id: "next", name: "Next.js", icon: "▲", color: "#fff", description: "React framework" },
  { id: "react", name: "React", icon: "⚛", color: "#61DAFB", description: "UI library" },
  { id: "node", name: "Node.js", icon: "🟢", color: "#339933", description: "JS runtime" },
  { id: "python", name: "Python", icon: "🐍", color: "#FFD43B", description: "Backend API" },
  { id: "go", name: "Go", icon: "🔵", color: "#00ADD8", description: "Fast services" },
  { id: "rust", name: "Rust", icon: "⚙", color: "#DEA584", description: "Systems" },
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [keySaved, setKeySaved] = useState(false);
  const [preferences, setPreferences] = useState<OnboardingPreferences>({
    emailNotifications: true,
    weeklyReports: true,
    betaAccess: false,
  });
  const [cursorVisible, setCursorVisible] = useState(true);

  const navigate = useNavigate();
  const { toast } = useToast();
  const createApiKeyMutation = useCreateApiKeyMutation();
  const {
    terminalLines,
    terminalStep,
    isTerminalRunning,
    terminalRef,
    runTerminal,
    TERMINAL_STEPS_COUNT,
  } = useTerminalSimulation();

  const totalSteps = 6;

  useEffect(() => {
    const interval = setInterval(() => setCursorVisible((v) => !v), 530);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (localStorage.getItem("nirex-onboarding-complete") === "true") {
      navigate("/");
    }
  }, [navigate]);

  const handleNext = async () => {
    if (step === 4) {
      setIsLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      localStorage.setItem("nirex-onboarding-complete", "true");
      setIsLoading(false);
      setDirection(1);
      setStep(5);
    } else if (step < 5) {
      setDirection(1);
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setDirection(-1);
      setStep(step - 1);
    }
  };

  useEffect(() => {
    if (step === 2 && terminalLines.length === 0 && !isTerminalRunning) runTerminal();
  }, [step, isTerminalRunning, terminalLines.length, runTerminal]); // Added dependencies

  const handleGenerateApiKey = async () => {
    if (createApiKeyMutation.isPending || apiKey) return;

    const templateName = TEMPLATES.find((template) => template.id === selectedTemplate)?.name;

    try {
      const response = await createApiKeyMutation.mutateAsync({
        name: templateName ? `${templateName} CLI key` : "Onboarding CLI key",
        scopes: DEFAULT_ONBOARDING_API_KEY_SCOPES,
      });

      setApiKey(response.apiKey);
      setShowKey(false);
      setKeySaved(false);
      toast("API key generated.", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Unable to generate API key.", "error");
    }
  };

  const handleDownloadApiKey = () => {
    const blob = new Blob([`# Nirex\nNIREX_API_KEY=${apiKey}`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = ".env.local";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-nirex-void flex flex-col font-body selection:bg-nirex-accent/30 selection:text-nirex-accent">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-nirex-accent/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-nirex-accent/5 rounded-full blur-[120px]" />
      </div>

      <StepIndicator currentStep={step} totalSteps={totalSteps} />

      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-5xl">
          <AnimatePresence mode="wait" custom={direction}>
            {step === 0 && <StepWelcome key="s0" onNext={handleNext} cursorVisible={cursorVisible} />}
            {step === 1 && <StepTemplate key="s1" templates={TEMPLATES} selectedTemplate={selectedTemplate} onSelect={(id) => { setSelectedTemplate(id); setTimeout(handleNext, 400); }} />}
            {step === 2 && (
              <StepTerminal
                key="s2"
                terminalLines={terminalLines}
                isTerminalRunning={isTerminalRunning}
                terminalStep={terminalStep}
                totalSteps={TERMINAL_STEPS_COUNT}
                cursorVisible={cursorVisible}
                terminalRef={terminalRef}
                onReplay={runTerminal}
              />
            )}
            {step === 3 && (
              <StepApiKey
                key="s3"
                apiKey={apiKey}
                showKey={showKey}
                keySaved={keySaved}
                isGenerating={createApiKeyMutation.isPending}
                onGenerate={() => void handleGenerateApiKey()}
                onToggleShow={() => setShowKey(!showKey)}
                onCopy={() => {
                  void navigator.clipboard.writeText(apiKey);
                  toast("Copied", "success");
                }}
                onDownload={handleDownloadApiKey}
                onToggleSaved={setKeySaved}
              />
            )}
            {step === 4 && <StepPreferences key="s4" preferences={preferences} isLoading={isLoading} onToggle={(id) => setPreferences({ ...preferences, [id]: !preferences[id] })} onComplete={handleNext} />}
            {step === 5 && <StepSuccess key="s5" onNavigate={navigate} />}
          </AnimatePresence>
        </div>
      </main>

      {step > 0 && step < 5 && (
        <footer className="relative z-10 p-6 sm:p-10 border-t border-nirex-accent/10">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <button onClick={handleBack} disabled={step === 1 || isLoading} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-nirex-text-muted hover:text-nirex-text-primary hover:bg-nirex-surface/50 transition-all disabled:opacity-30">
              Back
            </button>
            <button onClick={handleNext} disabled={isLoading || (step === 3 && !keySaved)} className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-nirex-accent text-white hover:bg-nirex-accent-hi transition-all shadow-lg shadow-nirex-accent/20 disabled:opacity-30">
              Continue
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}
