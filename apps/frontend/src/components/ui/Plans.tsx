import { useEffect, useMemo, useState } from "react";
import type { BillingPlan, BillingPlanId, BillingCycle, ProrationPreviewQuery } from "@nirex/shared";
import {
  BILLING_PLAN_CATALOG,
  DEFAULT_BILLING_CURRENCY,
  GO_MONTHLY_DEFAULT_CENTS,
  GO_YEARLY_DEFAULT_CENTS,
  PRO_MONTHLY_DEFAULT_CENTS,
  PRO_YEARLY_DEFAULT_CENTS,
  PLUS_MONTHLY_DEFAULT_CENTS,
  PLUS_YEARLY_DEFAULT_CENTS,
  MAX_MONTHLY_DEFAULT_CENTS,
} from "@nirex/shared";
import { CheckCircle2, Loader2, X } from "lucide-react";
import { usePlansDialog } from "../../hooks/usePlansDialog";
import {
  useBillingOverviewQuery,
  useCreateCheckoutSessionMutation,
  useChangePlanMutation,
  useApplyDiscountMutation,
  useProrationPreviewQuery,
} from "../../features/billing";
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
  cta: "Buy Now" | "Contact Sales" | "Current Plan" | "Included" | "Upgrade" | "Downgrade";
  popular: boolean;
  checkoutEnabled: boolean;
  isCurrent: boolean;
  isDowngrade: boolean;
  hasYearly: boolean;
}

const PLAN_ORDER: CheckoutPlanId[] = ["free", "go", "pro", "plus", "max"];

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

function formatMoneyMinor(amountMinor: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 2,
    }).format(amountMinor / 100);
  } catch {
    return `${amountMinor} ${currency.toUpperCase()}`;
  }
}

