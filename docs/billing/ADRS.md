# Billing Architecture Decision Records

## ADR 1: Integer Minor-Unit Money
- Context: Financial records must avoid floating-point drift.
- Decision: Store and calculate amounts as integer minor units plus ISO currency code.
- Rationale: Matches payment provider semantics and makes arithmetic deterministic.
- Consequences: UI formats with `Intl.NumberFormat`; compatibility cent aliases remain read-only in shared response types.

## ADR 2: Explicit Subscription FSM
- Context: The old implementation relied on provider strings and ad-hoc transitions.
- Decision: Centralize transitions in `subscription-state-machine.ts`.
- Rationale: Invalid lifecycle moves throw typed domain errors and can be audited atomically.
- Consequences: Provider statuses are normalized before entering domain state.

## ADR 3: Provider Port With Stripe Adapter
- Context: Business logic directly imported Stripe.
- Decision: Introduce `PaymentGatewayPort`; Stripe is confined to `billing.stripe.ts`.
- Rationale: Gateway migration or mock testing no longer touches billing use-case logic.
- Consequences: Checkout/portal helpers are adapter extensions because the product already uses Stripe-hosted flows.

## ADR 4: Webhook Ingestion Is Stored Before Processing
- Context: Inline webhook processing can timeout and replay unpredictably.
- Decision: Verify signature, persist raw event with idempotency key, then process asynchronously via background microtask in this repo's current runtime.
- Rationale: The codebase has no queue abstraction yet; persisted status supports retry jobs without changing the HTTP contract later.
- Consequences: A production queue worker should replace the microtask runner when the app adds a queue.

## ADR 5: Mongo ObjectIds Instead Of UUIDv7
- Context: The codebase uses Mongoose/ObjectId everywhere and has no migration tool.
- Decision: Keep ObjectId primary keys for billing collections.
- Rationale: Consistency with existing repositories, tests, and route validation matters more than introducing a second id strategy.
- Consequences: Time ordering is still available from ObjectId; UUIDv7 can be revisited in a platform-wide id migration.
