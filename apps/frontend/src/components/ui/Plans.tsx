import { useEffect, useState } from "react";
import { X, CheckCircle2 } from "lucide-react";
import { usePlansDialog } from "@/hooks/usePlansDialog";
import { useToast } from "@/components/ToastProvider";
import MagneticButton from "@nirex/ui/MagneticButton";

const plans = [
  {
    name: "Hobby",
    description: "Perfect for side projects and learning.",
    price: { monthly: "$0", yearly: "$0" },
    features: [
      "Up to 3 projects",
      "1,000 compute hours/mo",
      "Community support",
      "Basic analytics",
    ],
    notIncluded: ["Custom domains", "Team collaboration", "Priority support"],
    cta: "Current Plan",
    popular: false,
  },
  {
    name: "Pro",
    description: "For professional developers and small teams.",
    price: { monthly: "$29", yearly: "$24" },
    features: [
      "Unlimited projects",
      "10,000 compute hours/mo",
      "Custom domains",
      "Team collaboration (up to 5)",
      "Advanced analytics",
      "Priority email support",
    ],
    notIncluded: ["Dedicated account manager", "SSO & SAML"],
    cta: "Upgrade to Pro",
    popular: true,
  },
  {
    name: "Enterprise",
    description: "For large organizations with custom needs.",
    price: { monthly: "Custom", yearly: "Custom" },
    features: [
      "Unlimited everything",
      "Dedicated account manager",
      "SSO & SAML",
      "Custom SLAs",
      "24/7 phone support",
      "On-premise deployment options",
    ],
    notIncluded: [],
    cta: "Contact Sales",
    popular: false,
  },
];

export function Plans() {
  const [isYearly, setIsYearly] = useState(true);
  const { toast } = useToast();
  const { isPlansDialogOpen, closePlansDialog } = usePlansDialog();

  useEffect(() => {
    if (!isPlansDialogOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePlansDialog();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [closePlansDialog, isPlansDialogOpen]);

  if (!isPlansDialogOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[120] bg-background/80 backdrop-blur-sm">
      <div className="absolute inset-0 bg-background/95 overflow-y-auto">
        <button
          type="button"
          onClick={closePlansDialog}
          className="fixed top-3 right-3 sm:top-5 sm:right-5 z-[121] inline-flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-full border border-border bg-card/90 text-muted-foreground hover:text-foreground hover:bg-card shadow-sm transition-colors"
          aria-label="Close plans dialog"
        >
          <X size={18} className="sm:w-5 sm:h-5" />
        </button>

        <div className="min-h-screen flex flex-col gap-4 sm:gap-6 lg:gap-8 container px-4 sm:px-6 py-6 sm:py-8 lg:py-10 mx-auto items-center">
          <div className="text-center max-w-2xl mx-auto mb-2 sm:mb-4 pt-6 sm:pt-10">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-3 sm:mb-4">Simple, transparent pricing</h1>
            <p className="text-base sm:text-lg text-muted-foreground px-2 sm:px-0">
              Choose the perfect plan for your needs. Always know what you&apos;ll pay.
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-4 sm:mb-8">
            <span className={`text-sm font-medium ${!isYearly ? "text-foreground" : "text-muted-foreground"}`}>Monthly</span>
            <button
              type="button"
              onClick={() => setIsYearly((prev) => !prev)}
              className="relative inline-flex h-5 w-9 sm:h-6 sm:w-11 items-center rounded-full bg-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
            >
              <span className={`inline-block h-3 w-3 sm:h-4 sm:w-4 transform rounded-full bg-white transition-transform ${isYearly ? "translate-x-5 sm:translate-x-6" : "translate-x-1"}`} />
            </button>
            <span className={`text-sm font-medium ${isYearly ? "text-foreground" : "text-muted-foreground"}`}>
              Yearly <span className="text-nirex-success text-xs ml-1 bg-nirex-success/10 px-1.5 sm:px-2 py-0.5 rounded-full hidden sm:inline">Save 20%</span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 w-full max-w-7xl pb-6 sm:pb-10">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative flex flex-col glass-panel rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 transition-all ${plan.popular ? "border-primary/50 bg-primary/5 scale-[1.02] md:scale-105 z-10 order-first md:order-none" : "border-border/50 hover:border-border"}`}
              >
                {plan.popular && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-primary-foreground text-[10px] sm:text-xs font-bold px-2.5 sm:px-3 py-1 rounded-full uppercase tracking-wider">
                    Most Popular
                  </div>
                )}

                <div className="mb-4 sm:mb-6">
                  <h3 className="text-lg sm:text-xl font-semibold mb-1 sm:mb-2">{plan.name}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground min-h-[2rem] sm:min-h-[2.5rem]">{plan.description}</p>
                </div>

                <div className="mb-4 sm:mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-bold tracking-tight">{isYearly ? plan.price.yearly : plan.price.monthly}</span>
                    {plan.price.monthly !== "Custom" && <span className="text-muted-foreground font-medium text-sm sm:text-base">/mo</span>}
                  </div>
                  {isYearly && plan.price.monthly !== "Custom" && (
                    <p className="text-xs text-muted-foreground mt-1">Billed annually</p>
                  )}
                </div>

                <MagneticButton
                  strength={0.3}
                  onClick={() =>
                    toast(
                      plan.cta === "Current Plan" ? "You are already on this plan." : `Redirecting to ${plan.name} checkout...`,
                      "info",
                    )
                  }
                  className={`w-full py-2 sm:py-2.5 px-3 sm:px-4 rounded-lg text-sm font-medium transition-colors mb-6 sm:mb-8 ${plan.popular ? "bg-primary text-primary-foreground hover:bg-primary/90" : plan.cta === "Current Plan" ? "bg-muted text-muted-foreground cursor-default" : "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border"}`}
                >
                  {plan.cta}
                </MagneticButton>

                <div className="flex-1 flex flex-col gap-3 sm:gap-4">
                  <p className="text-xs sm:text-sm font-medium">What&apos;s included:</p>
                  <ul className="flex flex-col gap-2 sm:gap-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 sm:gap-3 text-xs sm:text-sm">
                        <CheckCircle2 size={16} className="text-nirex-success shrink-0 mt-0.5 sm:mt-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                    {plan.notIncluded.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground opacity-60">
                        <X size={16} className="shrink-0 mt-0.5 sm:mt-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
