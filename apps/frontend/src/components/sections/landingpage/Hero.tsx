import { useEffect, useRef, type JSX } from 'react';
import MagneticButton from '@nirex/ui/MagneticButton';
import { useTerminalTyping } from '@/hooks/useTerminalTyping';
import { terminalLines } from '@/constant/landingpage';
import { Link } from 'react-router-dom';



function colorize(line: string): JSX.Element {
    if (line.startsWith('$')) {
        const parts = line.split(' ');
        return (
            <span>
                <span className="t-prompt">$</span>{' '}
                <span className="t-cmd">{parts[1]}</span>{' '}
                <span className="t-cmd">{parts[2]}</span>{' '}
                <span className="t-string">{parts.slice(3).join(' ')}</span>
            </span>
        );
    }
    if (line.includes('Orchestrating agents')) return <span className="t-label">{line}</span>;
    if (line.includes('Agent[Search]')) return <span className="t-label">{line}</span>;
    if (line.includes('Found')) return <span><span className="t-label">  Found</span><span className="t-output"> › </span><span className="t-path">src/auth/tokenService.ts</span><span className="t-linenum">:142</span></span>;
    if (line.includes('Issue')) return <span className="t-label">  {line.trim().startsWith('Issue') ? <><span className="t-label">  Issue</span><span className="t-output">  › {line.replace('  Issue  › ', '')}</span></> : <span className="t-output">{line}</span>}</span>;
    if (line.trim().startsWith('- ')) return <span className="t-remove">{line}</span>;
    if (line.trim().startsWith('+ ')) return <span className="t-add">{line}</span>;
    if (line.includes('✓')) return <span className="t-success">{line}</span>;
    if (line.includes('█') || line.includes('░')) return <span className="t-output">{line}</span>;
    if (line.includes('Analyzing') || line.includes('Diff:') || line.includes('Apply')) return <span className="t-output">{line}</span>;
    if (line.trim().startsWith('not at')) return <span className="t-output">{line}</span>;
    return <span className="t-output">{line}</span>;
}

export default function Hero() {
    const { displayedLines, isComplete } = useTerminalTyping(terminalLines, true, 3000);
    const headlineRef = useRef<HTMLHeadingElement>(null);

    useEffect(() => {
        const el = headlineRef.current;
        if (!el) return;
        const words = el.querySelectorAll('.word-inner');
        words.forEach((word, i) => {
            const htmlWord = word as HTMLElement;
            htmlWord.style.transform = 'translateY(110%)';
            htmlWord.style.transition = `transform 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${0.35 + i * 0.08}s`;
            requestAnimationFrame(() => {
                htmlWord.style.transform = 'translateY(0)';
            });
        });
    }, []);

    return (
        <section className="hero-section" id="hero">
            <div className="hero-ambient" />
            <div className="nirex-container relative z-10 text-center">
                {/* Eyebrow */}
                <div className="inline-flex items-center gap-2 mb-8 opacity-0 animate-[fadeIn_0.5s_ease_0.2s_forwards]">
                    <span className="eyebrow-dot" />
                    <span className="font-mono text-[11px] text-nirex-text-muted tracking-wider">
            // powered by multi-agent AI — GPT-4, Claude, Gemini & more
                    </span>
                </div>

                {/* Headline */}
                <h1 ref={headlineRef} className="display-xl max-w-4xl mx-auto mb-6">
                    <span className="word-wrap"><span className="word-inner">The</span></span>{' '}
                    <span className="word-wrap"><span className="word-inner">multi-agent</span></span>{' '}
                    <span className="word-wrap"><span className="word-inner">AI</span></span>
                    <br />
                    <span className="word-wrap"><span className="word-inner">that</span></span>{' '}
                    <span className="word-wrap"><span className="word-inner">lives</span></span>{' '}
                    <span className="word-wrap"><span className="word-inner">in</span></span>{' '}
                    <span className="word-wrap"><span className="word-inner">your</span></span>{' '}
                    <span className="word-wrap"><span className="word-inner headline-accent">terminal.</span></span>
                </h1>

                {/* Subheadline */}
                <p className="body-l text-nirex-text-secondary max-w-xl mx-auto mb-10 opacity-0 animate-[fadeIn_0.55s_ease_0.65s_forwards]">
                    Multiple AI agents collaborate to fix bugs, generate code, and search
                    the internet — all orchestrated from one command.
                </p>

                {/* CTA Row */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4 opacity-0 animate-[fadeIn_0.45s_ease_0.75s_forwards]">
                    <Link to="/auth/signup">
                        <MagneticButton
                            strength={0.35}
                            className="h-11 px-6 rounded-lg bg-nirex-accent text-nirex-text-inverse font-body text-sm font-medium inline-flex items-center gap-2 hover:opacity-90 transition-opacity"
                        >
                            Get Started
                            <span className="inline-block transition-transform hover:translate-x-0.5 hover:-translate-y-0.5">↗</span>
                        </MagneticButton>
                    </Link>

                    <button className="h-11 px-6 rounded-lg border border-border font-mono text-[13px] text-nirex-text-secondary hover:border-nirex-accent/30 hover:text-nirex-text-primary transition-all duration-200">
                        <span className="text-nirex-accent">$ </span>nirex --demo
                    </button>
                </div>

                {/* Micro copy */}
                <p className="font-body text-xs text-nirex-text-muted opacity-0 animate-[fadeIn_0.35s_ease_0.9s_forwards]">
                    npm install -g nirex · macOS, Linux & Windows · Free tier available
                </p>

                {/* Terminal */}
                <div className="terminal max-w-[780px] mx-auto mt-14 text-left opacity-0 animate-[fadeIn_0.75s_ease_0.8s_forwards]">
                    <div className="terminal-chrome">
                        <div className="terminal-dots">
                            <span className="terminal-dot" style={{ background: '#ff5f57' }} />
                            <span className="terminal-dot" style={{ background: '#ffbd2e' }} />
                            <span className="terminal-dot" style={{ background: '#28c840' }} />
                        </div>
                        <span className="terminal-title">nirex — zsh — 80×24</span>
                    </div>
                    <div className="terminal-body" aria-live="polite">
                        {displayedLines.map((line, i) => (
                            <div key={i} className="min-h-[1.7em]">
                                {colorize(line)}
                                {i === displayedLines.length - 1 && !isComplete && (
                                    <span className="terminal-cursor" />
                                )}
                            </div>
                        ))}
                        {isComplete && (
                            <div className="min-h-[1.7em]">
                                <span className="t-prompt">$ </span>
                                <span className="terminal-cursor" />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
        </section >
    );
}
