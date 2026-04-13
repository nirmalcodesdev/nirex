import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { containerVariants, itemVariants } from "../animations";
import type { Template } from "@/types/onboarding";

interface StepTemplateProps {
  templates: Template[];
  selectedTemplate: string | null;
  onSelect: (templateId: string) => void;
}

export function StepTemplate({ templates, selectedTemplate, onSelect }: StepTemplateProps) {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl sm:text-3xl font-display font-bold mb-2 text-nirex-text-primary">What's your stack?</h2>
        <p className="text-nirex-text-secondary">We'll configure the optimal deployment settings for you</p>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 sm:grid-cols-3 gap-3"
      >
        {templates.map((template) => (
          <motion.button
            key={template.id}
            variants={itemVariants}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(template.id)}
            className={`relative overflow-hidden bg-nirex-surface/40 backdrop-blur-sm border rounded-xl p-5 text-center transition-all duration-300 ${selectedTemplate === template.id
              ? "border-nirex-accent ring-2 ring-nirex-accent/20 bg-nirex-accent/5"
              : "border-nirex-accent/10 hover:border-nirex-accent/30"
              }`}
          >
            <div className="text-3xl mb-3 filter drop-shadow-sm">{template.icon}</div>
            <div className="font-semibold text-sm text-nirex-text-primary">{template.name}</div>
            <div className="text-xs text-nirex-text-muted mt-1">{template.description}</div>

            {selectedTemplate === template.id && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-2 right-2 w-5 h-5 rounded-full bg-nirex-accent flex items-center justify-center shadow-lg shadow-nirex-accent/20"
              >
                <Check size={12} className="text-white" />
              </motion.div>
            )}

            {/* Hover glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-nirex-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </motion.button>
        ))}
      </motion.div>

      <div className="mt-8 text-center">
        <button
          onClick={() => onSelect("other")}
          className="text-sm text-nirex-text-muted hover:text-nirex-accent transition-colors font-medium"
        >
          Using something else? Continue with generic setup →
        </button>
      </div>
    </div>
  );
}
