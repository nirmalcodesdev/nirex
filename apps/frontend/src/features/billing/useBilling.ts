import type {
  BillingCycle,
  BillingInvoiceItem,
  BillingOverviewResponse,
  CreateCheckoutSessionRequest,
  CreateCheckoutSessionResponse,
} from "@nirex/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { billingApi } from "./billingApi";

export const billingBaseQueryKey = ["billing"] as const;

export function useBillingOverviewQuery(options?: { force?: boolean }) {
  return useQuery({
    queryKey: [...billingBaseQueryKey, "overview", options?.force] as const,
    queryFn: (): Promise<BillingOverviewResponse> => billingApi.getOverview(options),
    staleTime: options?.force ? 0 : 30_000,
  });
}

export function useBillingInvoicesQuery(limit: number = 50) {
  return useQuery({
    queryKey: [...billingBaseQueryKey, "invoices", limit] as const,
    queryFn: (): Promise<BillingInvoiceItem[]> => billingApi.listInvoices({ limit }),
    staleTime: 30_000,
  });
}

function useBillingInvalidation() {
  const queryClient = useQueryClient();

  return async () => {
    await queryClient.invalidateQueries({ queryKey: billingBaseQueryKey });
  };
}

interface CreateCheckoutSessionVariables {
  planId: CreateCheckoutSessionRequest["planId"];
  billingCycle: BillingCycle;
  successUrl?: string;
  cancelUrl?: string;
}

export function useCreateCheckoutSessionMutation() {
  const invalidate = useBillingInvalidation();

  return useMutation({
    mutationFn: (input: CreateCheckoutSessionVariables): Promise<CreateCheckoutSessionResponse> =>
      billingApi.createCheckoutSession(input),
    onSuccess: invalidate,
  });
}
