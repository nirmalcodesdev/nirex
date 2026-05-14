import { AppError } from '../../types/index.js';
import type { JsonObject } from '@nirex/shared';

export class BillingError extends AppError {
  readonly metadata: JsonObject;
  readonly internalMessage: string;

  constructor(
    code: string,
    statusCode: number,
    userMessage: string,
    internalMessage: string = userMessage,
    metadata: JsonObject = {},
  ) {
    super(userMessage, statusCode, code);
    this.name = new.target.name;
    this.metadata = metadata;
    this.internalMessage = internalMessage;
  }
}

export class PaymentDeclinedError extends BillingError {
  constructor(internalMessage = 'Payment was declined.', metadata: JsonObject = {}) {
    super('PAYMENT_DECLINED', 402, 'The payment was declined.', internalMessage, metadata);
  }
}

export class PaymentRequiresActionError extends BillingError {
  constructor(internalMessage = 'Payment requires additional action.', metadata: JsonObject = {}) {
    super('PAYMENT_REQUIRES_ACTION', 402, 'The payment requires additional authentication.', internalMessage, metadata);
  }
}

export class InsufficientFundsError extends BillingError {
  constructor(internalMessage = 'Insufficient funds.', metadata: JsonObject = {}) {
    super('INSUFFICIENT_FUNDS', 402, 'The payment method has insufficient funds.', internalMessage, metadata);
  }
}

export class InvalidPaymentMethodError extends BillingError {
  constructor(internalMessage = 'Invalid payment method.', metadata: JsonObject = {}) {
    super('INVALID_PAYMENT_METHOD', 422, 'The payment method is invalid.', internalMessage, metadata);
  }
}

export class GatewayTimeoutError extends BillingError {
  constructor(internalMessage = 'Payment gateway timed out.', metadata: JsonObject = {}) {
    super('GATEWAY_TIMEOUT', 504, 'The payment gateway timed out. Please try again.', internalMessage, metadata);
  }
}

export class GatewayRateLimitError extends BillingError {
  constructor(internalMessage = 'Payment gateway rate limit exceeded.', metadata: JsonObject = {}) {
    super('GATEWAY_RATE_LIMIT', 429, 'The payment gateway is busy. Please try again shortly.', internalMessage, metadata);
  }
}

export class GatewayUnavailableError extends BillingError {
  constructor(internalMessage = 'Payment gateway unavailable.', metadata: JsonObject = {}) {
    super('GATEWAY_UNAVAILABLE', 503, 'The payment gateway is temporarily unavailable.', internalMessage, metadata);
  }
}

export class WebhookSignatureError extends BillingError {
  constructor(internalMessage = 'Webhook signature verification failed.', metadata: JsonObject = {}) {
    super('WEBHOOK_SIGNATURE_INVALID', 401, 'Webhook signature verification failed.', internalMessage, metadata);
  }
}

export class IdempotencyConflictError extends BillingError {
  constructor(internalMessage = 'Idempotency key is already in progress.', metadata: JsonObject = {}) {
    super('IDEMPOTENCY_CONFLICT', 409, 'This billing operation is already in progress.', internalMessage, metadata);
  }
}

export class SubscriptionStateError extends BillingError {
  constructor(internalMessage = 'Invalid subscription state transition.', metadata: JsonObject = {}) {
    super('SUBSCRIPTION_STATE_INVALID', 409, 'The subscription cannot move to the requested state.', internalMessage, metadata);
  }
}

export class BillingAuthorizationError extends BillingError {
  constructor(internalMessage = 'Billing ownership check failed.', metadata: JsonObject = {}) {
    super('BILLING_AUTHORIZATION_DENIED', 403, 'You do not have access to this billing resource.', internalMessage, metadata);
  }
}

export class ReconciliationError extends BillingError {
  constructor(internalMessage = 'Billing reconciliation discrepancy detected.', metadata: JsonObject = {}) {
    super('RECONCILIATION_DISCREPANCY', 409, 'A billing reconciliation discrepancy was detected.', internalMessage, metadata);
  }
}
