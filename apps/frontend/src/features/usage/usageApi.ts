import type {
  UsageExportFormat,
  UsageOverviewQuery,
  UsageOverviewResponse,
  UsageRange,
  RequestLogsQuery,
  RequestLogsResponse,
} from "@nirex/shared";
import { API_BASE_URL, BackendApiError, dataOrThrow, request, type BackendResponse } from "../../lib/backendApi";

const USAGE_BASE = "/usage";

function buildRequestLogsPath(query: RequestLogsQuery): string {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));
  if (query.range) params.set("range", query.range);
  const search = params.toString();
  return search ? `${USAGE_BASE}/requests?${search}` : `${USAGE_BASE}/requests`;
}

function buildOverviewPath(query: UsageOverviewQuery): string {
  const params = new URLSearchParams();

  if (query.range) {
    params.set("range", query.range);
  }

  const search = params.toString();
  return search ? `${USAGE_BASE}/overview?${search}` : `${USAGE_BASE}/overview`;
}

function buildExportPath(range: UsageRange, format: UsageExportFormat): string {
  const params = new URLSearchParams({
    range,
    format,
  });
  return `${USAGE_BASE}/export?${params.toString()}`;
}

function parseContentDispositionFileName(disposition: string | null): string | null {
  if (!disposition) return null;

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const basicMatch = disposition.match(/filename="?([^";]+)"?/i);
  return basicMatch?.[1] ?? null;
}

async function parseJsonSafely<T>(response: Response): Promise<BackendResponse<T> | null> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as BackendResponse<T>;
  } catch {
    return null;
  }
}

export interface UsageExportResult {
  blob: Blob;
  fileName: string;
  contentType: string;
}

export const usageApi = {
  async getOverview(query: UsageOverviewQuery): Promise<UsageOverviewResponse> {
    const payload = await request<UsageOverviewResponse>(buildOverviewPath(query), {
      method: "GET",
    });

    return dataOrThrow(payload, "USAGE_OVERVIEW_FAILED");
  },

  async getRequestLogs(query: RequestLogsQuery): Promise<RequestLogsResponse> {
    const payload = await request<RequestLogsResponse>(buildRequestLogsPath(query), {
      method: "GET",
    });
    return dataOrThrow(payload, "REQUEST_LOGS_FAILED");
  },

  async exportOverview(range: UsageRange, format: UsageExportFormat): Promise<UsageExportResult> {
    const response = await fetch(`${API_BASE_URL}${buildExportPath(range, format)}`, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: format === "csv" ? "text/csv,application/json" : "application/json,text/plain,*/*",
      },
    });

    if (!response.ok) {
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const payload = await parseJsonSafely<unknown>(response);
        const message = payload?.error?.message ?? payload?.message ?? "Export request failed.";
        const code = payload?.error?.code ?? payload?.code;
        const details = payload?.error?.details ?? payload?.errors;
        throw new BackendApiError(message, response.status, code, details);
      }

      const message = await response.text();
      throw new BackendApiError(message || "Export request failed.", response.status, "USAGE_EXPORT_FAILED");
    }

    const blob = await response.blob();
    const fileName =
      parseContentDispositionFileName(response.headers.get("content-disposition")) ??
      `usage-report-${range}.${format === "csv" ? "csv" : "json"}`;

    return {
      blob,
      fileName,
      contentType: response.headers.get("content-type") ?? blob.type ?? "application/octet-stream",
    };
  },
};
