import type { ApiKeyScope } from "@nirex/shared";

export const API_KEY_SCOPE_METADATA: Array<{
  scope: ApiKeyScope;
  label: string;
  description: string;
  group: "Sessions" | "Usage" | "Billing" | "Dashboard" | "Notifications";
  recommended?: boolean;
}> = [
  {
    scope: "sessions:read",
    label: "Read sessions",
    description: "List chat sessions and inspect session details.",
    group: "Sessions",
    recommended: true,
  },
  {
    scope: "sessions:write",
    label: "Write sessions",
    description: "Create, update, and manage chat sessions and messages.",
    group: "Sessions",
    recommended: true,
  },
  {
    scope: "usage:read",
    label: "Read usage",
    description: "Access credit usage charts, export data, and analyze quota trends.",
    group: "Usage",
    recommended: true,
  },
  {
    scope: "billing:read",
    label: "Read billing",
    description: "View invoices, subscription status, and payment details.",
    group: "Billing",
  },
  {
    scope: "billing:write",
    label: "Write billing",
    description: "Manage billing actions that can change subscription state.",
    group: "Billing",
  },
  {
    scope: "dashboard:read",
    label: "Read dashboard",
    description: "Access high-level health, KPI, and summary dashboards.",
    group: "Dashboard",
    recommended: true,
  },
  {
    scope: "notifications:read",
    label: "Read notifications",
    description: "View security, usage, and account notifications.",
    group: "Notifications",
    recommended: true,
  },
  {
    scope: "notifications:write",
    label: "Write notifications",
    description: "Create, update, and archive notifications programmatically.",
    group: "Notifications",
  },
];

export const DEFAULT_ONBOARDING_API_KEY_SCOPES: ApiKeyScope[] = API_KEY_SCOPE_METADATA
  .filter((scope) => scope.recommended)
  .map((scope) => scope.scope);
