import { features } from "@/constant/landingpage";

export default function Features() {
    return (
        <section className="nirex-section" id="features">
            <div className="nirex-container">
                <div className="text-center mb-16">
                    <h2 className="heading-2 text-nirex-text-primary" data-reveal="fade-up">
                        Multi-agent intelligence. One CLI.
                    </h2>
                    <p className="body-l text-nirex-text-secondary mt-4 max-w-lg mx-auto" data-reveal="fade-up">
                        Specialized AI agents collaborate on every command — powered by the world's leading models.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {features.map((f, i) => (
                        <div
                            key={f.label}
                            className={`group relative bg-nirex-surface border border-border rounded-lg p-6 hover:bg-nirex-elevated hover:border-nirex-accent/20 transition-all duration-300 overflow-hidden ${f.large ? 'md:col-span-2' : ''
                                } ${f.tall ? 'md:row-span-2' : ''}`}
                            data-reveal="fade-up"
                            data-reveal-delay={`${i * 0.08}`}
                        >
                            {/* Accent line */}
                            <div className="absolute top-0 left-0 right-0 h-[2px] bg-nirex-accent scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />

                            <span className="label-mono text-nirex-accent-hi mb-3 block">{f.label}</span>
                            <h3 className="font-display font-semibold text-lg text-nirex-text-primary mb-2">{f.title}</h3>
                            <p className="body-m text-nirex-text-secondary">{f.description}</p>

                            {f.terminal && (
                                <div className="mt-4 bg-nirex-void/50 rounded-md p-4 font-mono text-xs space-y-1">
                                    {f.terminal.map((line, li) => (
                                        <div key={li}>
                                            {line.prompt && <span className="t-prompt">$ </span>}
                                            {line.success ? (
                                                <span className="t-success">{line.text}</span>
                                            ) : line.path ? (
                                                <span className="t-path">{line.text}</span>
                                            ) : line.prompt ? (
                                                <span className="t-cmd">{line.text}</span>
                                            ) : (
                                                <span className="t-output">{line.text}</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
