import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type BillingCycle,
  type BillingInvoiceItem,
  type BillingInvoiceStatus,
  type BillingPlanId,
  type BillingSubscriptionStatus,
  type ProrationPreviewQuery,
} from "@nirex/shared";
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Download,
  FileText,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Card, CardContent, KpiCard, PageHeader } from "@nirex/ui";
import { CardSkeleton, Skeleton } from "@nirex/ui/Skeleton";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { billingApi } from "../../../features/billing/billingApi";
import { notificationsBaseQueryKey } from "../../../features/notifications/useNotifications";
import {
  billingQueryKeys,
  checkoutPlanId,
  useApplyDiscountMutation,
  useBillingInvoicesQuery,
  useBillingOverviewQuery,
  useCancelSubscriptionMutation,
  useChangePlanMutation,
  useCreateCheckoutSessionMutation,
  useCreatePortalSessionMutation,
  useDownloadInvoicePdfMutation,
  usePauseSubscriptionMutation,
  useProrationPreviewQuery,
  useRemovePaymentMethodMutation,
  useResumeSubscriptionMutation,
  useRetryPaymentMutation,
  useSetDefaultPaymentMethodMutation,
} from "../../../features/billing";
import {
  getBillingDateKpi,
  getCreditPeriodNotice,
} from "../../../features/billing/billingDisplay";
import { useToast } from "../../../components/ToastProvider";

type BillingTab = "overview" | "plans" | "payments" | "invoices" | "admin";
type PlanDialogState = {
  planId: Exclude<BillingPlanId, "custom">;
  billingCycle: BillingCycle;
} | null;

const ACTIVE_STATUSES: BillingSubscriptionStatus[] = ["TRIALING", "ACTIVE", "PAST_DUE"];
let handledCheckoutLocationKey: string | null = null;
let handledPortalLocationKey: string | null = null;
const PORTAL_SYNC_PENDING_KEY = "nirex.billing.portalSyncPendingAt";
const PORTAL_SYNC_PENDING_TTL_MS = 24 * 60 * 60 * 1000;

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

