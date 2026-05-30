import type { UsageRange } from "@nirex/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { usageApi } from "./usageApi";
import { usageBaseQueryKey } from "./useUsageOverview";

interface UseRequestLogsOptions {
  page?: number;
  limit?: number;
  range?: UsageRange;
}

export function useRequestLogsQuery(options: UseRequestLogsOptions = {}) {
  const { page = 1, limit = 20, range = "30d" } = options;

  return useQuery({
    queryKey: [...usageBaseQueryKey, "requests", range, page, limit] as const,
    queryFn: () => usageApi.getRequestLogs({ page, limit, range }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}
