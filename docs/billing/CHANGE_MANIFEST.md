# Billing Replacement Change Manifest

## Created
- `apps/backend/src/modules/billing/billing.errors.ts` - typed billing error hierarchy.
- `apps/backend/src/modules/billing/billing.guard.ts` - owner/admin guards and raw card data rejection middleware.
- `apps/backend/src/modules/billing/billing.metrics.ts` - billing metrics facade over the existing logger.
- `apps/backend/src/modules/billing/domain/money.ts` - integer minor-unit money value object.
- `apps/backend/src/modules/billing/domain/subscription-state-machine.ts` - explicit subscription FSM.
- `apps/backend/src/modules/billing/payment-gateway.port.ts` - provider-agnostic gateway port.

## Modified
- `apps/backend/src/config/env.ts` - billing admin, gateway retry/timeout, mutation limit, dunning, and pause feature config.
- `apps/backend/src/middleware/rateLimiter.ts` - billing mutation/admin rate limiters.
- `apps/backend/src/modules/billing/*` - replaced Stripe-coupled billing implementation with domain models, repository, services, routes, controller, gateway adapter, and shared contracts.
- `apps/backend/src/modules/usage/usage.service.ts` - switched usage plan resolution from removed entitlement records to new subscription state.
- `apps/backend/tests/billing.routes.test.ts` and `apps/backend/tests/billing.service.test.ts` - updated to new webhook/signature, gateway-port behavior, money, and FSM coverage.
- `apps/frontend/src/features/billing/*` - rebuilt billing API client and React Query hooks.
- `apps/frontend/src/pages/main/billing/Billing.tsx` - replaced billing UI with overview, plans, payment methods, invoices, and admin sections.
- `apps/frontend/src/components/sections/landingpage/{Hero,FinalCTA,Pricing}.tsx` - fixed named `MagneticButton` import.
- `packages/shared/src/domain/billing/*` and `packages/shared/src/index.ts` - expanded shared billing types, schemas, and catalog fields.

## Deleted
- Old backend-local billing type fork content in `apps/backend/src/modules/billing/billing.types.ts`.
- Old Stripe-coupled service/controller/routes/adapter implementations were replaced in place.

## Intentional Compatibility
- `POST /billing/checkout-session` remains as an alias to `POST /billing/checkout-sessions` for existing frontend callers during rollout.
