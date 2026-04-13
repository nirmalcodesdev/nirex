import { ROUTES } from "@/constant/routes";
import { motion } from "framer-motion";
import { CheckCircle2, BarChart3, FileCode, Users, ArrowRight } from "lucide-react";

interface StepSuccessProps {
  onNavigate: (path: string) => void;
}

export function StepSuccess({ onNavigate }: StepSuccessProps) {
  return (
    <div className="text-center max-w-2xl mx-auto">
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        className="w-24 h-24 mx-auto mb-8 rounded-full bg-gradient-to-br from-nirex-success to-emerald-600 flex items-center justify-center shadow-2xl shadow-nirex-success/30 border-4 border-white/10"
      >
        <CheckCircle2 size={48} className="text-white" />
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-3xl sm:text-4xl font-display font-bold mb-3 text-nirex-text-primary"
      >
        You're ready to ship
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-nirex-text-secondary text-lg mb-10 max-w-md mx-auto"
      >
        Your account is perfectly configured and ready for production-grade deployments.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10"
      >
        {[
          { icon: BarChart3, title: "Dashboard", desc: "Monitor metrics", color: "from-blue-500/20 to-cyan-500/20", textColor: "text-blue-400", action: () => onNavigate("/dashboard") },
          { icon: FileCode, title: "Docs", desc: "Read references", color: "from-purple-500/20 to-pink-500/20", textColor: "text-purple-400", action: () => onNavigate("/documentation") },
          { icon: Users, title: "Team", desc: "Collaborate now", color: "from-emerald-500/20 to-teal-500/20", textColor: "text-emerald-400", action: () => onNavigate("/settings") },
        ].map((item) => (
          <motion.button
            key={item.title}
            whileHover={{ y: -5, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={item.action}
            className="group relative bg-nirex-surface/40 backdrop-blur-sm border border-nirex-accent/10 rounded-2xl p-6 text-left transition-all hover:bg-nirex-surface/60 hover:border-nirex-accent/30 shadow-lg hover:shadow-xl"
          >
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-inner border border-white/5`}>
              <item.icon size={22} className={item.textColor} />
            </div>
            <h3 className="font-bold text-sm text-nirex-text-primary mb-1 group-hover:text-nirex-accent transition-colors">{item.title}</h3>
            <p className="text-xs text-nirex-text-muted leading-relaxed">{item.desc}</p>
          </motion.button>
        ))}
      </motion.div>

      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        whileHover={{ scale: 1.03, y: -2 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => onNavigate(ROUTES.DASHBOARD.ROOT)}
        className="inline-flex items-center gap-3 bg-nirex-accent text-white hover:bg-nirex-accent-hi rounded-2xl px-10 py-4 font-bold transition-all shadow-xl shadow-nirex-accent/20 hover:shadow-2xl hover:shadow-nirex-accent/30"
      >
        Launch Dashboard
        <ArrowRight size={20} />
      </motion.button>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-8 text-xs text-nirex-text-muted font-medium"
      >
        Pro tip: Run <code className="px-2 py-1 rounded bg-nirex-void border border-white/5 text-nirex-accent font-bold mx-1">nirex --help</code> anytime to see all CLI commands.
      </motion.p>
    </div>
  );
}
