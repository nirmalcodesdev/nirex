import { afterEach, describe, expect, it, vi } from 'vitest';
import { billingRepository } from '../src/modules/billing/billing.repository.js';
import { BillingWebhookEventModel } from '../src/modules/billing/billing.model.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('billing repository webhook claims', () => {
  it('claims a new webhook event for processing', async () => {
    vi.spyOn(BillingWebhookEventModel, 'findOneAndUpdate').mockReturnValue({
      exec: vi.fn().mockResolvedValue(null),
    } as never);
    vi.spyOn(BillingWebhookEventModel, 'create').mockResolvedValue({} as never);

    const result = await billingRepository.claimWebhookEventForProcessing(
      'evt_new',
      'invoice.paid',
      900,
    );

    expect(result).toEqual({ shouldProcess: true, duplicate: false });
  });

  it('reclaims a failed webhook event for retry', async () => {
    const findOneAndUpdateSpy = vi
      .spyOn(BillingWebhookEventModel, 'findOneAndUpdate')
      .mockReturnValue({
        exec: vi.fn().mockResolvedValue({ _id: 'reclaimed' }),
      } as never);
    const createSpy = vi.spyOn(BillingWebhookEventModel, 'create');

    const result = await billingRepository.claimWebhookEventForProcessing(
      'evt_failed',
      'invoice.payment_failed',
      900,
    );

    expect(result).toEqual({ shouldProcess: true, duplicate: false });
    expect(findOneAndUpdateSpy).toHaveBeenCalledOnce();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('returns duplicate for already processed event', async () => {
    vi.spyOn(BillingWebhookEventModel, 'findOneAndUpdate').mockReturnValueOnce({
      exec: vi.fn().mockResolvedValue(null),
    } as never);
    vi.spyOn(BillingWebhookEventModel, 'updateOne').mockReturnValue({
      exec: vi.fn().mockResolvedValue({ acknowledged: true, modifiedCount: 1 }),
    } as never);
    vi.spyOn(BillingWebhookEventModel, 'create').mockRejectedValue({
      code: 11000,
    } as never);

    const result = await billingRepository.claimWebhookEventForProcessing(
      'evt_processed',
      'invoice.paid',
      900,
    );

    expect(result).toEqual({ shouldProcess: false, duplicate: true });
  });
});
