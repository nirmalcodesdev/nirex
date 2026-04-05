export default function Problem() {
    const tabs = ['ChatGPT', 'Stack Overflow', 'GitHub', 'React Docs', 'npm', 'Error Logs', 'MDN', 'package.json', 'Your actual work →'];

    return (
        <section className="nirex-section" id="problem">
            <div className="nirex-container">
                {/* Tab illustration */}
                <div className="max-w-2xl mx-auto mb-16 overflow-hidden rounded-lg border border-border" data-reveal="fade-up">
                    <div className="bg-nirex-elevated p-3 flex items-center gap-1 overflow-hidden">
                        {tabs.map((tab, i) => (
                            <div
                                key={tab}
                                className={`flex-shrink-0 px-3 py-1.5 rounded-md text-[11px] font-mono border border-border whitespace-nowrap ${i === tabs.length - 1
                                    ? 'text-nirex-text-muted opacity-50 -mr-4'
                                    : i === 0
                                        ? 'bg-nirex-surface text-nirex-text-secondary'
                                        : 'text-nirex-text-muted'
                                    }`}
                            >
                                {tab}
                            </div>
                        ))}
                    </div>
                    <div className="bg-nirex-surface h-8" />
                </div>

                {/* Copy */}
                <div className="max-w-[480px] mx-auto text-center" data-reveal="fade-up" data-reveal-delay="0.15">
                    <h2 className="heading-2 text-nirex-text-primary mb-8">Every AI tool lives somewhere else.</h2>
                    <div className="body-l text-nirex-text-secondary leading-[1.9] space-y-4">
                        <p>
                            You describe your code in a chat window.
                            <br />You paste snippets. You wait.
                            <br />You get an answer that has never seen your project.
                        </p>
                        <p className="text-nirex-text-muted">
                            The problem isn't the AI.
                            <br />It's the interface.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}
