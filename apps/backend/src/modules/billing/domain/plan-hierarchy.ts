import type { BillingPlanId } from '@nirex/shared';

const PLAN_TIER: Record<string, number> = {
  free: 0,
  go: 1,
  pro: 2,
  plus: 3,
  max: 4,
  enterprise: 5,
  custom: 5,
};

export type PlanChangeType = 'upgrade' | 'downgrade' | 'same';

export function getPlanTier(planId: BillingPlanId): number {
  return PLAN_TIER[planId] ?? 0;
}

export function classifyPlanChange(
  fromPlanId: BillingPlanId,
  toPlanId: BillingPlanId
): PlanChangeType {
  const fromTier = getPlanTier(fromPlanId);
  const toTier = getPlanTier(toPlanId);

  if (toTier > fromTier) return 'upgrade';
  if (toTier < fromTier) return 'downgrade';
  return 'same';
}

export function isUpgrade(fromPlanId: BillingPlanId, toPlanId: BillingPlanId): boolean {
  return classifyPlanChange(fromPlanId, toPlanId) === 'upgrade';
}

export function isDowngrade(fromPlanId: BillingPlanId, toPlanId: BillingPlanId): boolean {
  return classifyPlanChange(fromPlanId, toPlanId) === 'downgrade';
}
