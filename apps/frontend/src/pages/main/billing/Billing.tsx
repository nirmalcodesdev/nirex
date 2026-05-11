import { useEffect } from "react";
import type {
  BillingCycle,
  BillingInvoiceItem,
  BillingInvoiceStatus,
  BillingOverviewResponse,
} from "@nirex/shared";
import {
  CheckCircle2,
  MoreHorizontal,
  DollarSign,
  Receipt,
  Calendar,
  TrendingDown,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  CreditCard,
} from "lucide-react";
import { Card, CardContent, Dropdown, DropdownItem, KpiCard, PageHeader } from "@nirex/ui";
import { CardSkeleton, Skeleton } from "@nirex/ui/Skeleton";
import { useLocation, useNavigate } from "react-router-dom";
import { useToast } from "../../../components/ToastProvider";
import {
  useBillingInvoicesQuery,
  useBillingOverviewQuery,
} from "../../../features/billing";
import { usePlansDialog } from "../../../hooks/usePlansDialog";

const ACTIVE_SUBSCRIPTION_STATUSES: BillingOverviewResponse["subscription"]["status"][] = [
  "trialing",
  "active",
  "past_due",
];

function isActiveSubscription(
  status: BillingOverviewResponse["subscription"]["status"],
): boolean {
  return ACTIVE_SUBSCRIPTION_STATUSES.includes(status);
}

