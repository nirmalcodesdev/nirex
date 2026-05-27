import type { BillingSubscriptionStatus } from '@nirex/shared';
import { SubscriptionStateError } from '../billing.errors.js';

export type SubscriptionTransitionTrigger =
  | 'WEBHOOK'
  | 'ADMIN_ACTION'
  | 'DUNNING_JOB'
  | 'USER_ACTION'
  | 'TRIAL_EXPIRY_JOB'
  | 'PAYMENT_RETRY'
  | 'MANUAL_PAYMENT';

export interface SubscriptionTransition {
  from: Exclude<BillingSubscriptionStatus, 'NONE'>;
  to: Exclude<BillingSubscriptionStatus, 'NONE'>;
  trigger: SubscriptionTransitionTrigger;
}

type ActiveSubscriptionState = Exclude<BillingSubscriptionStatus, 'NONE'>;

const transitionMap: Record<ActiveSubscriptionState, ActiveSubscriptionState[]> = {
  TRIALING: ['ACTIVE', 'PAST_DUE', 'CANCELED'],
  ACTIVE: ['PAST_DUE', 'CANCELED', 'PAUSED'],
  PAST_DUE: ['ACTIVE', 'UNPAID', 'CANCELED'],
  UNPAID: ['ACTIVE', 'CANCELED'],
  PAUSED: ['ACTIVE', 'CANCELED'],
  CANCELED: ['ACTIVE', 'TRIALING'],
};

export function allowedSubscriptionTransitions(
  from: ActiveSubscriptionState,
): ActiveSubscriptionState[] {
  return transitionMap[from];
}

export function assertSubscriptionTransition(
  from: ActiveSubscriptionState,
  to: ActiveSubscriptionState,
): SubscriptionTransition {
  if (!transitionMap[from].includes(to)) {
    throw new SubscriptionStateError(`Invalid subscription transition ${from} -> ${to}.`, {
      from,
      to,
    });
  }

  return {
    from,
    to,
    trigger: 'USER_ACTION',
  };
}

export function canTransitionSubscription(
  from: ActiveSubscriptionState,
  to: ActiveSubscriptionState,
): boolean {
  return transitionMap[from].includes(to);
}
