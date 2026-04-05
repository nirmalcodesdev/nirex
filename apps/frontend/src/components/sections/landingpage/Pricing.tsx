import { plans } from "@/constant/landingpage";
import MagneticButton from "@nirex/ui/MagneticButton";

export default function Pricing() {
    return (
        <section className="nirex-section" id="pricing">
            <div className="nirex-container">
                <div className="text-center mb-16">
                    <h2 className="heading-2 text-nirex-text-primary" data-reveal="fade-up">
                        Simple pricing. No surprises.
                    </h2>
                    <p className="body-l text-nirex-text-secondary mt-4 max-w-lg mx-auto" data-reveal="fade-up">
                        Start free. Upgrade when you need more agents, unlimited commands, and internet search.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                    {plans.map((plan, i) => (
                        <div
                            key={plan.name}
                            className={`relative bg-nirex-surface border rounded-xl overflow-hidden transition-all duration-300 ${plan.highlight
                                ? 'border-nirex-accent shadow-elevated scale-[1.02]'
                                : 'border-border hover:border-nirex-accent/20'
                                }`}
                            data-reveal="fade-up"
                            data-reveal-delay={`${i * 0.1}`}
                        >
                            {plan.highlight && (
                                <div className="h-[3px] w-full bg-nirex-accent" />
                            )}

                            <div className="px-8 py-10">
                                <div className="label-mono text-nirex-accent-hi mb-4">{plan.name}</div>
                                <div className="flex items-baseline gap-1 mb-2">
                                    <span className="font-display font-bold text-4xl text-nirex-text-primary">{plan.price}</span>
                                    <span className="font-body text-sm text-nirex-text-muted">{plan.period}</span>
                                </div>
                                <p className="body-m text-nirex-text-secondary mb-8">{plan.description}</p>

                                <div className="border-t border-border pt-6 mb-8 space-y-3">
                                    {plan.features.map(f => (
                                        <div key={f} className="flex items-start gap-3">
                                            <span className="text-nirex-accent mt-0.5 flex-shrink-0 text-sm">✓</span>
                                            <span className="body-m text-nirex-text-secondary">{f}</span>
                                        </div>
                                    ))}
                                </div>

                                <MagneticButton
                                    strength={0.3}
                                    className={`w-full h-11 rounded-lg font-body text-sm font-medium transition-all duration-200 ${plan.highlight
                                        ? 'bg-nirex-accent text-nirex-text-inverse hover:opacity-90'
                                        : 'border border-border text-nirex-text-primary hover:border-nirex-accent/30 hover:bg-nirex-elevated'
                                        }`}
                                >
                                    {plan.cta}
                                </MagneticButton>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
