# Billing Test Coverage Report

Generated for this implementation pass.

## Commands Run
- `pnpm --filter @nirex/backend check-types` - passed.
- `pnpm --filter @nirex/backend test -- tests/billing.routes.test.ts tests/billing.service.test.ts` - billing-focused tests passed, 2 files and 16 tests.
- `pnpm --filter @nirex/backend test -- tests/billing.routes.test.ts tests/billing.service.test.ts tests/usage.service.test.ts tests/usage.routes.test.ts tests/dashboard.routes.test.ts tests/dashboard.service.test.ts` - available files ran and passed; this repo currently has route tests for usage/dashboard.
- `pnpm --filter @nirex/backend test` - full backend suite passed, 5 files and 19 tests.
- `pnpm --filter @nirex/frontend build` - passed.
- `pnpm --filter @nirex/backend test:coverage` - blocked by toolchain mismatch: `@vitest/coverage-v8@4.1.4` imports `BaseCoverageProvider` from `vitest/node`, but installed `vitest@2.1.9` does not export it.

## Coverage By Billing Area
- Money utility: arithmetic, integer rejection, currency mismatch, proration.
- State machine: all valid transitions and all invalid transitions across configured states.
- Billing service: cancellation, resume, portal session, no-subscription and no-customer failure branches.
- Billing routes: auth guard, cancel/resume auth guard, webhook raw body and signature failure behavior.

## Coverage Percentages
Coverage percentages could not be generated until the Vitest coverage provider version is aligned with the installed Vitest version. No percentage values are reported from a failed coverage run.

## Remaining Gaps
- Gateway adapter network retry branches are not fully unit-covered.
- Webhook domain handlers need provider-event fixture coverage for each Stripe event type.
- Dunning/reconciliation service simulations need database-backed integration tests.
- Frontend billing page currently relies on production build type checking; component and E2E tests are not present in this repo.
