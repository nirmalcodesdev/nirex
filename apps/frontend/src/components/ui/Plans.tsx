import { useEffect, useMemo, useState } from "react";
import type { BillingPlan, BillingPlanId } from "@nirex/shared";
import {
  BILLING_PLAN_CATALOG,
  DEFAULT_BILLING_CURRENCY,
  PRO_MONTHLY_DEFAULT_CENTS,
  PRO_YEARLY_DEFAULT_CENTS,
  MAX_MONTHLY_DEFAULT_CENTS,
} from "@nirex/shared";
import { CheckCircle2, X } from "lucide-react";
import { MagneticButton } from "@nirex/ui";
import { usePlansDialog } from "../../hooks/usePlansDialog";
import { useBillingOverviewQuery, useCreateCheckoutSessionMutation } from "../../features/billing";
import { ROUTES } from "../../constant/routes";
import { useToast } from "../ToastProvider";

type CheckoutPlanId = Exclude<BillingPlanId, "custom">;

interface PlanCard {
  id: CheckoutPlanId;
  name: string;
  description: string;
  features: string[];
  trialDays: number;
  monthlyPrice: string;
  yearlyPrice: string | null;
  fullYearlyPrice: string | null;
  yearlySavings: string | null;
  cta: "Buy Now" | "Extend" | "Contact Sales" | "Current Plan" | "Included" | "Monthly only";
  popular: boolean;
  checkoutEnabled: boolean;
  isCurrent: boolean;
  hasYearly: boolean;
}

const PLAN_ORDER: CheckoutPlanId[] = ["free", "pro", "max"];

function formatCurrencyFromCents(amountCents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 2,
    }).format(amountCents / 100);
  } catch {
    return `$${(amountCents / 100).toFixed(2)}`;
  }
}

function getDefaultPlanPriceCents(planId: CheckoutPlanId, cycle: "month" | "year"): number | null {
  if (planId === "free") return 0;
  if (planId === "pro") return cycle === "month" ? PRO_MONTHLY_DEFAULT_CENTS : PRO_YEARLY_DEFAULT_CENTS;
  if (planId === "max") return cycle === "month" ? MAX_MONTHLY_DEFAULT_CENTS : null;
  return null;
}

function getDisplayPlanPrices(
  plan: BillingPlan | undefined,
  planId: CheckoutPlanId,
): { monthlyPrice: string; yearlyPrice: string | null; fullYearlyPrice: string | null; yearlySavings: string | null } {
  const currency =
    plan?.prices.month?.currency ??
    plan?.prices.year?.currency ??
    DEFAULT_BILLING_CURRENCY;

  const monthAmount = plan?.prices.month?.amountCents ?? getDefaultPlanPriceCents(planId, "month");
  const yearAmount = plan?.prices.year?.amountCents ?? getDefaultPlanPriceCents(planId, "year");
  const yearMonthlyAmount = yearAmount === null ? null : Math.round(yearAmount / 12);

  const yearlySavings = monthAmount !== null && yearAmount !== null
    ? formatCurrencyFromCents(monthAmount * 12 - yearAmount, currency)
    : null;

  return {
    monthlyPrice: monthAmount === null ? "Custom" : formatCurrencyFromCents(monthAmount, currency),
    yearlyPrice: yearMonthlyAmount === null ? null : formatCurrencyFromCents(yearMonthlyAmount, currency),
    fullYearlyPrice: yearAmount === null ? null : formatCurrencyFromCents(yearAmount, currency),
    yearlySavings: yearlySavings && yearAmount !== null && monthAmount !== null && yearAmount < monthAmount * 12 ? yearlySavings : null,
  };
}

