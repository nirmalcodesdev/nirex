import { faqs } from '@/constant/landingpage';
import { useState } from 'react';


export default function FAQ() {
    const [open, setOpen] = useState<number | null>(null);

    return (
        <section className="nirex-section" id="faq">
            <div className="nirex-container max-w-2xl">
                <h2 className="heading-2 text-nirex-text-primary text-center mb-16" data-reveal="fade-up">
                    Honest answers.
                </h2>

                <div className="space-y-0 border-t border-border" data-reveal="fade-up">
                    {faqs.map((faq, i) => (
                        <div key={i} className="border-b border-border">
                            <button
                                onClick={() => setOpen(open === i ? null : i)}
                                className="w-full flex items-center justify-between py-5 text-left group"
                            >
                                <span className={`font-body text-base transition-colors duration-200 ${open === i ? 'text-nirex-accent-hi' : 'text-nirex-text-primary'
                                    }`}>
                                    {faq.q}
                                </span>
                                <span
                                    className="text-nirex-text-muted text-xl flex-shrink-0 ml-4 transition-transform duration-300"
                                    style={{ transform: open === i ? 'rotate(45deg)' : 'rotate(0deg)' }}
                                >
                                    +
                                </span>
                            </button>
                            <div
                                className="overflow-hidden transition-all duration-300"
                                style={{ maxHeight: open === i ? '200px' : '0px' }}
                            >
                                <p className="body-m text-nirex-text-secondary pb-5">
                                    {faq.a}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
