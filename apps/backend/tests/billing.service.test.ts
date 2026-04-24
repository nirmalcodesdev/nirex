import { describe, expect, it, vi, afterEach } from 'vitest';
import { BillingService } from '../src/modules/billing/billing.service.js';
import { billingRepository } from '../src/modules/billing/billing.repository.js';
import * as stripeModule from '../src/modules/billing/billing.stripe.js';

describe('billing service', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws when strict invoice sync cannot resolve billing customer mapping', async () => {
    const service = new BillingService();

    vi.spyOn(billingRepository, 'findCustomerByStripeCustomerId').mockResolvedValue(null);
    vi.spyOn(stripeModule, 'isStripeConfigured').mockReturnValue(true);
    vi.spyOn(stripeModule, 'getStripeClient').mockReturnValue({
      customers: {
        retrieve: vi.fn().mockResolvedValue({
          id: 'cus_test',
          deleted: false,
          metadata: {},
        }),
      },
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({
          id: 'sub_test',
          metadata: {},
        }),
      },
    } as never);

    const invoice = {
      id: 'in_test',
      customer: 'cus_test',
      lines: { data: [{ period: { start: 1704067200, end: 1706745600 } }] },
      status_transitions: { paid_at: null },
      due_date: null,
      parent: { subscription_details: { subscription: 'sub_test' } },
      total_taxes: [],
      number: 'INV-001',
      status: 'open',
      currency: 'usd',
      subtotal: 1000,
      total: 1000,
      amount_due: 1000,
      amount_paid: 0,
      amount_remaining: 1000,
      hosted_invoice_url: null,
      invoice_pdf: null,
      created: 1704067200,
    } as any;

    await expect(
      (service as any).syncInvoiceFromStripe(invoice, { strictCustomerMapping: true }),
    ).rejects.toMatchObject({
      code: 'BILLING_CUSTOMER_MAPPING_NOT_FOUND',
      statusCode: 409,
    });
  });
});
