# Billing API Reference

All endpoints are under `/api/v1/billing` unless noted. Authenticated endpoints accept session auth or API keys with `billing:read`/`billing:write` as enforced in routes.

## User Endpoints
- `GET /overview` - authenticated read; returns `BillingOverviewResponse`.
- `GET /plans` - authenticated read; returns `BillingPlan[]`.
- `GET /payment-methods` - authenticated read; returns `BillingPaymentMethod[]`.
- `GET /invoices?limit&cursor&status` - authenticated read; returns `BillingInvoicesResponse`.
- `GET /invoices/:invoiceId/pdf` - owner-guarded read; returns `{ downloadUrl }`.
- `GET /proration-preview?planId&billingCycle&couponCode` - authenticated read; returns proration money amounts.
- `POST /checkout-sessions` - authenticated `billing:write`; creates hosted checkout session.
- `POST /checkout-session` - compatibility alias for checkout session creation.
- `POST /portal-sessions` - authenticated `billing:write`; creates hosted billing portal session.
- `POST /payment-methods` - authenticated `billing:write`; accepts provider token only, never raw card data.
- `DELETE /payment-methods/:paymentMethodId` - owner-guarded mutation; detaches method.
- `PATCH /payment-methods/:paymentMethodId/default` - owner-guarded mutation; sets default method.
- `POST /subscription/change-plan` - authenticated mutation; request `ChangePlanRequest`.
- `POST /subscription/cancel` - authenticated mutation; request `CancelSubscriptionRequest`.
- `PATCH /subscription/auto-renewal` - authenticated mutation; request `UpdateAutoRenewalRequest`.
- `POST /subscription/auto-renewal` - compatibility alias for auto-renewal updates.
- `POST /subscription/pause` - authenticated mutation; request `PauseSubscriptionRequest`.
- `POST /subscription/resume` - authenticated mutation; request `ResumeSubscriptionRequest`.
- `POST /subscription/retry-payment` - authenticated mutation; request `RetryPaymentRequest`.
- `POST /discounts/apply` - authenticated mutation; request `ApplyDiscountRequest`.

## Webhook Endpoint
- `POST /api/v1/billing/webhooks/stripe` - public Stripe endpoint with raw body and signature verification. Duplicate event ids return `200`.

## Admin Endpoints
- `GET /admin/reconciliation/report` - admin only; returns open reconciliation alerts.
- `POST /admin/reconciliation/run` - admin only; runs diff and returns report.
- `GET /admin/customers/:customerId` - admin only; returns billing summary and audit trail.
- `POST /admin/customers/:customerId/refunds` - admin only; request `AdminRefundRequest`.
- `POST /admin/customers/:customerId/manual-charge` - admin only; request `AdminManualChargeRequest`.

## Common Error Codes
- `UNAUTHENTICATED`, `BILLING_AUTHORIZATION_DENIED`, `VALIDATION_ERROR`
- `RAW_CARD_DATA_REJECTED`, `PLAN_NOT_AVAILABLE`, `SUBSCRIPTION_NOT_FOUND`
- `WEBHOOK_SIGNATURE_INVALID`, `IDEMPOTENCY_CONFLICT`
- `GATEWAY_TIMEOUT`, `GATEWAY_RATE_LIMIT`, `GATEWAY_UNAVAILABLE`
