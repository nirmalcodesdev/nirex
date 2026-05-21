import type {
  AdminManualChargeRequest,
  AdminRefundRequest,
  ApplyDiscountRequest,
  AttachPaymentMethodRequest,
  BillingAdminCustomerSummary,
  BillingAdminReconciliationReport,
  BillingInvoicesQuery,
  BillingInvoicesResponse,
  BillingOverviewResponse,
  BillingPaymentMethod,
  BillingPlan,
  CancelSubscriptionRequest,
  CancelSubscriptionResponse,
  ChangePlanRequest,
  CreateCheckoutSessionRequest,
  CreateCheckoutSessionResponse,
  CreatePortalSessionRequest,
  CreatePortalSessionResponse,
  DownloadInvoicePdfResponse,
  PauseSubscriptionRequest,
  ProrationPreviewQuery,
  ProrationPreviewResponse,
  ResumeSubscriptionRequest,
  ResumeSubscriptionResponse,
  RetryPaymentRequest,
  BillingPayment,
  UpdateAutoRenewalRequest,
  UpdateAutoRenewalResponse,
} from "@nirex/shared";
import { dataOrThrow, request } from "../../lib/backendApi";

const BILLING_BASE = "/billing";

function buildPath(path: string, query?: Record<string, string | number | boolean | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

export const billingApi = {
  async getOverview(options?: { force?: boolean }): Promise<BillingOverviewResponse> {
    const payload = await request<BillingOverviewResponse>(
      buildPath(`${BILLING_BASE}/overview`, { force: options?.force }),
      { method: "GET" },
    );
    return dataOrThrow(payload, "BILLING_OVERVIEW_FAILED");
  },

  async listPlans(): Promise<BillingPlan[]> {
    const payload = await request<BillingPlan[]>(`${BILLING_BASE}/plans`, { method: "GET" });
    return dataOrThrow(payload, "BILLING_PLANS_FAILED");
  },

  async listInvoices(query: BillingInvoicesQuery = {}): Promise<BillingInvoicesResponse> {
    const payload = await request<BillingInvoicesResponse>(
      buildPath(`${BILLING_BASE}/invoices`, {
        limit: query.limit,
        cursor: query.cursor,
        status: query.status,
      }),
      { method: "GET" },
    );
    return dataOrThrow(payload, "BILLING_INVOICES_FAILED");
  },

  async downloadInvoicePdf(invoiceId: string): Promise<DownloadInvoicePdfResponse> {
    const payload = await request<DownloadInvoicePdfResponse>(
      `${BILLING_BASE}/invoices/${invoiceId}/pdf`,
      { method: "GET" },
    );
    return dataOrThrow(payload, "BILLING_INVOICE_PDF_FAILED");
  },

  async createCheckoutSession(body: CreateCheckoutSessionRequest): Promise<CreateCheckoutSessionResponse> {
    const payload = await request<CreateCheckoutSessionResponse>(
      `${BILLING_BASE}/checkout-sessions`,
      { method: "POST", body },
    );
    return dataOrThrow(payload, "BILLING_CHECKOUT_SESSION_FAILED");
  },

  async createPortalSession(body: CreatePortalSessionRequest = {}): Promise<CreatePortalSessionResponse> {
    const payload = await request<CreatePortalSessionResponse>(
      `${BILLING_BASE}/portal-sessions`,
      { method: "POST", body },
    );
    return dataOrThrow(payload, "BILLING_PORTAL_SESSION_FAILED");
  },

  async attachPaymentMethod(body: AttachPaymentMethodRequest): Promise<BillingPaymentMethod> {
    const payload = await request<BillingPaymentMethod>(
      `${BILLING_BASE}/payment-methods`,
      { method: "POST", body },
    );
    return dataOrThrow(payload, "BILLING_PAYMENT_METHOD_ATTACH_FAILED");
  },

  async listPaymentMethods(): Promise<BillingPaymentMethod[]> {
    const payload = await request<BillingPaymentMethod[]>(
      `${BILLING_BASE}/payment-methods`,
      { method: "GET" },
    );
    return dataOrThrow(payload, "BILLING_PAYMENT_METHODS_FAILED");
  },

  async removePaymentMethod(paymentMethodId: string): Promise<void> {
    await request<void>(`${BILLING_BASE}/payment-methods/${paymentMethodId}`, { method: "DELETE" });
  },

  async setDefaultPaymentMethod(paymentMethodId: string): Promise<BillingPaymentMethod> {
    const payload = await request<BillingPaymentMethod>(
      `${BILLING_BASE}/payment-methods/${paymentMethodId}/default`,
      { method: "PATCH" },
    );
    return dataOrThrow(payload, "BILLING_PAYMENT_METHOD_DEFAULT_FAILED");
  },

  async changePlan(body: ChangePlanRequest): Promise<CancelSubscriptionResponse> {
    const payload = await request<CancelSubscriptionResponse>(
      `${BILLING_BASE}/subscription/change-plan`,
      { method: "POST", body },
    );
    return dataOrThrow(payload, "BILLING_CHANGE_PLAN_FAILED");
  },

  async cancelSubscription(body: CancelSubscriptionRequest): Promise<CancelSubscriptionResponse> {
    const payload = await request<CancelSubscriptionResponse>(
      `${BILLING_BASE}/subscription/cancel`,
      { method: "POST", body },
    );
    return dataOrThrow(payload, "BILLING_CANCEL_FAILED");
  },

  async updateAutoRenewal(body: UpdateAutoRenewalRequest): Promise<UpdateAutoRenewalResponse> {
    const payload = await request<UpdateAutoRenewalResponse>(
      `${BILLING_BASE}/subscription/auto-renewal`,
      { method: "PATCH", body },
    );
    return dataOrThrow(payload, "BILLING_AUTO_RENEWAL_FAILED");
  },

  async pauseSubscription(body: PauseSubscriptionRequest = {}): Promise<ResumeSubscriptionResponse> {
    const payload = await request<ResumeSubscriptionResponse>(
      `${BILLING_BASE}/subscription/pause`,
      { method: "POST", body },
    );
    return dataOrThrow(payload, "BILLING_PAUSE_FAILED");
  },

  async resumeSubscription(body: ResumeSubscriptionRequest = {}): Promise<ResumeSubscriptionResponse> {
    const payload = await request<ResumeSubscriptionResponse>(
      `${BILLING_BASE}/subscription/resume`,
      { method: "POST", body },
    );
    return dataOrThrow(payload, "BILLING_RESUME_FAILED");
  },

  async retryPayment(body: RetryPaymentRequest = {}): Promise<BillingPayment> {
    const payload = await request<BillingPayment>(
      `${BILLING_BASE}/subscription/retry-payment`,
      { method: "POST", body },
    );
    return dataOrThrow(payload, "BILLING_RETRY_PAYMENT_FAILED");
  },

  async applyDiscount(body: ApplyDiscountRequest): Promise<BillingOverviewResponse> {
    const payload = await request<BillingOverviewResponse>(
      `${BILLING_BASE}/discounts/apply`,
      { method: "POST", body },
    );
    return dataOrThrow(payload, "BILLING_DISCOUNT_FAILED");
  },

  async getProrationPreview(query: ProrationPreviewQuery): Promise<ProrationPreviewResponse> {
    const payload = await request<ProrationPreviewResponse>(
      buildPath(`${BILLING_BASE}/proration-preview`, {
        planId: query.planId,
        billingCycle: query.billingCycle,
        couponCode: query.couponCode,
      }),
      { method: "GET" },
    );
    return dataOrThrow(payload, "BILLING_PRORATION_FAILED");
  },

  async getAdminCustomerSummary(customerId: string): Promise<BillingAdminCustomerSummary> {
    const payload = await request<BillingAdminCustomerSummary>(
      `${BILLING_BASE}/admin/customers/${customerId}`,
      { method: "GET" },
    );
    return dataOrThrow(payload, "BILLING_ADMIN_CUSTOMER_FAILED");
  },

  async getReconciliationReport(): Promise<BillingAdminReconciliationReport> {
    const payload = await request<BillingAdminReconciliationReport>(
      `${BILLING_BASE}/admin/reconciliation/report`,
      { method: "GET" },
    );
    return dataOrThrow(payload, "BILLING_RECONCILIATION_REPORT_FAILED");
  },

  async runReconciliation(): Promise<BillingAdminReconciliationReport> {
    const payload = await request<BillingAdminReconciliationReport>(
      `${BILLING_BASE}/admin/reconciliation/run`,
      { method: "POST" },
    );
    return dataOrThrow(payload, "BILLING_RECONCILIATION_RUN_FAILED");
  },

  async adminRefund(customerId: string, body: AdminRefundRequest): Promise<void> {
    await request<void>(`${BILLING_BASE}/admin/customers/${customerId}/refunds`, {
      method: "POST",
      body,
    });
  },

  async adminManualCharge(customerId: string, body: AdminManualChargeRequest): Promise<BillingPayment> {
    const payload = await request<BillingPayment>(
      `${BILLING_BASE}/admin/customers/${customerId}/manual-charge`,
      { method: "POST", body },
    );
    return dataOrThrow(payload, "BILLING_ADMIN_MANUAL_CHARGE_FAILED");
  },
};
