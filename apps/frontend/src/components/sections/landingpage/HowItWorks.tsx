import { how_its_works_steps } from "@/constant/landingpage";

export default function HowItWorks() {
    return (
        <section className="nirex-section" id="how-it-works">
            <div className="nirex-container">
                <div className="text-center mb-20">
                    <h2 className="heading-2 text-nirex-text-primary" data-reveal="fade-up">Three steps. No boilerplate.</h2>
                </div>

                <div className="max-w-2xl mx-auto space-y-16 relative">
                    {/* Connector line */}
                    <div className="absolute left-[28px] top-[80px] bottom-[80px] w-px bg-border hidden md:block" />

                    {how_its_works_steps.map((step, i) => (
                        <div
                            key={step.num}
                            className="flex gap-8 items-start"
                            data-reveal="fade-up"
                            data-reveal-delay={`${i * 0.12}`}
                        >
                            <div className="flex-shrink-0">
                                <span className="font-display font-bold text-6xl text-nirex-text-muted/20">{step.num}</span>
                            </div>
                            <div>
                                <h3 className="font-display font-semibold text-xl text-nirex-text-primary mb-2">{step.title}</h3>
                                <p className="body-m text-nirex-text-secondary mb-4">{step.description}</p>
                                <div className="inline-block bg-nirex-void/50 rounded-md px-4 py-2 font-mono text-xs">
                                    <span className="t-prompt">$ </span>
                                    <span className="t-cmd">{step.code.replace('$ ', '')}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
