import Stripe from 'stripe';
import { env } from '../../config/env.js';
import { AppError } from '../../types/index.js';

let stripeClient: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY);
}

export function getStripeClient(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new AppError(
      'Billing is not configured on the server.',
      503,
      'BILLING_NOT_CONFIGURED',
    );
  }

  if (!stripeClient) {
    stripeClient = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: env.STRIPE_API_VERSION as Stripe.LatestApiVersion,
      appInfo: {
        name: 'Nirex Backend',
        version: '1.0.0',
      },
    });
  }

  return stripeClient;
}

export function getStripeWebhookSecret(): string {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new AppError(
      'Stripe webhook secret is not configured.',
      503,
      'BILLING_NOT_CONFIGURED',
    );
  }
  return env.STRIPE_WEBHOOK_SECRET;
}
