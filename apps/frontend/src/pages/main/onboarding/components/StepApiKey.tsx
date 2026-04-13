import { motion } from "framer-motion";
import { Lock, Key, Copy, Eye, EyeOff, Download, Shield } from "lucide-react";

interface StepApiKeyProps {
  apiKey: string;
  showKey: boolean;
  keySaved: boolean;
  onGenerate: () => void;
  onToggleShow: () => void;
  onCopy: () => void;
  onDownload: () => void;
  onToggleSaved: (saved: boolean) => void;
}

export function StepApiKey({
  apiKey,
  showKey,
  keySaved,
  onGenerate,
  onToggleShow,
  onCopy,
  onDownload,
  onToggleSaved,
}: StepApiKeyProps) {
  return (
    <div className="max-w-xl mx-auto">
      <div className="text-center mb-8">
        <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-nirex-accent/10 flex items-center justify-center border border-nirex-accent/20">
          <Lock size={28} className="text-nirex-accent" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-display font-bold mb-2 text-nirex-text-primary">Secure your CLI</h2>
        <p className="text-nirex-text-secondary">Generate an API key to authenticate deployments</p>
      </div>

      {!apiKey ? (
        <motion.button
          whileHover={{ scale: 1.01, y: -2 }}
          whileTap={{ scale: 0.99 }}
          onClick={onGenerate}
          className="w-full bg-nirex-surface/40 backdrop-blur-sm border border-nirex-accent/10 rounded-2xl p-8 text-center group hover:border-nirex-accent/30 transition-all shadow-lg hover:shadow-xl hover:shadow-nirex-accent/5"
        >
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-nirex-accent/20 to-nirex-accent/5 flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner border border-nirex-accent/10">
            <Key size={32} className="text-nirex-accent" />
          </div>
          <h3 className="font-bold text-lg mb-1.5 text-nirex-text-primary">Generate API Key</h3>
          <p className="text-sm text-nirex-text-secondary max-w-xs mx-auto">Create your first key to start deploying and managing your services</p>
        </motion.button>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-6"
        >
          <div className="bg-nirex-surface/60 backdrop-blur-md rounded-2xl p-6 border border-nirex-accent/20 shadow-elevated">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-nirex-text-muted uppercase tracking-[0.2em]">
                Secret API Key
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={onToggleShow}
                  title={showKey ? "Hide" : "Show"}
                  className="p-2 rounded-lg hover:bg-nirex-accent/10 text-nirex-text-secondary hover:text-nirex-accent transition-all"
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button
                  onClick={onCopy}
                  title="Copy"
                  className="p-2 rounded-lg hover:bg-nirex-accent/10 text-nirex-text-secondary hover:text-nirex-accent transition-all"
                >
                  <Copy size={16} />
                </button>
                <button
                  onClick={onDownload}
                  title="Download .env"
                  className="p-2 rounded-lg hover:bg-nirex-accent/10 text-nirex-text-secondary hover:text-nirex-accent transition-all"
                >
                  <Download size={16} />
                </button>
              </div>
            </div>

            <div className="bg-nirex-void/80 rounded-xl p-4 font-mono text-sm break-all border border-white/5 shadow-inner min-h-[60px] flex items-center">
              <span className="text-nirex-text-primary/90 leading-relaxed">
                {showKey ? apiKey : `nrx_live_${"•".repeat(32)}`}
              </span>
            </div>

            <div className="flex items-start gap-3 mt-5 p-4 rounded-xl bg-nirex-warning/10 border border-nirex-warning/20">
              <Shield size={16} className="text-nirex-warning shrink-0 mt-0.5" />
              <p className="text-xs text-nirex-warning/90 leading-relaxed font-medium">
                Store this key safely. For security reasons, it won't be shown again after you leave this page.
              </p>
            </div>
          </div>

          <label className="flex items-center gap-4 p-4 rounded-2xl border border-nirex-accent/10 bg-nirex-surface/30 cursor-pointer hover:bg-nirex-surface/50 transition-all group">
            <div className={`relative w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center ${
              keySaved ? "bg-nirex-accent border-nirex-accent" : "border-nirex-accent/30 group-hover:border-nirex-accent/50"
            }`}>
              <input
                type="checkbox"
                checked={keySaved}
                onChange={(e) => onToggleSaved(e.target.checked)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              {keySaved && <motion.div initial={{scale:0}} animate={{scale:1}} className="w-2.5 h-2.5 bg-white rounded-[1px]" />}
            </div>
            <span className="text-sm font-medium text-nirex-text-secondary group-hover:text-nirex-text-primary transition-colors">I've saved this API key in a secure location</span>
          </label>
        </motion.div>
      )}
    </div>
  );
}
