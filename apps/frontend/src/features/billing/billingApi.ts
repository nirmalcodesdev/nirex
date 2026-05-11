import type {
  BillingInvoiceItem,
  BillingInvoicesQuery,
  BillingOverviewResponse,
  CancelSubscriptionRequest,
  CancelSubscriptionResponse,
  CreateCheckoutSessionRequest,
  CreateCheckoutSessionResponse,
  CreatePortalSessionRequest,
  CreatePortalSessionResponse,
  ResumeSubscriptionResponse,
} from "@nirex/shared";
import { dataOrThrow, request } from "../../lib/backendApi";

const BILLING_BASE = "/billing";

function buildInvoicesPath(query: BillingInvoicesQuery): string {
  const params = new URLSearchParams();

  if (query.limit !== undefined) {
    params.set("limit", String(query.limit));
  }

  const search = params.toString();
  return search ? `${BILLING_BASE}/invoices?${search}` : `${BILLING_BASE}/invoices`;
}

export const billingApi = {
  async getOverview(options?: { force?: boolean }): Promise<BillingOverviewResponse> {
    const url = options?.force ? `${BILLING_BASE}/overview?force=true` : `${BILLING_BASE}/overview`;
    const payload = await request<BillingOverviewResponse>(url, {
      method: "GET",
    });

    return dataOrThrow(payload, "BILLING_OVERVIEW_FAILED");
  },

  async listInvoices(query: BillingInvoicesQuery = {}): Promise<BillingInvoiceItem[]> {
    const payload = await request<BillingInvoiceItem[]>(buildInvoicesPath(query), {
      method: "GET",
    });

    return dataOrThrow(payload, "BILLING_INVOICES_FAILED");
  },

  async createCheckoutSession(
    body: CreateCheckoutSessionRequest,
  ): Promise<CreateCheckoutSessionResponse> {
    const payload = await request<CreateCheckoutSessionResponse>(
      `${BILLING_BASE}/checkout-session`,
      {
        method: "POST",
        body,
      },
    );

    return dataOrThrow(payload, "BILLING_CHECKOUT_SESSION_FAILED");
  },
};
