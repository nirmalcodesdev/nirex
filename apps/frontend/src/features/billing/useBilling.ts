import type {
  ApplyDiscountRequest,
  AttachPaymentMethodRequest,
  BillingCycle,
  BillingInvoicesResponse,
  BillingOverviewResponse,
  BillingPlan,
  BillingPlanId,
  CancelSubscriptionRequest,
  ChangePlanRequest,
  CreateCheckoutSessionRequest,
  CreateCheckoutSessionResponse,
  CreatePortalSessionRequest,
  PauseSubscriptionRequest,
  ProrationPreviewQuery,
  ResumeSubscriptionRequest,
  RetryPaymentRequest,
  UpdateAutoRenewalRequest,
} from "@nirex/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { billingApi } from "./billingApi";
import { notificationsBaseQueryKey } from "../notifications/useNotifications";
import { usageBaseQueryKey } from "../usage";
import { dashboardBaseQueryKey } from "../dashboard/useDashboardOverview";

type CheckoutPlanId = Exclude<BillingPlanId, "custom">;

export const billingQueryKeys = {
  all: ["billing"] as const,
  overview: () => [...billingQueryKeys.all, "overview"] as const,
  plans: () => [...billingQueryKeys.all, "plans"] as const,
  paymentMethods: () => [...billingQueryKeys.all, "payment-methods"] as const,
  invoices: (limit: number, cursor?: string) =>
    [...billingQueryKeys.all, "invoices", limit, cursor ?? null] as const,
  proration: (query: ProrationPreviewQuery) =>
    [...billingQueryKeys.all, "proration", query.planId, query.billingCycle, query.couponCode ?? null] as const,
  reconciliation: () => [...billingQueryKeys.all, "reconciliation"] as const,
};

export const billingBaseQueryKey = billingQueryKeys.all;

export function useBillingOverviewQuery(options?: { force?: boolean }) {
  return useQuery({
    queryKey: billingQueryKeys.overview(),
    queryFn: (): Promise<BillingOverviewResponse> => billingApi.getOverview(options),
    staleTime: options?.force ? 0 : 30_000,
  });
}

export function useBillingPlansQuery() {
  return useQuery({
    queryKey: billingQueryKeys.plans(),
    queryFn: (): Promise<BillingPlan[]> => billingApi.listPlans(),
    staleTime: 300_000,
  });
}

export function useBillingInvoicesQuery(limit: number = 50, cursor?: string) {
  return useQuery({
    queryKey: billingQueryKeys.invoices(limit, cursor),
    queryFn: (): Promise<BillingInvoicesResponse> => billingApi.listInvoices({
      limit,
      ...(cursor ? { cursor } : {}),
    }),
    staleTime: 30_000,
  });
}

export function useProrationPreviewQuery(query: ProrationPreviewQuery | null) {
  return useQuery({
    queryKey: query ? billingQueryKeys.proration(query) : [...billingQueryKeys.all, "proration", "idle"],
    queryFn: () => {
      if (!query) throw new Error("Missing proration query");
      return billingApi.getProrationPreview(query);
    },
    enabled: Boolean(query),
    staleTime: 15_000,
  });
}

export function useBillingPaymentMethodsQuery() {
  return useQuery({
    queryKey: billingQueryKeys.paymentMethods(),
    queryFn: () => billingApi.listPaymentMethods(),
    staleTime: 30_000,
  });
}

function useBillingInvalidation() {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: billingQueryKeys.all }),
      queryClient.invalidateQueries({ queryKey: usageBaseQueryKey }),
      queryClient.invalidateQueries({ queryKey: dashboardBaseQueryKey }),
      queryClient.invalidateQueries({ queryKey: notificationsBaseQueryKey }),
    ]);
  };
}

interface CreateCheckoutSessionVariables {
  planId: CreateCheckoutSessionRequest["planId"];
  billingCycle: BillingCycle;
  successUrl?: string;
  cancelUrl?: string;
  couponCode?: string;
}

export function useCreateCheckoutSessionMutation() {
  const invalidate = useBillingInvalidation();
  return useMutation({
    mutationFn: (input: CreateCheckoutSessionVariables): Promise<CreateCheckoutSessionResponse> =>
      billingApi.createCheckoutSession(input),
    onSuccess: invalidate,
  });
}

export function useCreatePortalSessionMutation() {
  return useMutation({
    mutationFn: (input: CreatePortalSessionRequest = {}) => billingApi.createPortalSession(input),
  });
}

export function useChangePlanMutation() {
  const invalidate = useBillingInvalidation();
  return useMutation({
    mutationFn: (input: ChangePlanRequest) => billingApi.changePlan(input),
    onSuccess: invalidate,
  });
}

export function useCancelSubscriptionMutation() {
  const invalidate = useBillingInvalidation();
  return useMutation({
    mutationFn: (input: CancelSubscriptionRequest) => billingApi.cancelSubscription(input),
    onSuccess: invalidate,
  });
}

export function useUpdateAutoRenewalMutation() {
  const invalidate = useBillingInvalidation();
  return useMutation({
    mutationFn: (input: UpdateAutoRenewalRequest) => billingApi.updateAutoRenewal(input),
    onSuccess: invalidate,
  });
}

export function usePauseSubscriptionMutation() {
  const invalidate = useBillingInvalidation();
  return useMutation({
    mutationFn: (input: PauseSubscriptionRequest = {}) => billingApi.pauseSubscription(input),
    onSuccess: invalidate,
  });
}

export function useResumeSubscriptionMutation() {
  const invalidate = useBillingInvalidation();
  return useMutation({
    mutationFn: (input: ResumeSubscriptionRequest = {}) => billingApi.resumeSubscription(input),
    onSuccess: invalidate,
  });
}

export function useRetryPaymentMutation() {
  const invalidate = useBillingInvalidation();
  return useMutation({
    mutationFn: (input: RetryPaymentRequest = {}) => billingApi.retryPayment(input),
    onSuccess: invalidate,
  });
}

export function useApplyDiscountMutation() {
  const invalidate = useBillingInvalidation();
  return useMutation({
    mutationFn: (input: ApplyDiscountRequest) => billingApi.applyDiscount(input),
    onSuccess: invalidate,
  });
}

export function useAttachPaymentMethodMutation() {
  const invalidate = useBillingInvalidation();
  return useMutation({
    mutationFn: (input: AttachPaymentMethodRequest) => billingApi.attachPaymentMethod(input),
    onSuccess: invalidate,
  });
}

export function useRemovePaymentMethodMutation() {
  const invalidate = useBillingInvalidation();
  return useMutation({
    mutationFn: (paymentMethodId: string) => billingApi.removePaymentMethod(paymentMethodId),
    onSuccess: invalidate,
  });
}

export function useSetDefaultPaymentMethodMutation() {
  const invalidate = useBillingInvalidation();
  return useMutation({
    mutationFn: (paymentMethodId: string) => billingApi.setDefaultPaymentMethod(paymentMethodId),
    onSuccess: invalidate,
  });
}

export function useDownloadInvoicePdfMutation() {
  return useMutation({
    mutationFn: (invoiceId: string) => billingApi.downloadInvoicePdf(invoiceId),
  });
}

export function checkoutPlanId(planId: BillingPlanId): CheckoutPlanId | null {
  return planId === "free" || planId === "pro" || planId === "enterprise" ? planId : null;
}
