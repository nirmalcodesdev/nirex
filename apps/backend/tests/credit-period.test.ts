import { describe, expect, it } from 'vitest';
import {
  creditPeriodUsageRangeEnd,
  resolveMonthlyCreditPeriod,
} from '../src/modules/billing/domain/credit-period.js';

function iso(date: Date): string {
  return date.toISOString();
}

describe('credit period resolution', () => {
  it('anchors yearly subscription credits to the purchase-day anniversary', () => {
    const period = resolveMonthlyCreditPeriod({
      now: new Date('2026-06-18T12:00:00.000Z'),
      billingCycle: 'year',
      subscriptionPeriodStart: new Date('2026-05-17T09:30:00.000Z'),
      subscriptionPeriodEnd: new Date('2027-05-17T09:30:00.000Z'),
    });

    expect(iso(period.periodStart)).toBe('2026-06-17T09:30:00.000Z');
    expect(iso(period.periodEndExclusive)).toBe('2026-07-17T09:30:00.000Z');
    expect(iso(period.nextCreditResetAt)).toBe('2026-07-17T09:30:00.000Z');
    expect(iso(period.creditsExpireAt)).toBe('2026-07-17T09:30:00.000Z');
  });

  it('uses the provider subscription period for monthly subscriptions', () => {
    const period = resolveMonthlyCreditPeriod({
      now: new Date('2026-06-18T12:00:00.000Z'),
      billingCycle: 'month',
      subscriptionPeriodStart: new Date('2026-06-10T14:15:00.000Z'),
      subscriptionPeriodEnd: new Date('2026-07-10T14:15:00.000Z'),
    });

    expect(iso(period.periodStart)).toBe('2026-06-10T14:15:00.000Z');
    expect(iso(period.periodEndExclusive)).toBe('2026-07-10T14:15:00.000Z');
  });

  it('clamps purchase days that do not exist in shorter months', () => {
    const firstPeriod = resolveMonthlyCreditPeriod({
      now: new Date('2026-02-20T12:00:00.000Z'),
      billingCycle: 'year',
      subscriptionPeriodStart: new Date('2026-01-31T10:00:00.000Z'),
      subscriptionPeriodEnd: new Date('2027-01-31T10:00:00.000Z'),
    });
    const nextPeriod = resolveMonthlyCreditPeriod({
      now: new Date('2026-03-01T12:00:00.000Z'),
      billingCycle: 'year',
      subscriptionPeriodStart: new Date('2026-01-31T10:00:00.000Z'),
      subscriptionPeriodEnd: new Date('2027-01-31T10:00:00.000Z'),
    });

    expect(iso(firstPeriod.periodStart)).toBe('2026-01-31T10:00:00.000Z');
    expect(iso(firstPeriod.periodEndExclusive)).toBe('2026-02-28T10:00:00.000Z');
    expect(iso(nextPeriod.periodStart)).toBe('2026-02-28T10:00:00.000Z');
    expect(iso(nextPeriod.periodEndExclusive)).toBe('2026-03-31T10:00:00.000Z');
  });

  it('never counts usage after the credit expiration boundary', () => {
    const period = resolveMonthlyCreditPeriod({
      now: new Date('2026-07-17T08:00:00.000Z'),
      billingCycle: 'year',
      subscriptionPeriodStart: new Date('2026-05-17T09:30:00.000Z'),
      subscriptionPeriodEnd: new Date('2027-05-17T09:30:00.000Z'),
    });

    expect(iso(creditPeriodUsageRangeEnd(period, new Date('2026-07-30T23:59:59.999Z'))))
      .toBe('2026-07-17T09:29:59.999Z');
  });
});