function capitalize(value: string): string {
  if (!value) return value;
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

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

function formatDate(value: string | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(
    undefined,
    options ?? {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  ).format(date);
}

function formatDaysRemaining(value: string | null | undefined): string {
  if (!value) return "N/A";
  const target = new Date(value).getTime();
  if (Number.isNaN(target)) return "N/A";
  const diff = target - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return "Past due";
  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

function deriveBillingCycle(overview: BillingOverviewResponse): BillingCycle | null {
  const amount = overview.kpis.currentPlanAmountCents;
  const monthAmount = overview.currentPlan.prices.month?.amountCents;
  const yearAmount = overview.currentPlan.prices.year?.amountCents;

  if (monthAmount !== undefined && monthAmount === amount) return "month";
  if (yearAmount !== undefined && yearAmount === amount) return "year";
  return null;
}

function subscriptionPeriodEnd(overview: BillingOverviewResponse): string | null {
  return overview.kpis.periodEndDate ?? overview.subscription.currentPeriodEnd;
}

function invoiceDisplayId(invoice: BillingInvoiceItem): string {
  return invoice.number ?? invoice.invoiceId;
}

function invoiceDate(invoice: BillingInvoiceItem): string {
  return formatDate(invoice.paidAt ?? invoice.createdAt);
}

function invoiceAmount(invoice: BillingInvoiceItem): string {
  return formatCurrencyFromCents(invoice.totalCents, invoice.currency);
}

function openExternal(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}

function subscriptionStatusLabel(
  status: BillingOverviewResponse["subscription"]["status"],
): string {
  if (status === "none") return "No subscription";
  if (status === "incomplete_expired") return "Incomplete expired";
  return capitalize(status.replace(/_/g, " "));
}

// Loading skeleton using Skeleton component
function BillingSkeleton() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6 py-2 sm:py-4 lg:py-5 px-3 mx-auto">
      <Skeleton className="h-8 w-48" variant="text" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-lg" variant="default" />
            <Skeleton className="h-4 w-24" variant="text" />
          </div>
          <Skeleton className="h-8 w-32" variant="text" />
          <Skeleton className="h-3 w-20" variant="text" />
          <Skeleton className="h-40 w-full" variant="card" />
        </div>
        <CardSkeleton />
      </div>
    </div>
  );
}

export function Billing() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { openPlansDialog } = usePlansDialog();
  
  const params = new URLSearchParams(location.search);
  const overviewQuery = useBillingOverviewQuery();
  const invoicesQuery = useBillingInvoicesQuery(50);
  const { refetch: refetchOverview } = overviewQuery;
  const { refetch: refetchInvoices } = invoicesQuery;

  const overview = overviewQuery.data;
  const invoices = invoicesQuery.data ?? overview?.invoices ?? [];

  useEffect(() => {
    const checkoutStatus = params.get("checkout");
    
    if (!checkoutStatus) return;

    if (checkoutStatus === "success") {
      toast("Purchase completed. Your plan status may take a moment to update.", "success");
      void refetchOverview();
      void refetchInvoices();
    } else if (checkoutStatus === "cancelled") {
      toast("Purchase was cancelled.", "info");
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
  }, [location.hash, location.pathname, location.search, navigate, refetchInvoices, refetchOverview, toast]);

  const handleUpgrade = () => {
    openPlansDialog();
  };

  const handleDownloadAllInvoices = () => {
    const invoiceUrls = invoices
      .map((invoice) => invoice.invoicePdfUrl ?? invoice.hostedInvoiceUrl)
      .filter((url): url is string => Boolean(url));

    if (invoiceUrls.length === 0) {
      toast("No downloadable invoices are available yet.", "info");
      return;
    }

    invoiceUrls.forEach((url, index) => {
      window.setTimeout(() => openExternal(url), index * 150);
    });
    toast(`Opening ${invoiceUrls.length} invoice${invoiceUrls.length > 1 ? "s" : ""}.`, "success");
  };

  if (overviewQuery.isLoading) {
    return <BillingSkeleton />;
  }

  if (overviewQuery.isError || !overview) {
    return (
      <Card className="border-destructive/20">
        <CardContent className="flex flex-col gap-3 py-8">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <h3 className="text-base font-semibold">Unable to load billing data</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            {overviewQuery.error instanceof Error
              ? overviewQuery.error.message
              : "Please try again in a moment."}
          </p>
          <div>
            <button
              type="button"
              onClick={() => void overviewQuery.refetch()}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const billingCycle = deriveBillingCycle(overview);
  const usagePct = overview.usage.creditsUsagePct ?? 0;
  const usagePctSafe = Math.max(0, Math.min(100, usagePct));
  const entitlement = overview.entitlement;
  const hasPaidPlan = entitlement.canAccessPaidFeatures;

  return (
    <div className="flex flex-col gap-4 sm:gap-6 lg:gap-8 py-2 sm:py-4 lg:py-5 px-3 mx-auto">
      <PageHeader
        title="Billing & Plans"
        description="Manage your one-time plan purchases and billing history."
        actions={
          <>
            <button
              type="button"
              onClick={() => void overviewQuery.refetch()}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
            >
              <RefreshCw
                className={`h-4 w-4 ${overviewQuery.isFetching || invoicesQuery.isFetching ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleUpgrade}
              disabled={!overview.billingEnabled}
              className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 rounded-lg px-4 py-2 text-sm font-medium transition-colors shadow-sm w-fit"
            >
              {hasPaidPlan ? "Extend Plan" : "Buy Plan"}
            </button>
          </>
        }
      />

      {!overview.billingEnabled ? (
        <div className="rounded-xl border border-nirex-warning/30 bg-nirex-warning/10 p-4 text-sm text-muted-foreground">
          Billing is currently disabled in this environment.
        </div>
      ) : null}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Current Plan"
          value={overview.currentPlan.name}
          change={formatCurrencyFromCents(overview.kpis.currentPlanAmountCents, overview.kpis.currency)}
          changeType={entitlement.canAccessPaidFeatures ? "positive" : "neutral"}
          icon={DollarSign}
          changeContext={entitlement.status === "none" ? "free access" : entitlement.status.replace(/_/g, " ")}
        />
        <KpiCard
          title="Total Spent (YTD)"
          value={formatCurrencyFromCents(overview.kpis.totalPaidYtdCents, overview.kpis.currency)}
          change={overview.billingEnabled ? "Live data" : "Unavailable"}
          changeType="neutral"
          icon={Receipt}
          changeContext="year to date"
        />
        <KpiCard
          title="Plan Expiry Date"
          value={formatDate(subscriptionPeriodEnd(overview), { month: "long", day: "numeric", year: "numeric" })}
          change={formatDaysRemaining(subscriptionPeriodEnd(overview))}
          changeType="neutral"
          icon={Calendar}
          changeContext="remaining"
        />
        {overview.kpis.yearlySavingsCents > 0 && (
          <KpiCard
            title="Savings"
            value={formatCurrencyFromCents(overview.kpis.yearlySavingsCents, overview.kpis.currency)}
            change="One-time discount"
            changeType="positive"
            icon={TrendingDown}
            changeContext="vs monthly"
          />
        )}
      </div>

      {/* Current Plan */}
      <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
          <div className="p-5 sm:p-6 border-b border-border flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1 sm:mb-2">
                <h2 className="text-lg sm:text-xl font-medium">{overview.currentPlan.name} Plan</h2>
                <span className="bg-primary text-primary-foreground text-xs font-medium px-2 py-0.5 rounded-full">
                  {entitlement.status === "active" ? "Active" : "Standard"}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {hasPaidPlan
                  ? `Plan expires on ${formatDate(
                    subscriptionPeriodEnd(overview),
                  )}. No automatic renewal.`
                  : "No active paid plan. Purchase a plan to get more credits."}
              </p>
            </div>
            <div className="sm:text-right">
              <div className="text-2xl sm:text-3xl font-semibold tracking-tight">
                {formatCurrencyFromCents(overview.kpis.currentPlanAmountCents, overview.kpis.currency)}
                <span className="text-base sm:text-lg text-muted-foreground font-normal">
                  {billingCycle === "year" ? " / yr" : " / mo"}
                </span>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-6 flex-1 flex flex-col gap-6">
            {/* Usage Progress */}
            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-medium">Compute Usage</span>
                <span className="text-muted-foreground">
                  {overview.usage.creditsUsed !== null && overview.usage.creditsIncluded !== null
                    ? `${overview.usage.creditsUsed.toLocaleString()} / ${overview.usage.creditsIncluded.toLocaleString()} monthly credits`
                    : "Usage data unavailable"}
                </span>
              </div>
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-nirex-accent rounded-full"
                  style={{
                    width: `${usagePctSafe}%`,
                    backgroundImage:
                      "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.2) 4px, rgba(255,255,255,0.2) 8px)",
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {overview.usage.creditsUsagePct !== null
                  ? `You have used ${overview.usage.creditsUsagePct.toFixed(
                    1,
                  )}% of your monthly credits. Credits reset every month during your active plan period.`
                  : "Credit usage percentage will appear once usage data is available."}
              </p>
            </div>

            {/* Features */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-4 border-t border-border">
              {overview.currentPlan.features.map((feature) => (
                <div key={feature} className="flex items-start gap-2">
                  <CheckCircle2
                    size={16}
                    className="text-nirex-success mt-0.5 shrink-0"
                  />
                  <span className="text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </div>
      </div>

      {/* Billing History */}
      <div className="bg-card border border-border rounded-xl overflow-visible">
        <div className="p-5 sm:p-6 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-lg font-medium">Billing History</h2>
          <button
            type="button"
            onClick={handleDownloadAllInvoices}
            className="text-sm font-medium text-primary hover:underline w-fit"
          >
            Download All
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border">
              <tr>
                <th className="px-4 sm:px-6 py-4 font-medium">Invoice</th>
                <th className="px-4 sm:px-6 py-4 font-medium">Date</th>
                <th className="px-4 sm:px-6 py-4 font-medium">Amount</th>
                <th className="px-4 sm:px-6 py-4 font-medium">Status</th>
                <th className="px-4 sm:px-6 py-4 font-medium text-right">
                  Receipt
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 sm:px-6 py-8 text-center text-sm text-muted-foreground">
                    No invoices available yet.
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => (
                  <tr
                    key={invoice.invoiceId}
                    className="hover:bg-muted/30 transition-colors group"
                  >
                    <td className="px-4 sm:px-6 py-4 font-medium">{invoiceDisplayId(invoice)}</td>
                    <td className="px-4 sm:px-6 py-4 text-muted-foreground">
                      {invoiceDate(invoice)}
                    </td>
                    <td className="px-4 sm:px-6 py-4">{invoiceAmount(invoice)}</td>
                    <td className="px-4 sm:px-6 py-4">
                      <StatusBadge status={invoice.status} />
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-right">
                      <Dropdown
                        align="right"
                        side="top"
                        portal
                        trigger={
                          <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors inline-flex">
                            <MoreHorizontal size={16} />
                          </button>
                        }
                      >
                        <DropdownItem
                          onClick={() => {
                            const url = invoice.invoicePdfUrl ?? invoice.hostedInvoiceUrl;
                            if (!url) {
                              toast("No downloadable receipt is available for this invoice.", "info");
                              return;
                            }
                            openExternal(url);
                          }}
                        >
                          Download PDF
                        </DropdownItem>
                        <DropdownItem
                          onClick={() => {
                            const url = invoice.hostedInvoiceUrl ?? invoice.invoicePdfUrl;
                            if (!url) {
                              toast("No hosted invoice URL is available.", "info");
                              return;
                            }
                            openExternal(url);
                          }}
                        >
                          View Details
                        </DropdownItem>
                      </Dropdown>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Sub-components
interface StatusBadgeProps {
  status: BillingInvoiceStatus;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = status.toLowerCase();
  const isPaid = normalized === "paid";
  const isPending = normalized === "open" || normalized === "draft";
  const isFailed = normalized === "uncollectible" || normalized === "void";

  const statusClass = isPaid
    ? "text-nirex-success bg-nirex-success/10 border-nirex-success/20"
    : isPending
      ? "text-nirex-warning bg-nirex-warning/10 border-nirex-warning/20"
      : isFailed
        ? "text-nirex-error bg-nirex-error/10 border-nirex-error/20"
        : "text-muted-foreground bg-muted/40 border-border";

  const label = capitalize(status.replace(/_/g, " "));

  return (
    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium w-fit border ${statusClass}`}>
      <CheckCircle2 size={12} /> {label}
    </span>
  );
}
