import type { BillingCycle } from '@nirex/shared';

export interface CreditPeriodInput {
  now: Date;
  billingCycle: BillingCycle | null;
  subscriptionPeriodStart: Date | null;
  subscriptionPeriodEnd: Date | null;
}

export interface CreditPeriod {
  periodStart: Date;
  periodEndExclusive: Date;
  nextCreditResetAt: Date;
  creditsExpireAt: Date;
  anchorDay: number | null;
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function startOfNextUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

function minDate(...dates: Date[]): Date {
  return new Date(Math.min(...dates.map((date) => date.getTime())));
}

export function addMonthsClamped(date: Date, months: number, anchorDay: number): Date {
  const next = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() + months,
      1,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
  const daysInTargetMonth = new Date(
    Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0),
  ).getUTCDate();
  next.setUTCDate(Math.min(anchorDay, daysInTargetMonth));
  return next;
}

function calendarMonthCreditPeriod(now: Date): CreditPeriod {
  const periodStart = startOfUtcMonth(now);
  const periodEndExclusive = startOfNextUtcMonth(now);

  return {
    periodStart,
    periodEndExclusive,
    nextCreditResetAt: periodEndExclusive,
    creditsExpireAt: periodEndExclusive,
    anchorDay: null,
  };
}

export function resolveMonthlyCreditPeriod(input: CreditPeriodInput): CreditPeriod {
  const {
    now,
    billingCycle,
    subscriptionPeriodStart,
    subscriptionPeriodEnd,
  } = input;

  if (
    !subscriptionPeriodStart ||
    !subscriptionPeriodEnd ||
    subscriptionPeriodEnd.getTime() <= subscriptionPeriodStart.getTime()
  ) {
    return calendarMonthCreditPeriod(now);
  }

  const anchorDay = subscriptionPeriodStart.getUTCDate();

  if (billingCycle === 'month') {
    return {
      periodStart: new Date(subscriptionPeriodStart),
      periodEndExclusive: new Date(subscriptionPeriodEnd),
      nextCreditResetAt: new Date(subscriptionPeriodEnd),
      creditsExpireAt: new Date(subscriptionPeriodEnd),
      anchorDay,
    };
  }

  if (billingCycle !== 'year') {
    return calendarMonthCreditPeriod(now);
  }

  let periodStart = new Date(subscriptionPeriodStart);
  let nextPeriodStart = addMonthsClamped(periodStart, 1, anchorDay);

  while (
    nextPeriodStart.getTime() <= now.getTime() &&
    nextPeriodStart.getTime() < subscriptionPeriodEnd.getTime()
  ) {
    periodStart = nextPeriodStart;
    nextPeriodStart = addMonthsClamped(periodStart, 1, anchorDay);
  }

  const periodEndExclusive = minDate(nextPeriodStart, subscriptionPeriodEnd);

  return {
    periodStart,
    periodEndExclusive,
    nextCreditResetAt: periodEndExclusive,
    creditsExpireAt: periodEndExclusive,
    anchorDay,
  };
}

export function creditPeriodUsageRangeEnd(period: CreditPeriod, now: Date): Date {
  const endExclusiveMs = period.periodEndExclusive.getTime();
  const lastMillisecondInPeriod = endExclusiveMs > period.periodStart.getTime()
    ? endExclusiveMs - 1
    : endExclusiveMs;

  return new Date(Math.min(lastMillisecondInPeriod, now.getTime()));
}
