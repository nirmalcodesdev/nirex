import { motion } from "framer-motion";
import { CheckCircle2, RefreshCw } from "lucide-react";
import type { TerminalLine } from "@/types/onboarding"; // Corrected import path
import type { RefObject } from "react";

interface StepTerminalProps {
  terminalLines: TerminalLine[];
  isTerminalRunning: boolean;
  terminalStep: number;
  totalSteps: number;
  cursorVisible: boolean;
  terminalRef: RefObject<HTMLDivElement | null>; // Changed to allow null
  onReplay: () => void;
}

export function StepTerminal({
  terminalLines,
  isTerminalRunning,
  terminalStep,
  totalSteps,
  cursorVisible,
  terminalRef,
  onReplay,
}: StepTerminalProps) {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl sm:text-3xl font-display font-bold mb-2 text-nirex-text-primary">Watch the magic happen</h2>
        <p className="text-nirex-text-secondary">Your first deployment, simulated in real-time</p>
      </div>

      <div className="bg-nirex-surface/50 backdrop-blur-sm border border-nirex-accent/10 rounded-2xl p-1 overflow-hidden shadow-terminal">
        <div
          ref={terminalRef}
          className="bg-nirex-void rounded-xl p-4 sm:p-6 font-mono text-sm h-[320px] overflow-y-auto border border-white/5 custom-scrollbar"
        >
          <div className="flex items-center justify-between mb-4 text-nirex-text-muted border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-nirex-error/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-nirex-warning/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-nirex-success/80" />
              <span className="ml-2 text-[10px] uppercase tracking-widest font-bold opacity-50">~/projects/my-app</span>
            </div>
          </div>

          <div className="space-y-1.5">
            {terminalLines.map((line, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex gap-3 ${line.type === "command"
                  ? "text-nirex-text-primary"
                  : line.type === "success"
                    ? "text-nirex-success"
                    : line.type === "link"
                      ? "text-blue-400"
                      : "text-nirex-text-muted"
                  }`}
              >
                {line.type === "command" && <span className="text-nirex-accent font-bold shrink-0">$</span>}
                {line.type === "link" ? (
                  <a href="#" className="hover:underline underline-offset-4 decoration-blue-400/30 transition-all font-medium">
                    {line.text}
                  </a>
                ) : (
                  <span className="leading-relaxed">{line.text}</span>
                )}
              </motion.div>
            ))}
            {isTerminalRunning && (
              <div className="text-nirex-text-muted flex gap-2">
                {/* Placeholder for command prompt if needed */}
                <span className={cursorVisible ? "opacity-100" : "opacity-0"}>▋</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {terminalStep >= totalSteps - 1 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 flex items-center justify-center gap-6"
        >
          <div className="flex items-center gap-2 text-nirex-success bg-nirex-success/10 px-4 py-2 rounded-full border border-nirex-success/20">
            <CheckCircle2 size={18} />
            <span className="text-sm font-semibold tracking-wide">Deployment successful!</span>
          </div>
          <button
            onClick={onReplay}
            className="flex items-center gap-2 text-sm text-nirex-text-secondary hover:text-nirex-text-primary transition-all font-medium group"
          >
            <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-500" />
            Replay Simulation
          </button>
        </motion.div>
      )}
    </div>
  );
}