function getDefaultPlanPriceCents(planId: CheckoutPlanId, cycle: "month" | "year"): number | null {
  if (planId === "free") return 0;
  if (planId === "go") return cycle === "month" ? GO_MONTHLY_DEFAULT_CENTS : GO_YEARLY_DEFAULT_CENTS;
  if (planId === "pro") return cycle === "month" ? PRO_MONTHLY_DEFAULT_CENTS : PRO_YEARLY_DEFAULT_CENTS;
  if (planId === "plus") return cycle === "month" ? PLUS_MONTHLY_DEFAULT_CENTS : PLUS_YEARLY_DEFAULT_CENTS;
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

function statusLabel(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

type PlanDialogState = {
  planId: CheckoutPlanId;
  billingCycle: BillingCycle;
} | null;

export function Plans() {
  const [isYearly, setIsYearly] = useState(false);
  const [planDialog, setPlanDialog] = useState<PlanDialogState>(null);
  const [discountCode, setDiscountCode] = useState("");
  const { toast } = useToast();
  const { isPlansDialogOpen, closePlansDialog } = usePlansDialog();
  const overviewQuery = useBillingOverviewQuery();
  const checkoutMutation = useCreateCheckoutSessionMutation();
  const changePlanMutation = useChangePlanMutation();
  const applyDiscountMutation = useApplyDiscountMutation();

  const overview = overviewQuery.data;

  const trimmedDiscountCode = discountCode.trim();
  const prorationQuery: ProrationPreviewQuery | null = planDialog
    ? {
      planId: planDialog.planId,
      billingCycle: planDialog.billingCycle,
      ...(trimmedDiscountCode ? { couponCode: trimmedDiscountCode } : {}),
    }
    : null;
  const prorationPreview = useProrationPreviewQuery(prorationQuery);

  useEffect(() => {
    if (!isPlansDialogOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (planDialog) {
          setPlanDialog(null);
        } else {
          closePlansDialog();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [closePlansDialog, isPlansDialogOpen, planDialog]);

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
      const checkoutEnabled = apiPlan?.checkoutEnabled ?? (planId !== "free");
      const price = getDisplayPlanPrices(apiPlan, planId);
      const hasYearly = getDefaultPlanPriceCents(planId, "year") !== null;

      const currentIndex = currentPlanId ? PLAN_ORDER.indexOf(currentPlanId as CheckoutPlanId) : -1;
      const planIndex = PLAN_ORDER.indexOf(planId);
      const isDowngrade = currentIndex >= 0 && planIndex < currentIndex;
      const isUpgrade = currentIndex >= 0 && planIndex > currentIndex;

      let cta: PlanCard["cta"] = "Buy Now";
      if (planId === "max" && !checkoutEnabled) cta = "Contact Sales";
      else if (isCurrent) cta = "Current Plan";
      else if (planId === "free") cta = "Included";
      else if (isUpgrade) cta = "Upgrade";
      else if (isDowngrade) cta = "Downgrade";

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
        isDowngrade,
        hasYearly,
      };
    });
  }, [overviewQuery.data]);

  const selectedPlanTrialDays = planDialog
    ? (overview?.plans.find((plan) => plan.id === planDialog.planId)?.trialDays ?? 0)
    : 0;

  const handleSelectPlan = (plan: PlanCard) => {
    if (plan.isCurrent || plan.id === "free") return;
    if (!plan.checkoutEnabled) {
      toast("Please contact sales for this plan.", "info");
      return;
    }
    const billingCycle = plan.hasYearly && isYearly ? "year" : "month";
    setPlanDialog({ planId: plan.id, billingCycle });
  };

  const startCheckout = async (planId: Exclude<BillingPlanId, "custom">, cycle: BillingCycle): Promise<void> => {
    const billingUrl = `${window.location.origin}${ROUTES.DASHBOARD.BILLING}`;
    const session = await checkoutMutation.mutateAsync({
      planId,
      billingCycle: cycle,
      successUrl: `${billingUrl}?checkout=success`,
      cancelUrl: `${billingUrl}?checkout=cancelled`,
      ...(trimmedDiscountCode ? { couponCode: trimmedDiscountCode } : {}),
    });
    window.location.assign(session.checkoutUrl);
  };

  const confirmPlanChange = async (): Promise<void> => {
    if (!planDialog) return;
    try {
      const hasActiveSubscription =
        overview?.subscription.status !== "NONE" &&
        overview?.subscription.status !== "CANCELED" &&
        Boolean(overview?.subscription.subscriptionId);

      if (!hasActiveSubscription) {
        await startCheckout(planDialog.planId, planDialog.billingCycle);
      } else {
        await changePlanMutation.mutateAsync(planDialog);
        toast("Subscription plan updated.", "success");
      }
      setPlanDialog(null);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Unable to update plan.", "error");
    }
  };

  if (!isPlansDialogOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/60">
      <div className="absolute inset-0 bg-background overflow-y-auto">
        <button
          type="button"
          onClick={() => {
            if (planDialog) {
              setPlanDialog(null);
            } else {
              closePlansDialog();
            }
          }}
          className="fixed top-3 right-3 sm:top-5 sm:right-5 z-[60] inline-flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Close plans dialog"
        >
          <X size={18} className="sm:w-5 sm:h-5" />
        </button>

        <div className="min-h-screen flex flex-col gap-4 sm:gap-6 lg:gap-8 container px-4 sm:px-6 py-6 sm:py-8 lg:py-10 mx-auto items-center">
          <div className="text-center max-w-2xl mx-auto mb-2 sm:mb-4 pt-6 sm:pt-10">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-3 sm:mb-4 font-display">
              Choose your plan
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground px-2 sm:px-0">
              All plans include balance that can be topped up anytime. Upgrade or cancel any time.
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-4 sm:mb-8">
            <span className={`text-sm font-medium ${!isYearly ? "text-foreground" : "text-muted-foreground"}`}>Monthly</span>
            <button
              type="button"
              onClick={() => setIsYearly((prev) => !prev)}
              className="relative inline-flex h-5 w-9 sm:h-6 sm:w-11 items-center bg-primary transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
            >
              <span className={`inline-block h-3 w-3 sm:h-4 sm:w-4 bg-white transition-transform ${isYearly ? "translate-x-5 sm:translate-x-6" : "translate-x-1"}`} />
            </button>
            <span className={`text-sm font-medium ${isYearly ? "text-foreground" : "text-muted-foreground"}`}>
              Yearly
              <span className="text-nirex-success text-xs ml-1 bg-nirex-success/10 px-1.5 sm:px-2 py-0.5 hidden sm:inline">
                Save with annual billing
              </span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6 w-full max-w-[90rem] pb-6 sm:pb-10">
            {plans.map((plan) => {
              const showYearly = isYearly && plan.hasYearly && plan.yearlyPrice !== null;
              const displayPrice = showYearly ? plan.yearlyPrice! : plan.monthlyPrice;
              // Mobile single-column: Go first, Free last. Grid layouts (sm+): natural order.
              const mobileOrder = plan.id === "go" ? "order-1" : plan.id === "pro" ? "order-2" : plan.id === "plus" ? "order-3" : plan.id === "max" ? "order-4" : "order-5";
              const naturalOrder = plan.id === "free" ? "sm:order-1" : plan.id === "go" ? "sm:order-2" : plan.id === "pro" ? "sm:order-3" : plan.id === "plus" ? "sm:order-4" : "sm:order-5";
              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col border p-4 sm:p-6 transition-colors ${mobileOrder} ${naturalOrder} ${plan.popular ? "border-primary/50 bg-primary/5" : "border-border hover:border-border"}`}
                >
                  {plan.popular && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-primary-foreground text-[10px] sm:text-xs font-medium px-2.5 sm:px-3 py-1 uppercase tracking-wider">
                      Most Popular
                    </div>
                  )}

                  <div className="mb-4 sm:mb-6">
                    <h3 className="text-lg sm:text-xl font-semibold mb-1 sm:mb-2 font-display">{plan.name}</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground min-h-[2rem] sm:min-h-[2.5rem]">{plan.description}</p>
                  </div>

                  <div className="mb-4 sm:mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl sm:text-4xl font-bold tracking-tight font-mono">{displayPrice}</span>
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

                  <button
                    type="button"
                    onClick={() => { void handleSelectPlan(plan); }}
                    disabled={plan.isCurrent || plan.cta === "Included" || plan.isDowngrade}
                    className={`w-full py-2 sm:py-2.5 px-3 sm:px-4 text-sm font-medium transition-colors mb-6 sm:mb-8 ${plan.isCurrent || plan.cta === "Included" || plan.isDowngrade ? "bg-muted text-muted-foreground cursor-not-allowed opacity-80" : plan.popular ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border" }`}
                  >
                    {plan.cta}
                  </button>

                  <div className="flex-1 flex flex-col gap-3 sm:gap-4">
                    <p className="text-xs sm:text-sm font-medium font-display">What&apos;s included:</p>
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
            All plans support balance top-ups. While your top-up balance is above $0, rolling window request limits are lifted.
            Included balance resets each billing period; top-up balance never expires.
          </p>
        </div>
      </div>

      {/* Confirm plan dialog */}
      {planDialog && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/60 p-4">
          <div className="w-full max-w-md border border-border bg-card p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="text-lg font-semibold font-display">Confirm Plan Change</h2>
              <button
                type="button"
                onClick={() => setPlanDialog(null)}
                className="inline-flex items-center justify-center w-8 h-8 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              Review the amount due today before changing plans.
            </p>

            <div className="space-y-2 border border-border p-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Plan</span>
                <span>{statusLabel(planDialog.planId)} · {planDialog.billingCycle}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">{planDialog.billingCycle === "year" ? "Annual price" : "Monthly price"}</span>
                <span>
                  {prorationPreview.data
                    ? `${formatMoneyMinor(prorationPreview.data.newRecurringAmount.amountMinor, prorationPreview.data.newRecurringAmount.currency)} / ${planDialog.billingCycle === "year" ? "yr" : "mo"}`
                    : prorationPreview.isFetching ? "Calculating…" : "Available at checkout"}
                </span>
              </div>
              {prorationPreview.data && prorationPreview.data.creditApplied.amountMinor > 0 && (
                <>
                  <div className="flex justify-between gap-3 text-nirex-success">
                    <span>Unused time on current plan</span>
                    <span>−{formatMoneyMinor(prorationPreview.data.creditApplied.amountMinor, prorationPreview.data.creditApplied.currency)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Prorated refund for remaining days on your current subscription
                  </p>
                </>
              )}
              <div className="flex justify-between gap-3 border-t border-border pt-2 font-medium">
                <span>Due today</span>
                <span>
                  {prorationPreview.data
                    ? formatMoneyMinor(prorationPreview.data.amountDueToday.amountMinor, prorationPreview.data.amountDueToday.currency)
                    : prorationPreview.isFetching ? "Calculating…" : "Available at checkout"}
                </span>
              </div>
              {selectedPlanTrialDays > 0 && (
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Trial</span>
                  <span>{selectedPlanTrialDays}-day free trial</span>
                </div>
              )}
            </div>

            {prorationPreview.data?.description && (
              <p className="mt-2 text-xs text-muted-foreground">{prorationPreview.data.description}</p>
            )}

            <div className="mt-4">
              <label className="text-sm font-medium" htmlFor="discount-code">Discount code</label>
              <div className="mt-2 flex gap-2">
                <input
                  id="discount-code"
                  value={discountCode}
                  onChange={(event) => setDiscountCode(event.target.value)}
                  className="h-9 min-w-0 flex-1 border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  type="button"
                  disabled={!discountCode.trim() || applyDiscountMutation.isPending}
                  onClick={() => {
                    applyDiscountMutation.mutate({ code: discountCode.trim() }, {
                      onSuccess: () => toast("Discount applied.", "success"),
                      onError: (error) => toast(error instanceof Error ? error.message : "Discount failed.", "error"),
                    });
                  }}
                  className="h-9 border border-border px-3 text-sm hover:bg-muted disabled:opacity-50"
                >
                  Apply
                </button>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPlanDialog(null)}
                className="h-9 border border-border px-3 text-sm hover:bg-muted"
              >
                Close
              </button>
              <button
                type="button"
                disabled={checkoutMutation.isPending || changePlanMutation.isPending}
                onClick={() => void confirmPlanChange()}
                className="inline-flex h-9 items-center gap-2 bg-primary px-3 text-sm text-primary-foreground disabled:opacity-60"
              >
                {(checkoutMutation.isPending || changePlanMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
