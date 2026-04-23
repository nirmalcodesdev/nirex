import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('billing routes', () => {
  it('requires authentication for billing overview', async () => {
    const response = await request(app).get('/api/billing/overview');

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      status: 'fail',
      code: 'UNAUTHENTICATED',
    });
  });

  it('fails webhook processing when billing is not configured', async () => {
    const response = await request(app)
      .post('/api/billing/webhooks/stripe')
      .set('Stripe-Signature', 't=1,v1=invalid')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ id: 'evt_test', type: 'invoice.paid' }));

    expect([400, 503]).toContain(response.status);
    expect(response.body).toMatchObject({
      status: response.status === 503 ? 'error' : 'fail',
    });
    expect(['BILLING_NOT_CONFIGURED', 'INVALID_STRIPE_SIGNATURE']).toContain(
      response.body.code,
    );
  });

  it('requires raw json body for stripe webhook signature verification', async () => {
    const response = await request(app)
      .post('/api/billing/webhooks/stripe')
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
