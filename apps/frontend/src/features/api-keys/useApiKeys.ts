import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateApiKeyRequest,
  RevokeApiKeyRequest,
  RotateApiKeyRequest,
} from "@nirex/shared";
import { apiKeysApi } from "./apiKeysApi";

export const apiKeysQueryKey = ["api-keys"] as const;

export function useApiKeysQuery(enabled = true) {
  return useQuery({
    queryKey: apiKeysQueryKey,
    queryFn: () => apiKeysApi.list(),
    enabled,
  });
}

export function useCreateApiKeyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateApiKeyRequest) => apiKeysApi.create(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: apiKeysQueryKey });
    },
  });
}

export function useRotateApiKeyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ keyId, input }: { keyId: string; input?: RotateApiKeyRequest }) =>
      apiKeysApi.rotate(keyId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: apiKeysQueryKey });
    },
  });
}

export function useRevokeApiKeyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ keyId, input }: { keyId: string; input?: RevokeApiKeyRequest }) =>
      apiKeysApi.revoke(keyId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: apiKeysQueryKey });
    },
  });
}
