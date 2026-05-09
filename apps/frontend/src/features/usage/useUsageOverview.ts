import type { UsageExportFormat, UsageRange } from "@nirex/shared";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { usageApi } from "./usageApi";

interface UseUsageOverviewOptions {
  range?: UsageRange;
}

interface UsageExportVariables {
  range: UsageRange;
  format: UsageExportFormat;
}

export function useUsageOverviewQuery(options: UseUsageOverviewOptions = {}) {
  const { range = "30d" } = options;

  return useQuery({
    queryKey: ["usage", "overview", range] as const,
    queryFn: () => usageApi.getOverview({ range }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useUsageExportMutation() {
  return useMutation({
    mutationFn: ({ range, format }: UsageExportVariables) => usageApi.exportOverview(range, format),
  });
}