function formatDate(value: string | null | undefined): string {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function hasActiveTrial(trialEnd: string | null | undefined): boolean {
  if (!trialEnd) return false;
  const end = new Date(trialEnd);
  if (Number.isNaN(end.getTime())) return false;
  return end.getTime() > Date.now();
}

function statusLabel(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function subscriptionBadgeClass(status: BillingSubscriptionStatus): string {
  if (status === "ACTIVE" || status === "TRIALING") {
    return "border-nirex-success/30 bg-nirex-success/10 text-nirex-success";
  }
  if (status === "PAST_DUE" || status === "UNPAID") {
    return "border-nirex-warning/30 bg-nirex-warning/10 text-nirex-warning";
  }
  if (status === "CANCELED") {
    return "border-nirex-error/30 bg-nirex-error/10 text-nirex-error";
  }
  return "border-border bg-muted/40 text-muted-foreground";
}

function invoiceBadgeClass(status: BillingInvoiceStatus): string {
  if (status === "PAID") return "border-nirex-success/30 bg-nirex-success/10 text-nirex-success";
  if (status === "OPEN" || status === "DRAFT") return "border-nirex-warning/30 bg-nirex-warning/10 text-nirex-warning";
  return "border-nirex-error/30 bg-nirex-error/10 text-nirex-error";
}

function openExternal(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}

function markPortalSyncPending(): void {
  try {
    window.localStorage.setItem(PORTAL_SYNC_PENDING_KEY, String(Date.now()));
  } catch {
    // Ignore storage failures; returning from Stripe still triggers a forced sync.
  }
}

function clearPortalSyncPending(): void {
  try {
    window.localStorage.removeItem(PORTAL_SYNC_PENDING_KEY);
  } catch {
    // Ignore storage failures.
  }
}

function hasPortalSyncPending(): boolean {
  try {
    const raw = window.localStorage.getItem(PORTAL_SYNC_PENDING_KEY);
    if (!raw) return false;
    const timestamp = Number(raw);
    if (!Number.isFinite(timestamp) || Date.now() - timestamp > PORTAL_SYNC_PENDING_TTL_MS) {
      clearPortalSyncPending();
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function BillingSkeleton() {
  return (
    <div className="flex flex-col gap-5 px-3 py-4">
      <Skeleton className="h-8 w-56" variant="text" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((item) => <CardSkeleton key={item} />)}
      </div>
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 rounded-md px-3 text-sm font-medium transition-colors ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
    >
      {children}
    </button>
  );
}

export function Billing() {
  const [activeTab, setActiveTab] = useState<BillingTab>("overview");
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>("month");
  const [planDialog, setPlanDialog] = useState<PlanDialogState>(null);
  const [discountCode, setDiscountCode] = useState("");
  const [adminCustomerId, setAdminCustomerId] = useState("");
  const [adminReport, setAdminReport] = useState<string | null>(null);
  const [portalSyncPending, setPortalSyncPending] = useState(hasPortalSyncPending);
  const [isProviderRefreshing, setIsProviderRefreshing] = useState(false);
  const portalSyncInFlightRef = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const overviewQuery = useBillingOverviewQuery();
  const invoicesQuery = useBillingInvoicesQuery(50);
  const checkoutMutation = useCreateCheckoutSessionMutation();
  const changePlanMutation = useChangePlanMutation();
  const cancelMutation = useCancelSubscriptionMutation();
  const pauseMutation = usePauseSubscriptionMutation();
  const resumeMutation = useResumeSubscriptionMutation();
  const retryPaymentMutation = useRetryPaymentMutation();
  const portalMutation = useCreatePortalSessionMutation();
  const removePaymentMethodMutation = useRemovePaymentMethodMutation();
  const setDefaultPaymentMethodMutation = useSetDefaultPaymentMethodMutation();
  const applyDiscountMutation = useApplyDiscountMutation();
  const downloadInvoiceMutation = useDownloadInvoicePdfMutation();

  const overview = overviewQuery.data;
  const invoices =
    (invoicesQuery.data?.items?.length ?? 0) > 0
      ? invoicesQuery.data?.items ?? []
      : overview?.invoices ?? [];
  const trimmedDiscountCode = discountCode.trim();
  const prorationQuery: ProrationPreviewQuery | null = planDialog
    ? {
      planId: planDialog.planId,
      billingCycle: planDialog.billingCycle,
      ...(trimmedDiscountCode ? { couponCode: trimmedDiscountCode } : {}),
    }
    : null;
  const prorationPreview = useProrationPreviewQuery(prorationQuery);

  const forceRefreshBillingFromProvider = useCallback(async (showErrorToast = false): Promise<void> => {
    if (portalSyncInFlightRef.current) return;
    portalSyncInFlightRef.current = true;
    setIsProviderRefreshing(true);

    try {
      const overviewData = await billingApi.getOverview({ force: true });
      const invoicesData = await billingApi.listInvoices({ limit: 50 });

      queryClient.setQueryData(billingQueryKeys.overview(), overviewData);
      queryClient.setQueryData(billingQueryKeys.invoices(50), invoicesData);
      await queryClient.invalidateQueries({ queryKey: notificationsBaseQueryKey });
      clearPortalSyncPending();
      setPortalSyncPending(false);
    } catch (error) {
      if (showErrorToast) {
        toast(error instanceof Error ? error.message : "Unable to refresh billing data.", "error");
      }
    } finally {
      portalSyncInFlightRef.current = false;
      setIsProviderRefreshing(false);
    }
  }, [queryClient, toast]);

  useEffect(() => {
    if (!portalSyncPending) return;
    void forceRefreshBillingFromProvider();
  }, [forceRefreshBillingFromProvider, portalSyncPending]);

  useEffect(() => {
    const syncIfPending = () => {
      const hasPendingSync = hasPortalSyncPending();
      setPortalSyncPending(hasPendingSync);
      if (hasPendingSync) {
        void forceRefreshBillingFromProvider();
      }
    };
    const syncIfVisible = () => {
      if (document.visibilityState === "visible") syncIfPending();
    };

    window.addEventListener("focus", syncIfPending);
    document.addEventListener("visibilitychange", syncIfVisible);
    return () => {
      window.removeEventListener("focus", syncIfPending);
      document.removeEventListener("visibilitychange", syncIfVisible);
    };
  }, [forceRefreshBillingFromProvider]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const checkoutStatus = params.get("checkout");
    if (!checkoutStatus) return;
    if (handledCheckoutLocationKey === location.key) return;
    handledCheckoutLocationKey = location.key;

    if (checkoutStatus === "success") {
      toast("Checkout completed. Billing data is refreshing.", "success");
      void forceRefreshBillingFromProvider();
    }
    if (checkoutStatus === "cancelled") {
      toast("Checkout was cancelled.", "info");
    }

    params.delete("checkout");
    navigate(
      {
        pathname: location.pathname,
        search: params.toString() ? `?${params.toString()}` : "",
        hash: location.hash,
      },
      { replace: true },
    );
  }, [forceRefreshBillingFromProvider, location.hash, location.key, location.pathname, location.search, navigate, toast]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const portalStatus = params.get("portal");
    if (portalStatus !== "updated") return;
    if (handledPortalLocationKey === location.key) return;
    handledPortalLocationKey = location.key;

    void forceRefreshBillingFromProvider();

    params.delete("portal");
    navigate(
      {
        pathname: location.pathname,
        search: params.toString() ? `?${params.toString()}` : "",
        hash: location.hash,
      },
      { replace: true },
    );
  }, [forceRefreshBillingFromProvider, location.hash, location.key, location.pathname, location.search, navigate]);

  const currentStatus = overview?.subscription.status ?? "NONE";
  const showTrialBanner =
    currentStatus === "TRIALING" ||
    (Boolean(overview?.subscription.planId && overview.subscription.planId !== "free") &&
      hasActiveTrial(overview?.subscription.trialEnd));
  const showCancellationScheduledBanner = Boolean(
    overview?.subscription.cancelAtPeriodEnd && currentStatus !== "CANCELED",
  );
  const canPause = currentStatus === "ACTIVE" && !overview?.subscription.cancelAtPeriodEnd;
  const canResume = currentStatus === "PAUSED" || Boolean(overview?.subscription.cancelAtPeriodEnd);
  const canCancel = ACTIVE_STATUSES.includes(currentStatus);

  const tabs = useMemo<BillingTab[]>(() => {
    const base: BillingTab[] = ["overview", "plans", "payments", "invoices"];
    if (overview?.adminAccess) base.push("admin");
    return base;
  }, [overview?.adminAccess]);
  const selectedPlanTrialDays = planDialog
    ? (overview?.plans.find((plan) => plan.id === planDialog.planId)?.trialDays ?? 0)
    : 0;

  async function openHostedPortal(): Promise<void> {
    try {
      const session = await portalMutation.mutateAsync({
        returnUrl: `${window.location.origin}/billing?portal=updated`,
      });
      markPortalSyncPending();
      setPortalSyncPending(true);
      window.location.assign(session.portalUrl);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Unable to open billing portal.", "error");
    }
  }

  async function startCheckout(planId: Exclude<BillingPlanId, "custom">, cycle: BillingCycle): Promise<void> {
    const billingUrl = `${window.location.origin}/billing`;
    const session = await checkoutMutation.mutateAsync({
      planId,
      billingCycle: cycle,
      successUrl: `${billingUrl}?checkout=success`,
      cancelUrl: `${billingUrl}?checkout=cancelled`,
      ...(trimmedDiscountCode ? { couponCode: trimmedDiscountCode } : {}),
    });
    window.location.assign(session.checkoutUrl);
  }

  async function confirmPlanChange(): Promise<void> {
    if (!planDialog) return;
    try {
      if (
        overview?.subscription.status === "NONE" ||
        overview?.subscription.status === "CANCELED" ||
        !overview?.subscription.subscriptionId
      ) {
        await startCheckout(planDialog.planId, planDialog.billingCycle);
      } else {
        await changePlanMutation.mutateAsync(planDialog);
        toast("Subscription plan updated.", "success");
      }
      setPlanDialog(null);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Unable to update plan.", "error");
    }
  }

  async function downloadInvoice(invoice: BillingInvoiceItem): Promise<void> {
    try {
      const result = await downloadInvoiceMutation.mutateAsync(invoice.invoiceId);
      openExternal(result.downloadUrl);
    } catch {
      const fallback = invoice.invoicePdfUrl ?? invoice.hostedInvoiceUrl;
      if (fallback) {
        openExternal(fallback);
        return;
      }
      toast("Invoice PDF is not available yet.", "warning");
    }
  }

  async function runAdminReport(): Promise<void> {
    try {
      const report = await billingApi.getReconciliationReport();
      setAdminReport(`${report.openAlerts.length} open reconciliation alert${report.openAlerts.length === 1 ? "" : "s"}.`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Unable to load reconciliation report.", "error");
    }
  }

  if (overviewQuery.isLoading) return <BillingSkeleton />;

  if (overviewQuery.isError || !overview) {
    return (
      <Card className="border-destructive/20">
        <CardContent className="flex flex-col gap-3 py-8">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <h3 className="text-base font-semibold">Unable to load billing data</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            {overviewQuery.error instanceof Error ? overviewQuery.error.message : "Please try again."}
          </p>
          <button
            type="button"
            onClick={() => void overviewQuery.refetch()}
            className="inline-flex h-9 w-fit items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-muted"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </CardContent>
      </Card>
    );
  }

  const billingDateKpi = getBillingDateKpi(
    {
      status: currentStatus,
      cancelAtPeriodEnd: overview.subscription.cancelAtPeriodEnd,
      currentPeriodEnd: overview.subscription.currentPeriodEnd,
      trialEnd: overview.subscription.trialEnd,
      nextBillingDate: overview.kpis.nextBillingDate,
    },
    formatDate,
  );
  const creditPeriodNotice = getCreditPeriodNotice(
    {
      status: currentStatus,
      cancelAtPeriodEnd: overview.subscription.cancelAtPeriodEnd,
      currentPeriodEnd: overview.subscription.currentPeriodEnd,
      trialEnd: overview.subscription.trialEnd,
      nextCreditResetAt: overview.usage.nextCreditResetAt,
      creditsExpireAt: overview.usage.creditsExpireAt,
    },
    formatDate,
  );
  const subscriptionPeriodLabel = currentStatus === "TRIALING"
    ? "Trial period"
    : overview.subscription.cancelAtPeriodEnd
      ? "Current access period"
      : "Billing period";
  const billingDateKpiChange = currentStatus === "TRIALING"
    ? "Trial active"
    : overview.subscription.cancelAtPeriodEnd || currentStatus === "CANCELED"
      ? "No renewal"
      : currentStatus === "NONE"
        ? "No active plan"
        : formatMoneyMinor(overview.kpis.nextRenewalAmountMinor, overview.kpis.currency);

  return (
    <div className="flex flex-col gap-5 px-3 py-4">
      <PageHeader
        title="Billing"
        description="Manage subscription, payment methods, invoices, and operational billing status."
        actions={
          <button
            type="button"
            onClick={() => {
              void forceRefreshBillingFromProvider(true);
            }}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-muted"
          >
            <RefreshCw className={`h-4 w-4 ${overviewQuery.isFetching || invoicesQuery.isFetching || isProviderRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <TabButton key={tab} active={activeTab === tab} onClick={() => setActiveTab(tab)}>
            {statusLabel(tab)}
          </TabButton>
        ))}
      </div>

      {showTrialBanner && (
        <div className="rounded-lg border border-nirex-success/30 bg-nirex-success/10 p-4 text-sm text-nirex-success">
          Trial ends {formatDate(overview.subscription.trialEnd)}.
        </div>
      )}
      {currentStatus === "PAST_DUE" && (
        <div className="flex flex-col gap-3 rounded-lg border border-nirex-warning/30 bg-nirex-warning/10 p-4 text-sm text-nirex-warning sm:flex-row sm:items-center sm:justify-between">
          <span>Payment is past due. Retry payment or update your payment method.</span>
          <button
            type="button"
            disabled={retryPaymentMutation.isPending}
            onClick={() => {
              retryPaymentMutation.mutate({}, {
                onSuccess: () => toast("Payment retry started.", "success"),
                onError: (error) => toast(error instanceof Error ? error.message : "Payment retry failed.", "error"),
              });
            }}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-primary-foreground disabled:opacity-60"
          >
            {retryPaymentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Retry Payment
          </button>
        </div>
      )}
      {showCancellationScheduledBanner && (
        <div className="flex flex-col gap-3 rounded-lg border border-nirex-warning/30 bg-nirex-warning/10 p-4 text-sm text-nirex-warning sm:flex-row sm:items-center sm:justify-between">
          <span>Subscription is scheduled to cancel on {formatDate(overview.subscription.currentPeriodEnd)}.</span>
          <button
            type="button"
            disabled={resumeMutation.isPending}
            onClick={() => {
              resumeMutation.mutate({}, {
                onSuccess: () => toast("Subscription resumed.", "success"),
                onError: (error) => toast(error instanceof Error ? error.message : "Resume failed.", "error"),
              });
            }}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-primary-foreground disabled:opacity-60"
          >
            {resumeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Resume
          </button>
        </div>
      )}
      {currentStatus === "CANCELED" && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          Subscription is canceled. Choose a plan to resubscribe.
        </div>
      )}

      {activeTab === "overview" && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              title="Current Plan"
              value={overview.currentPlan.name}
              change={formatMoneyMinor(overview.kpis.currentPlanAmountMinor, overview.kpis.currency)}
              changeType="neutral"
              icon={CreditCard}
              changeContext={statusLabel(currentStatus)}
            />
            <KpiCard
              title={billingDateKpi.title}
              value={billingDateKpi.value}
              change={billingDateKpiChange}
              changeType="neutral"
              icon={RefreshCw}
              changeContext={billingDateKpi.context}
            />
            <KpiCard
              title="Paid YTD"
              value={formatMoneyMinor(overview.kpis.totalPaidYtdMinor, overview.kpis.currency)}
              change="Immutable invoices"
              changeType="neutral"
              icon={FileText}
              changeContext="year to date"
            />
            <KpiCard
              title="Fetched"
              value={formatDate(overview.kpis.lastFetchedAt)}
              change={overviewQuery.isFetching ? "Refreshing" : "Current"}
              changeType="neutral"
              icon={CheckCircle2}
              changeContext="server data"
            />
          </div>

          <Card>
            <CardContent className="space-y-4 py-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">{overview.currentPlan.name}</h2>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${subscriptionBadgeClass(currentStatus)}`}>
                      {statusLabel(currentStatus)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {subscriptionPeriodLabel} {formatDate(overview.subscription.currentPeriodStart)} to {formatDate(overview.subscription.currentPeriodEnd)}.
                  </p>
                  {creditPeriodNotice ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {creditPeriodNotice}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!canPause || pauseMutation.isPending}
                    onClick={() => {
                      pauseMutation.mutate({}, {
                        onSuccess: () => toast("Subscription paused.", "success"),
                        onError: (error) => toast(error instanceof Error ? error.message : "Pause failed.", "error"),
                      });
                    }}
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-muted disabled:opacity-50"
                  >
                    <Pause className="h-4 w-4" />
                    Pause
                  </button>
                  <button
                    type="button"
                    disabled={!canResume || resumeMutation.isPending}
                    onClick={() => {
                      resumeMutation.mutate({}, {
                        onSuccess: () => toast("Subscription resumed.", "success"),
                        onError: (error) => toast(error instanceof Error ? error.message : "Resume failed.", "error"),
                      });
                    }}
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-muted disabled:opacity-50"
                  >
                    <Play className="h-4 w-4" />
                    Resume
                  </button>
                  <button
                    type="button"
                    disabled={!canCancel || cancelMutation.isPending}
                    onClick={() => {
                      cancelMutation.mutate({ atPeriodEnd: true }, {
                        onSuccess: () => toast("Cancellation scheduled.", "success"),
                        onError: (error) => toast(error instanceof Error ? error.message : "Cancellation failed.", "error"),
                      });
                    }}
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-nirex-error/30 px-3 text-sm text-nirex-error hover:bg-nirex-error/10 disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4" />
                    Cancel
                  </button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {overview.currentPlan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-nirex-success" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Last fetched {new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" }).format(new Date(overview.kpis.lastFetchedAt))}.
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {activeTab === "plans" && (
        <Card>
          <CardContent className="space-y-5 py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Plans</h2>
              <div className="inline-flex rounded-md border border-border p-1">
                {(["month", "year"] as BillingCycle[]).map((cycle) => (
                  <button
                    key={cycle}
                    type="button"
                    onClick={() => setSelectedCycle(cycle)}
                    className={`h-8 rounded px-3 text-sm ${selectedCycle === cycle ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                  >
                    {cycle === "month" ? "Monthly" : "Yearly"}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              {overview.plans.map((plan) => {
                const planId = checkoutPlanId(plan.id);
                const price = plan.prices[selectedCycle] ?? plan.prices.month;
                const isCurrent = plan.id === overview.currentPlan.id;
                return (
                  <div key={plan.id} className="flex min-h-[300px] flex-col rounded-lg border border-border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{plan.name}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                      </div>
                      {isCurrent && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">Current</span>}
                    </div>
                    <div className="mt-4 text-2xl font-semibold">
                      {price ? formatMoneyMinor(price.amountMinor, price.currency) : "Custom"}
                      {price && <span className="text-sm font-normal text-muted-foreground"> / {selectedCycle}</span>}
                    </div>
                    {plan.trialDays > 0 && <p className="mt-1 text-xs text-muted-foreground">{plan.trialDays}-day free trial</p>}
                    <div className="mt-4 flex-1 space-y-2">
                      {plan.features.map((feature) => (
                        <div key={feature} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-nirex-success" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      disabled={!planId || isCurrent || !plan.checkoutEnabled}
                      onClick={() => {
                        if (!planId) {
                          toast("Contact sales for enterprise billing.", "info");
                          return;
                        }
                        setPlanDialog({ planId, billingCycle: selectedCycle });
                      }}
                      className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 text-sm text-primary-foreground disabled:bg-muted disabled:text-muted-foreground"
                    >
                      {isCurrent ? "Current Plan" : plan.checkoutEnabled ? "Select Plan" : "Contact Sales"}
                    </button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "payments" && (
        <Card>
          <CardContent className="space-y-4 py-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Payment Methods</h2>
                <p className="mt-1 text-sm text-muted-foreground">Card details are collected only through the payment provider hosted flow.</p>
              </div>
              <button
                type="button"
                disabled={portalMutation.isPending}
                onClick={() => void openHostedPortal()}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm text-primary-foreground disabled:opacity-60"
              >
                {portalMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Secure Portal
              </button>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
              PCI posture: this app never handles raw card numbers, CVV, or full PAN.
            </div>
            {overview.paymentMethods.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No saved payment methods.
              </div>
            ) : (
              <div className="space-y-3">
                {overview.paymentMethods.map((method) => (
                  <div key={method.id} className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">
                          {(method.brand ?? "Card").toUpperCase()} ending {method.last4 ?? "----"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Expires {method.expMonth ?? "--"}/{method.expYear ?? "----"}
                          {method.isDefault ? " · Default" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={method.isDefault || setDefaultPaymentMethodMutation.isPending}
                        onClick={() => {
                          setDefaultPaymentMethodMutation.mutate(method.id, {
                            onSuccess: () => toast("Default payment method updated.", "success"),
                            onError: (error) => toast(error instanceof Error ? error.message : "Unable to set default.", "error"),
                          });
                        }}
                        className="h-9 rounded-md border border-border px-3 text-sm hover:bg-muted disabled:opacity-50"
                      >
                        Set Default
                      </button>
                      <button
                        type="button"
                        disabled={removePaymentMethodMutation.isPending}
                        onClick={() => {
                          removePaymentMethodMutation.mutate(method.id, {
                            onSuccess: () => toast("Payment method removed.", "success"),
                            onError: (error) => toast(error instanceof Error ? error.message : "Unable to remove method.", "error"),
                          });
                        }}
                        className="h-9 rounded-md border border-nirex-error/30 px-3 text-sm text-nirex-error hover:bg-nirex-error/10 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "invoices" && (
        <Card>
          <CardContent className="space-y-4 py-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Invoice History</h2>
              {invoicesQuery.isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-3 pr-4 font-medium">Invoice</th>
                    <th className="py-3 pr-4 font-medium">Date</th>
                    <th className="py-3 pr-4 font-medium">Description</th>
                    <th className="py-3 pr-4 font-medium">Amount</th>
                    <th className="py-3 pr-4 font-medium">Status</th>
                    <th className="py-3 text-right font-medium">PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {invoices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">No invoices available.</td>
                    </tr>
                  ) : invoices.map((invoice) => (
                    <tr key={invoice.invoiceId}>
                      <td className="py-3 pr-4 font-medium">{invoice.number ?? invoice.invoiceNumber ?? invoice.invoiceId}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{formatDate(invoice.createdAt)}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{invoice.description ?? "Subscription invoice"}</td>
                      <td className="py-3 pr-4">{formatMoneyMinor(invoice.totalMinor, invoice.currency)}</td>
                      <td className="py-3 pr-4">
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${invoiceBadgeClass(invoice.status)}`}>
                          {statusLabel(invoice.status)}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          disabled={downloadInvoiceMutation.isPending}
                          onClick={() => void downloadInvoice(invoice)}
                          className="inline-flex h-8 items-center gap-2 rounded-md border border-border px-2 text-sm hover:bg-muted disabled:opacity-50"
                        >
                          <Download className="h-4 w-4" />
                          Download
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "admin" && overview.adminAccess && (
        <Card>
          <CardContent className="space-y-4 py-5">
            <h2 className="text-lg font-semibold">Billing Admin</h2>
            <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
              <input
                value={adminCustomerId}
                onChange={(event) => setAdminCustomerId(event.target.value)}
                className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                placeholder="Customer ObjectId"
                aria-label="Customer ObjectId"
              />
              <button
                type="button"
                onClick={() => void runAdminReport()}
                className="h-9 rounded-md border border-border px-3 text-sm hover:bg-muted"
              >
                Reconciliation Report
              </button>
              <button
                type="button"
                disabled={!adminCustomerId.trim()}
                onClick={async () => {
                  try {
                    const summary = await billingApi.getAdminCustomerSummary(adminCustomerId.trim());
                    setAdminReport(`${summary.invoices.length} invoices and ${summary.auditLogs.length} audit entries loaded.`);
                  } catch (error) {
                    toast(error instanceof Error ? error.message : "Unable to load customer.", "error");
                  }
                }}
                className="h-9 rounded-md bg-primary px-3 text-sm text-primary-foreground disabled:opacity-50"
              >
                Load Customer
              </button>
            </div>
            {adminReport && <p className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">{adminReport}</p>}
          </CardContent>
        </Card>
      )}

      {planDialog && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-lg">
            <h2 className="text-lg font-semibold">Confirm Plan Change</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Review the amount due today before changing plans.
            </p>
            <div className="mt-4 space-y-2 rounded-lg border border-border p-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Plan</span>
                <span>{statusLabel(planDialog.planId)} · {planDialog.billingCycle}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Due today</span>
                <span>
                  {prorationPreview.data
                    ? formatMoneyMinor(prorationPreview.data.amountDueToday.amountMinor, prorationPreview.data.amountDueToday.currency)
                    : prorationPreview.isFetching ? "Calculating" : "Available at checkout"}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Recurring</span>
                <span>
                  {prorationPreview.data
                    ? formatMoneyMinor(prorationPreview.data.newRecurringAmount.amountMinor, prorationPreview.data.newRecurringAmount.currency)
                    : "Available at checkout"}
                </span>
              </div>
              {selectedPlanTrialDays > 0 && (
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Trial</span>
                  <span>{selectedPlanTrialDays}-day free trial</span>
                </div>
              )}
            </div>
            <div className="mt-4">
              <label className="text-sm font-medium" htmlFor="discount-code">Discount code</label>
              <div className="mt-2 flex gap-2">
                <input
                  id="discount-code"
                  value={discountCode}
                  onChange={(event) => setDiscountCode(event.target.value)}
                  className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
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
                  className="h-9 rounded-md border border-border px-3 text-sm hover:bg-muted disabled:opacity-50"
                >
                  Apply
                </button>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPlanDialog(null)}
                className="h-9 rounded-md border border-border px-3 text-sm hover:bg-muted"
              >
                Close
              </button>
              <button
                type="button"
                disabled={checkoutMutation.isPending || changePlanMutation.isPending}
                onClick={() => void confirmPlanChange()}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm text-primary-foreground disabled:opacity-60"
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
