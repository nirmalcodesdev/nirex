import type { BillingSubscriptionStatus } from "@nirex/shared";

type BillingStatusLike = BillingSubscriptionStatus | string | null | undefined;

interface BillingLifecycleInput {
  status?: BillingStatusLike;
  cancelAtPeriodEnd?: boolean | null | undefined;
  currentPeriodEnd?: string | null | undefined;
  trialEnd?: string | null | undefined;
}

interface CreditPeriodNoticeInput extends BillingLifecycleInput {
  nextCreditResetAt?: string | null | undefined;
  creditsExpireAt?: string | null | undefined;
}

interface BillingDateKpiInput extends BillingLifecycleInput {
  nextBillingDate?: string | null | undefined;
}

const SAME_INSTANT_TOLERANCE_MS = 60_000;

function normalizedStatus(status: BillingStatusLike): string {
  return String(status ?? "").toUpperCase();
}

function timestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function sameInstant(left: string | null | undefined, right: string | null | undefined): boolean {
  const leftTime = timestamp(left);
  const rightTime = timestamp(right);
  if (leftTime === null || rightTime === null) return false;
  return Math.abs(leftTime - rightTime) <= SAME_INSTANT_TOLERANCE_MS;
}

function isTrialBoundary(input: BillingLifecycleInput, boundary: string | null | undefined): boolean {
  if (normalizedStatus(input.status) !== "TRIALING") return false;
  return sameInstant(boundary, input.trialEnd) || sameInstant(boundary, input.currentPeriodEnd);
}

function isScheduledEndBoundary(input: BillingLifecycleInput, boundary: string | null | undefined): boolean {
  return Boolean(input.cancelAtPeriodEnd) && sameInstant(boundary, input.currentPeriodEnd);
}

function isRenewalBoundary(input: BillingLifecycleInput, boundary: string | null | undefined): boolean {
  if (isTrialBoundary(input, boundary) || isScheduledEndBoundary(input, boundary)) return false;
  return sameInstant(boundary, input.currentPeriodEnd);
}

export function getCreditPeriodDateLabel(input: CreditPeriodNoticeInput): string {
  const boundary = input.nextCreditResetAt ?? input.creditsExpireAt;

  if (isTrialBoundary(input, boundary)) return "Trial credits expire";
  if (isScheduledEndBoundary(input, boundary)) return "Plan credits expire";
  if (isRenewalBoundary(input, boundary)) return "Credits renew";
  return "Next credit reset";
}

export function getCreditPeriodNotice(
  input: CreditPeriodNoticeInput,
  formatDate: (value: string | null | undefined) => string,
): string | null {
  const resetAt = input.nextCreditResetAt;
  const expireAt = input.creditsExpireAt ?? input.nextCreditResetAt;
  const boundary = resetAt ?? expireAt;

  if (!boundary) return null;

  if (isTrialBoundary(input, boundary)) {
    return `Trial credits expire on ${formatDate(expireAt)}. A new credit period starts only if the subscription continues.`;
  }

  if (isScheduledEndBoundary(input, boundary)) {
    return `Plan access and unused credits expire on ${formatDate(expireAt)}.`;
  }

  if (resetAt && isRenewalBoundary(input, resetAt)) {
    return `Credits renew with your subscription on ${formatDate(resetAt)}. Unused credits expire then.`;
  }

  if (resetAt) {
    return `Credits reset ${formatDate(resetAt)}. Unused credits expire at reset.`;
  }

  return `Unused credits expire on ${formatDate(expireAt)}.`;
}

export function getCreditUsageFootnote(
  input: CreditPeriodNoticeInput & { usagePct: number },
  formatDate: (value: string | null | undefined) => string,
): string {
  const pct = input.usagePct.toFixed(1);
  const boundary = input.nextCreditResetAt ?? input.creditsExpireAt;

  if (isTrialBoundary(input, boundary)) {
    return `${pct}% of plan credits consumed. Unused trial credits expire on ${formatDate(input.creditsExpireAt ?? boundary)}.`;
  }

  if (isScheduledEndBoundary(input, boundary)) {
    return `${pct}% of plan credits consumed. Unused credits expire when plan access ends.`;
  }

  if (isRenewalBoundary(input, boundary)) {
    return `${pct}% of plan credits consumed. Unused credits expire when the subscription renews.`;
  }

  return `${pct}% of plan credits consumed. Unused credits expire at reset.`;
}

export function getBillingDateKpi(
  input: BillingDateKpiInput,
  formatDate: (value: string | null | undefined) => string,
): { title: string; value: string; context: string } {
  const status = normalizedStatus(input.status);
  const date = input.trialEnd ?? input.currentPeriodEnd ?? input.nextBillingDate;

  if (status === "TRIALING") {
    return { title: "Trial Ends", value: formatDate(date), context: "trial period" };
  }

  if (input.cancelAtPeriodEnd) {
    return { title: "Plan Ends", value: formatDate(input.currentPeriodEnd ?? input.nextBillingDate), context: "scheduled" };
  }

  if (status === "CANCELED") {
    return { title: "Plan Ended", value: formatDate(input.currentPeriodEnd ?? input.nextBillingDate), context: "canceled" };
  }

  if (status === "NONE") {
    return { title: "Next Renewal", value: "N/A", context: "no subscription" };
  }

  return { title: "Next Renewal", value: formatDate(input.nextBillingDate ?? input.currentPeriodEnd), context: "scheduled" };
}

export function getSubscriptionStatusDetail(
  input: BillingDateKpiInput,
  formatDate: (value: string) => string,
): string {
  const status = normalizedStatus(input.status);
  const trialEnd = input.trialEnd ?? input.currentPeriodEnd ?? input.nextBillingDate;
  const periodEnd = input.currentPeriodEnd ?? input.nextBillingDate;

  if (status === "CANCELED") return "Subscription ended";
  if (status === "NONE") return "No active subscription";
  if (status === "TRIALING" && trialEnd) return `Trial ends ${formatDate(trialEnd)}`;
  if (input.cancelAtPeriodEnd && periodEnd) return `Plan ends ${formatDate(periodEnd)}`;
  if (periodEnd) return `Next billing ${formatDate(periodEnd)}`;
  return "No next billing date";
}
