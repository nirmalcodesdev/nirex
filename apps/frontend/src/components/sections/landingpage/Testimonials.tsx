import { testimonials } from "@/constant/landingpage";

export default function Testimonials() {
    return (
        <section className="nirex-section border-y border-border">
            <div className="nirex-container">
                <div className="text-center mb-16">
                    <h2 className="heading-2 text-nirex-text-primary" data-reveal="fade-up">What developers are saying.</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {testimonials.map((t, i) => (
                        <div
                            key={t.handle}
                            className="bg-nirex-surface border border-border rounded-lg p-6"
                            data-reveal="fade-up"
                            data-reveal-delay={`${i * 0.1}`}
                        >
                            <div className="font-mono text-[13px] leading-relaxed mb-4 space-y-0.5">
                                {t.quote.split('\n').map((line, li) => (
                                    <div key={li}>
                                        <span className="text-nirex-text-muted">// </span>
                                        <span className="text-nirex-text-secondary">{li === 0 ? `"${line}` : line}{li === t.quote.split('\n').length - 1 ? '"' : ''}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="font-mono text-[11px]">
                                <span className="text-nirex-text-muted">// — </span>
                                <span className="text-nirex-accent-hi">{t.handle}</span>
                                <span className="text-nirex-text-muted">, {t.role}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
