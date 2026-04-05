import { commands } from '@/constant/landingpage';
import { useState } from 'react';


function LineRenderer({ line }: { line: { text: string; type: string } }) {
    const cls = {
        prompt: 't-cmd',
        output: 't-output',
        path: 't-path',
        label: 't-label',
        success: 't-success',
        remove: 't-remove',
        add: 't-add',
        warning: 't-warning',
        blank: '',
    }[line.type] || 't-output';

    if (line.type === 'prompt') {
        return <div><span className="t-prompt">$ </span><span className="t-cmd">{line.text.replace('$ ', '')}</span></div>;
    }

    return <div className={cls}>{line.text}</div>;
}

export default function Demo() {
    const [active, setActive] = useState(0);

    return (
        <section className="nirex-section bg-nirex-surface border-y border-border" id="demo">
            <div className="nirex-container">
                <div className="text-center mb-12">
                    <h2 className="heading-2 text-nirex-text-primary" data-reveal="fade-up">Try it yourself.</h2>
                    <p className="body-l text-nirex-text-secondary mt-4" data-reveal="fade-up">Select a command to see nirex agents in action.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[180px_1fr_220px] gap-4 max-w-5xl mx-auto" data-reveal="fade-up">
                    {/* Command sidebar */}
                    <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
                        {commands.map((c, i) => (
                            <button
                                key={i}
                                onClick={() => setActive(i)}
                                className={`text-left px-3 py-2 rounded-md font-mono text-xs whitespace-nowrap transition-all duration-200 flex-shrink-0 max-w-[170px] truncate ${active === i
                                    ? 'bg-nirex-elevated border-l-2 border-nirex-accent text-nirex-text-primary'
                                    : 'text-nirex-text-muted hover:text-nirex-text-secondary'
                                    }`}
                            >
                                {c.cmd}
                            </button>
                        ))}
                    </div>

                    {/* Terminal output */}
                    <div className="terminal min-w-0">
                        <div className="terminal-chrome">
                            <div className="terminal-dots">
                                <span className="terminal-dot" style={{ background: '#ff5f57' }} />
                                <span className="terminal-dot" style={{ background: '#ffbd2e' }} />
                                <span className="terminal-dot" style={{ background: '#28c840' }} />
                            </div>
                            <span className="terminal-title">nirex — zsh</span>
                        </div>
                        <div className="terminal-body min-h-[280px]">
                            {commands[active]?.output.map((line, i) => (
                                <LineRenderer key={`${active}-${i}`} line={line} />
                            ))}
                            <div className="mt-1">
                                <span className="t-prompt">$ </span>
                                <span className="terminal-cursor" />
                            </div>
                        </div>
                    </div>

                    {/* Context panel */}
                    <div className="hidden lg:block bg-nirex-surface border border-border rounded-lg p-4 min-w-0">
                        <div className="label-mono text-nirex-text-muted mb-3">Context</div>
                        <div className="font-mono text-xs text-nirex-text-secondary space-y-1">
                            <div className="text-nirex-accent-hi">{commands[active]?.context.type === 'diff' ? '◉ Diff View' : commands[active]?.context.type === 'files' ? '◉ Generated Files' : '◉ File Tree'}</div>
                            <div className="text-nirex-text-muted mt-2 truncate">{commands[active]?.context.file}</div>
                            {commands[active]?.context.type === 'files' && commands[active].context.files?.map((f, i) => (
                                <div key={i} className="text-nirex-text-muted truncate">  └ {f}</div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