export function Plans() {
  const [isYearly, setIsYearly] = useState(false);
  const [pendingPlanId, setPendingPlanId] = useState<CheckoutPlanId | null>(null);
  const { toast } = useToast();
  const { isPlansDialogOpen, closePlansDialog } = usePlansDialog();
  const overviewQuery = useBillingOverviewQuery();
  const checkoutSessionMutation = useCreateCheckoutSessionMutation();

  useEffect(() => {
    if (!isPlansDialogOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePlansDialog();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [closePlansDialog, isPlansDialogOpen]);

  const plans = useMemo<PlanCard[]>(() => {
    const apiPlans = new Map<CheckoutPlanId, BillingPlan>();
    overviewQuery.data?.plans.forEach((plan) => {
      const id = plan.id as CheckoutPlanId;
      if (PLAN_ORDER.includes(id)) apiPlans.set(id, plan);
    });

    const currentPlanId = overviewQuery.data?.currentPlan.id;
    const hasActiveCurrentSubscription =
      overviewQuery.data?.subscription.status !== "NONE" &&
      overviewQuery.data?.subscription.status !== "CANCELED";

    return PLAN_ORDER.map((planId) => {
      const apiPlan = apiPlans.get(planId);
      const catalogPlan = BILLING_PLAN_CATALOG[planId as keyof typeof BILLING_PLAN_CATALOG];
      const isCurrent = hasActiveCurrentSubscription && currentPlanId === planId;
      const checkoutEnabled = apiPlan?.checkoutEnabled ?? (planId === "pro" || planId === "max");
      const price = getDisplayPlanPrices(apiPlan, planId);
      const hasYearly = planId === "pro"; // only Pro has yearly

      let cta: PlanCard["cta"] = "Buy Now";
      if (planId === "max" && !checkoutEnabled) cta = "Contact Sales";
      else if (isCurrent) cta = "Current Plan";
      else if (planId === "free") cta = "Included";
      else if (planId === "max") cta = "Buy Now";

      return {
        id: planId,
        name: apiPlan?.name ?? catalogPlan?.name ?? planId,
        description: apiPlan?.description ?? catalogPlan?.description ?? "",
        features: apiPlan?.features?.length ? apiPlan.features : (catalogPlan?.features ?? []),
        trialDays: apiPlan?.trialDays ?? catalogPlan?.trialDays ?? 0,
        monthlyPrice: price.monthlyPrice,
        yearlyPrice: price.yearlyPrice,
        fullYearlyPrice: price.fullYearlyPrice,
        yearlySavings: price.yearlySavings,
        cta,
        popular: planId === "pro",
        checkoutEnabled,
        isCurrent,
        hasYearly,
      };
    });
  }, [overviewQuery.data]);

  const handleCheckout = async (plan: PlanCard): Promise<void> => {
    if (pendingPlanId || plan.isCurrent || plan.id === "free") return;
    if (!plan.checkoutEnabled) {
      toast("Please contact sales for this plan.", "info");
      return;
    }

    // Max only supports monthly billing; Pro supports month/year
    const billingCycle = plan.id === "max" ? "month" : (plan.hasYearly && isYearly ? "year" : "month");
    setPendingPlanId(plan.id);

    try {
      const billingUrl = `${window.location.origin}${ROUTES.DASHBOARD.BILLING}`;
      const session = await checkoutSessionMutation.mutateAsync({
        planId: plan.id,
        billingCycle,
        successUrl: `${billingUrl}?checkout=success`,
        cancelUrl: `${billingUrl}?checkout=cancelled`,
      });
      window.location.assign(session.checkoutUrl);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Unable to start checkout.", "error");
      setPendingPlanId(null);
    }
  };

  if (!isPlansDialogOpen) return null;

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
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-3 sm:mb-4">
              Choose your plan
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground px-2 sm:px-0">
              All plans include balance that can be topped up anytime. Upgrade or cancel any time.
            </p>
          </div>

          {/* Monthly/Yearly toggle — only relevant for Pro */}
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
              Yearly <span className="text-nirex-success text-xs ml-1 bg-nirex-success/10 px-1.5 sm:px-2 py-0.5 rounded-full hidden sm:inline">Pro only · Save $40</span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 w-full max-w-5xl pb-6 sm:pb-10">
            {plans.map((plan) => {
              const showYearly = isYearly && plan.hasYearly && plan.yearlyPrice !== null;
              const displayPrice = showYearly ? plan.yearlyPrice! : plan.monthlyPrice;
              return (
                <div
                  key={plan.id}
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
                      <span className="text-3xl sm:text-4xl font-bold tracking-tight">{displayPrice}</span>
                      {displayPrice !== "Custom" && displayPrice !== "$0.00" && (
                        <span className="text-muted-foreground font-medium text-sm sm:text-base">/ mo</span>
                      )}
                    </div>
                    {showYearly && plan.fullYearlyPrice && (
                      <p className="text-xs text-muted-foreground mt-1">Billed as {plan.fullYearlyPrice}/year</p>
                    )}
                    {showYearly && plan.yearlySavings && (
                      <p className="text-xs text-nirex-success mt-1">Save {plan.yearlySavings}/year</p>
                    )}
                    {!plan.hasYearly && plan.id !== "free" && (
                      <p className="text-xs text-muted-foreground mt-1">Monthly billing only</p>
                    )}
                    {plan.trialDays > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">{plan.trialDays}-day free trial</p>
                    )}
                  </div>

                  <MagneticButton
                    strength={0.3}
                    onClick={() => { void handleCheckout(plan); }}
                    disabled={plan.isCurrent || plan.cta === "Included"}
                    className={`w-full py-2 sm:py-2.5 px-3 sm:px-4 rounded-lg text-sm font-medium transition-colors mb-6 sm:mb-8 ${plan.isCurrent || plan.cta === "Included"
                      ? "bg-muted text-muted-foreground cursor-not-allowed opacity-80"
                      : plan.popular
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border"
                      } ${pendingPlanId ? "pointer-events-none opacity-70" : ""}`}
                  >
                    {pendingPlanId === plan.id ? "Redirecting..." : plan.cta}
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
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-muted-foreground text-center max-w-lg pb-10">
            All plans support balance top-ups. While your top-up balance is above $0, monthly request limits are lifted.
            Included balance resets each billing period; top-up balance never expires.
          </p>
        </div>
      </div>
    </div>
  );
}
