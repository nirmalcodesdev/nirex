import type { TerminalLine, TerminalStep } from "@/types/onboarding"; // Import TerminalStep as well
import { useState, useEffect, useRef, useCallback } from "react";

const TERMINAL_STEPS: TerminalStep[] = [
  { text: "nirex init my-app --template nextjs", type: "command", delay: 500 },
  { text: "✓ Creating project directory...", type: "output", delay: 800 },
  { text: "✓ Installing dependencies...", type: "output", delay: 1200 },
  { text: "✓ Setting up deployment config...", type: "output", delay: 600 },
  { text: "✓ Project ready!", type: "success", delay: 400 },
  { text: "", type: "empty", delay: 300 },
  { text: "nirex deploy", type: "command", delay: 600 },
  { text: "✓ Building application...", type: "output", delay: 1000 },
  { text: "✓ Uploading to edge network...", type: "output", delay: 800 },
  { text: "✓ Deployed to global infrastructure", type: "success", delay: 600 },
  { text: "", type: "empty", delay: 200 },
  { text: "🔗  https://my-app.nirex.app", type: "link", delay: 0 },
];

export function useTerminalSimulation() {
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
  const [terminalStep, setTerminalStep] = useState(0);
  const [isTerminalRunning, setIsTerminalRunning] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);

  const runTerminal = useCallback(async () => {
    if (isTerminalRunning) return;
    setIsTerminalRunning(true);
    setTerminalLines([]);
    setTerminalStep(0);

    for (let i = 0; i < TERMINAL_STEPS.length; i++) {
      const s = TERMINAL_STEPS[i];
      // Add check for 's' to ensure it's not undefined before accessing properties
      if (s) {
        await new Promise((resolve) => setTimeout(resolve, s.delay));
        setTerminalLines((prev) => [...prev, { text: s.text, type: s.type }]);
        setTerminalStep(i);
      }
    }
    setIsTerminalRunning(false);
  }, [isTerminalRunning]); // isTerminalRunning is a dependency to ensure we don't start if already running

  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [terminalLines]);

  return {
    terminalLines,
    terminalStep,
    isTerminalRunning,
    terminalRef,
    runTerminal,
    TERMINAL_STEPS_COUNT: TERMINAL_STEPS.length,
  };
}
