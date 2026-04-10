import MagneticButton from '@nirex/ui/MagneticButton';
import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function FinalCTA() {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText('npm install -g nirex');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <section className="nirex-section bg-nirex-surface border-t border-border">
            <div className="nirex-container text-center">
                <div data-reveal="fade-up">
                    <h2 className="display-l mb-2">
                        <span className="text-nirex-text-muted">Stop switching tabs.</span>
                        <br />
                        <span className="text-nirex-text-primary">Start shipping.</span>
                    </h2>
                    <p className="body-l text-nirex-text-secondary mt-4 max-w-lg mx-auto">
                        Five AI models. Specialized agents. Internet search.
                        All orchestrated from your terminal.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10" data-reveal="fade-up" data-reveal-delay="0.15">
                    <Link to="/auth/signup">
                        <MagneticButton
                            strength={0.35}
                            className="h-12 px-8 rounded-lg bg-nirex-accent text-nirex-text-inverse font-body text-sm font-medium inline-flex items-center gap-2 hover:opacity-90 transition-opacity"
                        >
                            Get Started Free ↗
                        </MagneticButton>
                    </Link>

                    <button
                        onClick={handleCopy}
                        className="inline-flex items-center gap-3 h-12 px-8 rounded-lg border border-border bg-nirex-elevated/50 font-mono text-sm text-nirex-text-primary hover:border-nirex-accent/30 transition-all duration-200"
                    >
                        {copied ? (
                            <span className="text-nirex-accent">✓ Copied</span>
                        ) : (
                            <>
                                <span className="text-nirex-accent">$</span> npm install -g nirex
                            </>
                        )}
                    </button>
                </div>
            </div>
        </section>
    );
}
