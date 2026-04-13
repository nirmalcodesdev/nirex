// Billing Page - Subscription and payment management
import {
  CreditCard,
  CheckCircle2,
  MoreHorizontal,
  DollarSign,
  Receipt,
  Calendar,
  TrendingDown,
} from "lucide-react";
import { Dropdown, DropdownItem } from "@nirex/ui";
import { PageHeader } from "@nirex/ui";
import { KpiCard } from "@nirex/ui";
import { useToast } from "../../../components/ToastProvider";
import { useSimulatedLoading } from "../../../hooks/useSimulatedLoading";
import { usePlansDialog } from "../../../hooks/usePlansDialog";
import { Skeleton, CardSkeleton } from "@nirex/ui/Skeleton";

interface InvoiceData {
  id: string;
  date: string;
  amount: string;
  status: "Paid" | "Pending" | "Failed";
}

const invoices: InvoiceData[] = [
  { id: "INV-2026-10", date: "Oct 01, 2026", amount: "$49.00", status: "Paid" },
  { id: "INV-2026-09", date: "Sep 01, 2026", amount: "$49.00", status: "Paid" },
  { id: "INV-2026-08", date: "Aug 01, 2026", amount: "$49.00", status: "Paid" },
  { id: "INV-2026-07", date: "Jul 01, 2026", amount: "$49.00", status: "Paid" },
];

const planFeatures = [
  "Unlimited local executions",
  "50,000s cloud compute",
  "Advanced analytics",
  "Priority support",
];

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
  const isLoading = useSimulatedLoading();
  const { toast } = useToast();
  const { openPlansDialog } = usePlansDialog();

  if (isLoading) {
    return <BillingSkeleton />;
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6 lg:gap-8 py-2 sm:py-4 lg:py-5 px-3 mx-auto">
      <PageHeader
        title="Billing & Plans"
        description="Manage your subscription, payment methods, and billing history."
        actions={
          <button
            onClick={openPlansDialog}
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium transition-colors shadow-sm w-fit"
          >
            Upgrade Plan
          </button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Current Plan"
          value="$49.00"
          change="Pro"
          changeType="neutral"
          icon={DollarSign}
          changeContext="per month"
        />
        <KpiCard
          title="Total Paid (YTD)"
          value="$441.00"
          change="+9.1%"
          changeType="positive"
          icon={Receipt}
          changeContext="vs last year"
        />
        <KpiCard
          title="Next Billing Date"
          value="Nov 1"
          change="28 days"
          changeType="neutral"
          icon={Calendar}
          changeContext="remaining"
        />
        <KpiCard
          title="Savings"
          value="$120"
          change="-20%"
          changeType="positive"
          icon={TrendingDown}
          changeContext="vs monthly plan"
        />
      </div>

      {/* Plan & Payment Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Current Plan */}
        <div className="md:col-span-2 bg-card border border-border rounded-xl overflow-hidden flex flex-col">
          <div className="p-5 sm:p-6 border-b border-border flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1 sm:mb-2">
                <h2 className="text-lg sm:text-xl font-medium">Pro Plan</h2>
                <span className="bg-primary text-primary-foreground text-xs font-medium px-2 py-0.5 rounded-full">
                  Active
                </span>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Billed monthly. Next charge on Nov 1, 2026.
              </p>
            </div>
            <div className="sm:text-right">
              <div className="text-2xl sm:text-3xl font-semibold tracking-tight">
                $49
                <span className="text-base sm:text-lg text-muted-foreground font-normal">
                  /mo
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
                  41.5k / 50k seconds
                </span>
              </div>
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-nirex-accent w-[83%] rounded-full"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.2) 4px, rgba(255,255,255,0.2) 8px)",
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                You have used 83% of your included compute time this month.
              </p>
            </div>

            {/* Features */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-4 border-t border-border">
              {planFeatures.map((feature) => (
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

        {/* Payment Method */}
        <div className="bg-card border border-border rounded-xl flex flex-col">
          <div className="p-5 sm:p-6 border-b border-border">
            <h2 className="text-lg font-medium">Payment Method</h2>
          </div>
          <div className="p-5 sm:p-6 flex-1 flex flex-col justify-center gap-6">
            <div className="border border-border rounded-xl p-4 flex items-center gap-4 bg-muted/20">
              <div className="w-12 h-8 bg-background border border-border rounded flex items-center justify-center shrink-0 shadow-sm">
                <CreditCard size={20} className="text-nirex-accent" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">Visa ending in 4242</div>
                <div className="text-xs text-muted-foreground">Expires 12/28</div>
              </div>
            </div>
            <button
              onClick={() => toast("Payment method update dialog opened.", "info")}
              className="text-sm font-medium text-primary hover:underline w-fit"
            >
              Update payment method
            </button>
          </div>
        </div>
      </div>

      {/* Billing History */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-lg font-medium">Billing History</h2>
          <button
            onClick={() => toast("Downloading all invoices...", "info")}
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
              {invoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  className="hover:bg-muted/30 transition-colors group"
                >
                  <td className="px-4 sm:px-6 py-4 font-medium">{invoice.id}</td>
                  <td className="px-4 sm:px-6 py-4 text-muted-foreground">
                    {invoice.date}
                  </td>
                  <td className="px-4 sm:px-6 py-4">{invoice.amount}</td>
                  <td className="px-4 sm:px-6 py-4">
                    <StatusBadge status={invoice.status} />
                  </td>
                  <td className="px-4 sm:px-6 py-4 text-right">
                    <Dropdown
                      align="right"
                      trigger={
                        <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors inline-flex">
                          <MoreHorizontal size={16} />
                        </button>
                      }
                    >
                      <DropdownItem
                        onClick={() =>
                          toast(`Downloading invoice ${invoice.id}...`, "info")
                        }
                      >
                        Download PDF
                      </DropdownItem>
                      <DropdownItem
                        onClick={() =>
                          toast(`Viewing invoice ${invoice.id}...`, "info")
                        }
                      >
                        View Details
                      </DropdownItem>
                    </Dropdown>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Sub-components
interface StatusBadgeProps {
  status: string;
}

function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className="flex items-center gap-1.5 text-nirex-success dark:text-nirex-success bg-nirex-success/10 dark:bg-nirex-success/20 px-2.5 py-1 rounded-full text-xs font-medium w-fit border border-nirex-success/20 dark:border-nirex-success/30">
      <CheckCircle2 size={12} /> {status}
    </span>
  );
}
