import { useState } from "react";
import { Copy, Check } from "lucide-react";
import type { CodeExampleProps, CodeLanguage } from "@/types/documentation.types";

const languageColors: Record<CodeLanguage, string> = {
    bash: "text-gray-300",
    javascript: "text-yellow-300",
    typescript: "text-blue-300",
    json: "text-green-300",
    yaml: "text-red-300",
};

export function CodeExample({ blocks, filename }: CodeExampleProps) {
    const [activeTab, setActiveTab] = useState(0);
    const [copied, setCopied] = useState(false);

    // Guard against empty blocks array
    if (blocks.length === 0) {
        return null;
    }

    const activeBlock = blocks[activeTab];
    if (!activeBlock) {
        return null;
    }

    const handleCopy = () => {
        navigator.clipboard.writeText(activeBlock.code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="rounded-xl overflow-hidden bg-[#0d1117] border border-border my-6">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#161b22] border-b border-white/10">
                <div className="flex items-center gap-2">
                    {blocks.length > 1 ? (
                        <div className="flex gap-1">
                            {blocks.map((block, idx) => (
                                <button
                                    key={block.language + block.label}
                                    onClick={() => setActiveTab(idx)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeTab === idx
                                        ? "bg-white/10 text-white"
                                        : "text-gray-400 hover:text-white hover:bg-white/5"
                                        }`}
                                >
                                    {block.label}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <span className="text-xs font-medium text-gray-400">
                            {blocks[0]?.label ?? "Code"}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {filename && (
                        <span className="text-xs text-gray-500 font-mono">{filename}</span>
                    )}
                    <button
                        onClick={handleCopy}
                        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
                    >
                        {copied ? (
                            <>
                                <Check size={14} className="text-emerald-400" /> Copied
                            </>
                        ) : (
                            <>
                                <Copy size={14} /> Copy
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Code */}
            <div className="p-4 overflow-x-auto">
                <pre className="text-sm font-mono leading-relaxed">
                    <code className={languageColors[activeBlock.language]}>
                        {activeBlock.code}
                    </code>
                </pre>
            </div>
        </div>
    );
}
