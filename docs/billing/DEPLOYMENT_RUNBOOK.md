# Billing Deployment Runbook

## Pre-Deploy
- Configure Stripe keys, webhook secret, price ids, billing admin user ids, and dunning schedule.
- Confirm frontend uses `/billing/checkout-sessions` and the hosted billing portal flow.
- Keep new billing behind the existing rollout mechanism or environment-level enablement until Stripe webhooks are verified.

## Migration Strategy
1. Expand: deploy additive Mongo collections/indexes from the new Mongoose models. Existing code can coexist because legacy collection names are not removed by this change.
2. Backfill: migrate legacy billing customer/subscription/invoice documents into the new canonical shapes with an idempotent script before enabling writes.
3. Dual-read verification: compare `/billing/overview` output with legacy dashboard expectations for internal users.
4. Cut over: enable webhook destination `/api/v1/billing/webhooks/stripe`, run reconciliation, then enable billing UI.
5. Contract: remove legacy aliases and stale data only after at least one full billing cycle.

## Smoke Tests
- Authenticated user loads `/billing/overview`.
- User starts hosted checkout and returns with `?checkout=success`.
- Stripe sends a signed webhook and one replay; replay must return `200` without duplicate writes.
- Admin loads reconciliation report.
- Past-due subscription retry path creates a payment/audit record.

## Rollback
- Disable new billing UI route or feature flag.
- Restore previous webhook destination in Stripe.
- Keep additive collections in place; no destructive rollback is required.
- If code rollback is required, deploy prior backend/frontend version and leave new collections dormant.
