import { describe, expect, it } from 'vitest';
import request from 'supertest';
import type { BillingSubscriptionStatus } from '@nirex/shared';
import app from '../src/app.js';
import { Money } from '../src/modules/billing/domain/money.js';
import {
  allowedSubscriptionTransitions,
  assertSubscriptionTransition,
  canTransitionSubscription,
} from '../src/modules/billing/domain/subscription-state-machine.js';

describe('billing routes', () => {
  it('requires authentication for billing overview', async () => {
    const response = await request(app).get('/api/v1/billing/overview');

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      status: 'fail',
      code: 'UNAUTHENTICATED',
    });
  });

  it('requires authentication for subscription cancellation', async () => {
    const response = await request(app)
      .post('/api/v1/billing/subscription/cancel')
      .send({ atPeriodEnd: true });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      status: 'fail',
      code: 'UNAUTHENTICATED',
    });
  });

  it('requires authentication for subscription resume', async () => {
    const response = await request(app).post('/api/v1/billing/subscription/resume');

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      status: 'fail',
      code: 'UNAUTHENTICATED',
    });
  });

  it('requires authentication for auto-renewal updates', async () => {
    const response = await request(app)
      .patch('/api/v1/billing/subscription/auto-renewal')
      .send({ enabled: false });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      status: 'fail',
      code: 'UNAUTHENTICATED',
    });
  });

  it('fails webhook processing when billing is not configured', async () => {
    const response = await request(app)
      .post('/api/v1/billing/webhooks/stripe')
      .set('Stripe-Signature', 't=1,v1=invalid')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ id: 'evt_test', type: 'invoice.paid' }));

    expect([400, 401, 503]).toContain(response.status);
    expect(response.body).toMatchObject({
      status: response.status === 503 ? 'error' : 'fail',
    });
    expect(['BILLING_NOT_CONFIGURED', 'INVALID_STRIPE_SIGNATURE', 'WEBHOOK_SIGNATURE_INVALID']).toContain(
      response.body.code,
    );
  });

  it('requires raw json body for stripe webhook signature verification', async () => {
    const response = await request(app)
      .post('/api/v1/billing/webhooks/stripe')
      .set('Stripe-Signature', 't=1,v1=invalid')
      .set('Content-Type', 'text/plain')
      .send('hello');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      status: 'fail',
      code: 'INVALID_STRIPE_WEBHOOK_BODY',
    });
  });
});

describe('billing domain primitives', () => {
  it('uses integer money and rejects unsafe arithmetic', () => {
    expect(Money.of(1200, 'USD').add(Money.of(300, 'usd')).toJSON()).toEqual({
      amountMinor: 1500,
      currency: 'usd',
    });
    expect(Money.of(1000, 'usd').prorate(1, 3).amountMinor).toBe(333);
    expect(() => Money.of(10.5, 'usd')).toThrow('Money amounts must be integers');
    expect(() => Money.of(100, 'usd').add(Money.of(100, 'eur'))).toThrow('Currency mismatch');
  });

  it('allows only explicit subscription state transitions', () => {
    const states: Array<Exclude<BillingSubscriptionStatus, 'NONE'>> = [
      'TRIALING',
      'ACTIVE',
      'PAST_DUE',
      'UNPAID',
      'PAUSED',
      'CANCELED',
    ];

    for (const from of states) {
      for (const to of states) {
        const allowed = allowedSubscriptionTransitions(from).includes(to);
        expect(canTransitionSubscription(from, to)).toBe(allowed);
        if (allowed) {
          expect(() => assertSubscriptionTransition(from, to)).not.toThrow();
        } else {
          expect(() => assertSubscriptionTransition(from, to)).toThrow('requested state');
        }
      }
    }

    expect(allowedSubscriptionTransitions('CANCELED')).toEqual([]);
  });
});
