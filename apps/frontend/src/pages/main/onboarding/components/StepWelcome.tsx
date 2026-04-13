import { motion } from "framer-motion";
import { ArrowRight, Command, Sparkles, Loader2, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { containerVariants, itemVariants } from "../animations";

interface StepWelcomeProps {
  onNext: () => void;
  cursorVisible: boolean;
}

export function StepWelcome({ onNext, cursorVisible }: StepWelcomeProps) {
  const navigate = useNavigate();

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center"
    >
      {/* Left: Value Prop */}
      <div className="space-y-6">
        <motion.div variants={itemVariants} className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-nirex-accent/10 text-nirex-accent text-xs font-medium border border-nirex-accent/20">
            <Sparkles size={12} />
            Now with AI-powered deployments
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold tracking-tight leading-tight text-nirex-text-primary">
            Deploy in seconds.
            <br />
            <span className="text-nirex-accent">Scale globally.</span>
          </h1>
          <p className="text-lg text-nirex-text-secondary max-w-md">
            The modern platform for deploying CLI applications to the edge.
            Ship faster with zero configuration.
          </p>
        </motion.div>

        <motion.div variants={itemVariants} className="flex flex-wrap gap-4">
          <button
            onClick={onNext}
            className="inline-flex items-center gap-2 bg-nirex-accent text-white hover:bg-nirex-accent-hi rounded-lg px-6 py-3 font-medium transition-all shadow-lg shadow-nirex-accent/20 hover:shadow-xl hover:shadow-nirex-accent/30"
          >
            Get Started Free
            <ArrowRight size={18} />
          </button>
          <button
            onClick={() => navigate("/documentation")}
            className="inline-flex items-center gap-2 text-nirex-text-secondary hover:text-nirex-text-primary transition-colors"
          >
            <Command size={18} />
            View Documentation
          </button>
        </motion.div>

        <motion.div variants={itemVariants} className="flex items-center gap-6 text-sm text-nirex-text-muted">
          <div className="flex items-center gap-2">
            <Check size={14} className="text-nirex-accent" />
            <span>Free tier</span>
          </div>
          <div className="flex items-center gap-2">
            <Check size={14} className="text-nirex-accent" />
            <span>No credit card</span>
          </div>
          <div className="flex items-center gap-2">
            <Check size={14} className="text-nirex-accent" />
            <span>Instant deploy</span>
          </div>
        </motion.div>
      </div>

      {/* Right: CLI Preview */}
      <motion.div
        variants={itemVariants}
        className="bg-nirex-surface/50 backdrop-blur-sm border border-nirex-accent/10 rounded-2xl p-1 overflow-hidden shadow-terminal"
      >
        <div className="bg-nirex-void rounded-xl p-4 font-mono text-sm border border-white/5">
          <div className="flex items-center gap-2 mb-4 text-nirex-text-muted">
            <div className="w-3 h-3 rounded-full bg-nirex-error/80" />
            <div className="w-3 h-3 rounded-full bg-nirex-warning/80" />
            <div className="w-3 h-3 rounded-full bg-nirex-success/80" />
            <span className="ml-2 text-[10px] uppercase tracking-widest font-bold opacity-50">terminal</span>
          </div>
          <div className="space-y-1.5 text-nirex-text-primary/90">
            <div className="flex items-center gap-2">
              <span className="text-nirex-accent font-bold">$</span>
              <span>nirex deploy</span>
            </div>
            <div className="text-nirex-text-muted">
              <div className="flex items-center gap-2">
                <Loader2 size={12} className="animate-spin text-nirex-accent" />
                <span>Building application...</span>
              </div>
            </div>
            <div className="text-nirex-success">
              ✓ Deployed to 35 edge locations
            </div>
            <div className="text-nirex-success">
              ✓ Live in 847ms
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-blue-400">→</span>
              <span className="underline underline-offset-4 decoration-nirex-accent/30 text-nirex-accent cursor-pointer hover:text-nirex-accent-hi transition-colors">https://my-app.nirex.app</span>
            </div>
            <div className="mt-1 text-nirex-text-muted">
              <span className={cursorVisible ? "opacity-100" : "opacity-0"}>▋</span>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
