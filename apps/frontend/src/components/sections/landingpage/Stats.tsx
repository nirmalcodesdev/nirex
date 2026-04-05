import { useCountUp } from "@nirex/ui";

function StatItem({ value, target, suffix, label, sublabel }: {
    value?: string;
    target?: number;
    suffix?: string;
    label: string;
    sublabel: string;
}) {
    const countUp = target !== undefined ? useCountUp(target, 1000, suffix || '') : null;

    return (
        <div className="text-center px-4" data-reveal="fade-up">
            <div className="font-display font-bold text-5xl text-nirex-text-primary mb-2" ref={countUp?.ref as React.Ref<HTMLDivElement>}>
                {countUp ? countUp.display : value}
            </div>
            <div className="font-body text-[11px] text-nirex-text-muted uppercase tracking-wider">
                {label}
                <br />
                {sublabel}
            </div>
        </div>
    );
}

export default function Stats() {
    return (
        <section className="nirex-section border-y border-border">
            <div className="nirex-container">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-0 md:divide-x divide-border">
                    <StatItem value="1.2s" label="Avg response" sublabel="across all agents" />
                    <StatItem target={25000} suffix="+" label="Developers" sublabel="using nirex" />
                    <StatItem target={5} label="AI models" sublabel="orchestrated" />
                    <StatItem value="100%" label="Terminal" sublabel="native" />
                </div>
            </div>
        </section>
    );
}
