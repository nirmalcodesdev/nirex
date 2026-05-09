import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Copy,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type { ApiKeyItem, ApiKeyScope, CreateApiKeyRequest } from "@nirex/shared";
import { createApiKeySchema, revokeApiKeySchema } from "@nirex/shared";
import { useToast } from "../../../components/ToastProvider";
import {
  API_KEY_SCOPE_METADATA,
  DEFAULT_ONBOARDING_API_KEY_SCOPES,
} from "../../../features/api-keys/apiKeyScopes";
import {
  useApiKeysQuery,
  useCreateApiKeyMutation,
  useRevokeApiKeyMutation,
  useRotateApiKeyMutation,
} from "../../../features/api-keys/useApiKeys";

interface ApiKeysSettingsProps {
  initialCreateOpen?: boolean;
  onCreateOpenChange?: (open: boolean) => void;
}

type KeyFlow =
  | { mode: "create" }
  | { mode: "rotate"; key: ApiKeyItem };

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function isRevoked(key: ApiKeyItem): boolean {
  return Boolean(key.revokedAt);
}

function isExpired(key: ApiKeyItem): boolean {
  if (!key.expiresAt) return false;
  return new Date(key.expiresAt).getTime() < Date.now();
}

function expiresSoon(key: ApiKeyItem): boolean {
  if (!key.expiresAt || isExpired(key)) return false;
  return new Date(key.expiresAt).getTime() - Date.now() <= 14 * 24 * 60 * 60 * 1000;
}

function buildExpiresAt(
  value: "default" | "30d" | "90d" | "custom",
  customValue: string,
): string | undefined {
  if (value === "default") return undefined;
  if (value === "custom") {
    return customValue ? new Date(customValue).toISOString() : undefined;
  }

  const days = value === "30d" ? 30 : 90;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function downloadEnvFile(apiKey: string): void {
  const blob = new Blob([`NIREX_API_KEY=${apiKey}\n`], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = ".env.local";
  link.click();
  URL.revokeObjectURL(url);
}

function groupScopes() {
  return API_KEY_SCOPE_METADATA.reduce<Record<string, typeof API_KEY_SCOPE_METADATA>>((groups, item) => {
    groups[item.group] = [...(groups[item.group] ?? []), item];
    return groups;
  }, {});
}

export function ApiKeysSettings({
  initialCreateOpen = false,
  onCreateOpenChange,
}: ApiKeysSettingsProps) {
  const { toast } = useToast();
  const { data, error, isFetching, isLoading } = useApiKeysQuery();
  const [flow, setFlow] = useState<KeyFlow | null>(initialCreateOpen ? { mode: "create" } : null);
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyItem | null>(null);
  const [query, setQuery] = useState("");

  const activeKeys = useMemo(() => {
    const search = query.trim().toLowerCase();

    return (data?.keys ?? [])
      .filter((key) => !isRevoked(key))
      .filter((key) => {
        if (!search) return true;
        return (
          key.name.toLowerCase().includes(search) ||
          key.keyPrefix.toLowerCase().includes(search) ||
          key.scopes.some((scope) => scope.toLowerCase().includes(search))
        );
      })
      .sort((left, right) => {
        const leftExpired = isExpired(left) ? 1 : 0;
        const rightExpired = isExpired(right) ? 1 : 0;
        if (leftExpired !== rightExpired) return leftExpired - rightExpired;
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      });
  }, [data?.keys, query]);

  const openFlow = (nextFlow: KeyFlow) => {
    setFlow(nextFlow);
    onCreateOpenChange?.(true);
  };

  const closeFlow = () => {
    setFlow(null);
    onCreateOpenChange?.(false);
  };

  return (
    <>
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h2 className="text-lg font-medium">API Keys</h2>
            <p className="mt-1 text-sm text-muted-foreground">Manage active credentials.</p>
          </div>
          <button
            type="button"
            onClick={() => openFlow({ mode: "create" })}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus size={16} />
            Create key
          </button>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          {error ? <InlineError message={getErrorMessage(error, "Unable to load API keys.")} /> : null}

          <div className="relative max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search keys"
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {isLoading ? (
            <div className="rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
              Loading API keys...
            </div>
          ) : activeKeys.length === 0 ? (
            <EmptyState hasQuery={query.trim().length > 0} onCreate={() => openFlow({ mode: "create" })} />
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <div className="hidden min-w-[760px] grid-cols-[minmax(220px,1.2fr)_minmax(220px,1fr)_140px_140px_112px] border-b border-border bg-muted/30 px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid">
                <span>Name</span>
                <span>Scopes</span>
                <span>Last used</span>
                <span>Expires</span>
                <span className="text-right">Actions</span>
              </div>
              <div className="divide-y divide-border">
                {activeKeys.map((key) => (
                  <ApiKeyRow
                    key={key.id}
                    apiKey={key}
                    onRotate={() => openFlow({ mode: "rotate", key })}
                    onRevoke={() => setRevokeTarget(key)}
                  />
                ))}
              </div>
            </div>
          )}

          {isFetching && !isLoading ? (
            <p className="text-xs text-muted-foreground">Refreshing...</p>
          ) : null}
        </div>
      </section>

      <AnimatePresence>
        {flow ? (
          <KeyDialog
            flow={flow}
            onClose={closeFlow}
            onSuccess={(message) => toast(message, "success")}
          />
        ) : null}
        {revokeTarget ? (
          <RevokeDialog
            apiKey={revokeTarget}
            onClose={() => setRevokeTarget(null)}
            onSuccess={(message) => toast(message, "success")}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}

function ApiKeyRow({
  apiKey,
  onRotate,
  onRevoke,
}: {
  apiKey: ApiKeyItem;
  onRotate: () => void;
  onRevoke: () => void;
}) {
  return (
    <div className="grid gap-4 bg-background p-4 md:min-w-[760px] md:grid-cols-[minmax(220px,1.2fr)_minmax(220px,1fr)_140px_140px_112px] md:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium">{apiKey.name}</p>
          <KeyStatus apiKey={apiKey} />
        </div>
        <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
          {apiKey.keyPrefix}....{apiKey.last4}
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {apiKey.scopes.slice(0, 4).map((scope) => (
          <span key={scope} className="rounded-md border border-border bg-card px-2 py-1 font-mono text-[11px]">
            {scope}
          </span>
        ))}
        {apiKey.scopes.length > 4 ? (
          <span className="rounded-md border border-border bg-card px-2 py-1 text-[11px] text-muted-foreground">
            +{apiKey.scopes.length - 4}
          </span>
        ) : null}
      </div>

      <MetaLine label="Last used" value={formatDate(apiKey.lastUsedAt)} />
      <MetaLine label="Expires" value={formatDate(apiKey.expiresAt)} />

      <div className="flex justify-end gap-1">
        <IconButton label="Rotate" onClick={onRotate}>
          <RefreshCw size={15} />
        </IconButton>
        <IconButton label="Revoke" destructive onClick={onRevoke}>
          <Trash2 size={15} />
        </IconButton>
      </div>
    </div>
  );
}

function KeyDialog({
  flow,
  onClose,
  onSuccess,
}: {
  flow: KeyFlow;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const { toast } = useToast();
  const createMutation = useCreateApiKeyMutation();
  const rotateMutation = useRotateApiKeyMutation();
  const isRotate = flow.mode === "rotate";
  const [name, setName] = useState(isRotate ? flow.key.name : "");
  const [selectedScopes, setSelectedScopes] = useState<ApiKeyScope[]>(
    isRotate ? flow.key.scopes : DEFAULT_ONBOARDING_API_KEY_SCOPES,
  );
  const [expiry, setExpiry] = useState<"default" | "30d" | "90d" | "custom">("default");
  const [customExpiry, setCustomExpiry] = useState("");
  const [error, setError] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [secretSaved, setSecretSaved] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<{
    name: string;
    apiKey: string;
    scopes: ApiKeyScope[];
  } | null>(null);

  const scopeGroups = useMemo(() => groupScopes(), []);
  const isWorking = createMutation.isPending || rotateMutation.isPending;

  const toggleScope = (scope: ApiKeyScope) => {
    setSelectedScopes((current) =>
      current.includes(scope)
        ? current.filter((item) => item !== scope)
        : [...current, scope],
    );
  };

  const copySecret = async () => {
    if (!createdSecret) return;
    await navigator.clipboard.writeText(createdSecret.apiKey);
    toast("Copied.", "success");
  };

  const submitCreate = async () => {
    setError("");
    const expiresAt = buildExpiresAt(expiry, customExpiry);
    const payload = {
      name,
      scopes: selectedScopes,
      ...(expiresAt ? { expiresAt } : {}),
    } satisfies CreateApiKeyRequest;
    const parsed = createApiKeySchema.safeParse(payload);

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a valid key name and scope.");
      return;
    }

    try {
      const createInput = parsed.data.expiresAt
        ? { ...parsed.data, expiresAt: parsed.data.expiresAt }
        : { name: parsed.data.name, scopes: parsed.data.scopes };
      const response = await createMutation.mutateAsync(createInput);
      setCreatedSecret({
        name: response.key.name,
        apiKey: response.apiKey,
        scopes: response.key.scopes,
      });
      onSuccess(`API key "${response.key.name}" created.`);
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Unable to create API key."));
    }
  };

  const submitRotate = async () => {
    if (!isRotate) return;

    setError("");
    try {
      const response = await rotateMutation.mutateAsync({ keyId: flow.key.id });
      setCreatedSecret({
        name: response.key.name,
        apiKey: response.apiKey,
        scopes: response.key.scopes,
      });
      onSuccess(`API key "${response.key.name}" rotated.`);
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Unable to rotate API key."));
    }
  };

  return (
    <ModalShell onClose={onClose}>
      <div className="flex max-h-[min(760px,calc(100vh-32px))] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-elevated)]">
        <DialogHeader
          title={createdSecret ? "API key created" : isRotate ? "Rotate API key" : "Create API key"}
          onClose={onClose}
        />

        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          {error ? <InlineError message={error} /> : null}

          {createdSecret ? (
            <SecretView
              secret={createdSecret.apiKey}
              name={createdSecret.name}
              showSecret={showSecret}
              secretSaved={secretSaved}
              onCopy={() => void copySecret()}
              onDownload={() => downloadEnvFile(createdSecret.apiKey)}
              onToggleShow={() => setShowSecret((value) => !value)}
              onToggleSaved={setSecretSaved}
            />
          ) : isRotate ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-background p-4">
                <p className="text-sm font-medium">{flow.key.name}</p>
                <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                  {flow.key.keyPrefix}....{flow.key.last4}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {flow.key.scopes.map((scope) => (
                  <span key={scope} className="rounded-md border border-border bg-background px-2 py-1 font-mono text-[11px]">
                    {scope}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Production CLI"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-medium">Scopes</label>
                  <button
                    type="button"
                    onClick={() => setSelectedScopes(DEFAULT_ONBOARDING_API_KEY_SCOPES)}
                    className="text-sm font-medium text-nirex-accent hover:underline"
                  >
                    Recommended
                  </button>
                </div>
                <div className="space-y-4">
                  {Object.entries(scopeGroups).map(([group, scopes]) => (
                    <fieldset key={group} className="space-y-2">
                      <legend className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {group}
                      </legend>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {scopes.map((scope) => (
                          <label
                            key={scope.scope}
                            className="flex min-h-11 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={selectedScopes.includes(scope.scope)}
                              onChange={() => toggleScope(scope.scope)}
                              className="h-4 w-4 rounded border-border"
                            />
                            <span className="min-w-0">
                              <span className="block truncate">{scope.label}</span>
                              <span className="block truncate font-mono text-[11px] text-muted-foreground">
                                {scope.scope}
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Expiry</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    ["default", "Default"],
                    ["30d", "30 days"],
                    ["90d", "90 days"],
                    ["custom", "Custom"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setExpiry(value as "default" | "30d" | "90d" | "custom")}
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        expiry === value ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-muted"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {expiry === "custom" ? (
                  <input
                    type="datetime-local"
                    value={customExpiry}
                    min={new Date().toISOString().slice(0, 16)}
                    onChange={(event) => setCustomExpiry(event.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                ) : null}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border bg-muted/20 p-4 sm:flex-row sm:justify-end">
          {createdSecret ? (
            <button
              type="button"
              onClick={onClose}
              disabled={!secretSaved}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Close
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void (isRotate ? submitRotate() : submitCreate())}
                disabled={isWorking}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isWorking ? "Saving..." : isRotate ? "Rotate key" : "Create key"}
              </button>
            </>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

function RevokeDialog({
  apiKey,
  onClose,
  onSuccess,
}: {
  apiKey: ApiKeyItem;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const revokeMutation = useRevokeApiKeyMutation();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    const payload = reason.trim() ? { reason: reason.trim() } : {};
    const parsed = revokeApiKeySchema.safeParse(payload);

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a valid reason.");
      return;
    }

    try {
      const input = parsed.data.reason ? { reason: parsed.data.reason } : {};
      await revokeMutation.mutateAsync({ keyId: apiKey.id, input });
      onSuccess(`API key "${apiKey.name}" revoked.`);
      onClose();
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Unable to revoke API key."));
    }
  };

  return (
    <ModalShell onClose={onClose} maxWidthClassName="max-w-lg">
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-elevated)]">
        <DialogHeader title="Revoke API key" onClose={onClose} />
        <div className="space-y-4 p-5 sm:p-6">
          {error ? <InlineError message={error} /> : null}
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-sm font-medium">{apiKey.name}</p>
            <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
              {apiKey.keyPrefix}....{apiKey.last4}
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Reason</label>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              placeholder="Optional"
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-border bg-muted/20 p-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={revokeMutation.isPending}
            className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
          >
            {revokeMutation.isPending ? "Revoking..." : "Revoke key"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function SecretView({
  name,
  secret,
  showSecret,
  secretSaved,
  onCopy,
  onDownload,
  onToggleSaved,
  onToggleShow,
}: {
  name: string;
  secret: string;
  showSecret: boolean;
  secretSaved: boolean;
  onCopy: () => void;
  onDownload: () => void;
  onToggleSaved: (saved: boolean) => void;
  onToggleShow: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium">{name}</p>
        <div className="mt-3 rounded-lg border border-border bg-slate-950 p-3">
          <code className="block break-all font-mono text-sm leading-6 text-slate-100">
            {showSecret ? secret : `${secret.slice(0, 16)}${"*".repeat(Math.max(8, secret.length - 16))}`}
          </code>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onToggleShow} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">
          {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
          {showSecret ? "Hide" : "Show"}
        </button>
        <button type="button" onClick={onCopy} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">
          <Copy size={15} />
          Copy
        </button>
        <button type="button" onClick={onDownload} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">
          <Download size={15} />
          Download
        </button>
      </div>

      <label className="flex items-start gap-3 rounded-lg border border-border bg-background p-3 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={secretSaved}
          onChange={(event) => onToggleSaved(event.target.checked)}
          className="mt-1 h-4 w-4 rounded border-border"
        />
        <span>I saved this key.</span>
      </label>
    </div>
  );
}

function EmptyState({ hasQuery, onCreate }: { hasQuery: boolean; onCreate: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-background p-6 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <KeyRound size={18} />
      </div>
      <p className="mt-3 text-sm font-medium">{hasQuery ? "No matching keys" : "No active API keys"}</p>
      {!hasQuery ? (
        <button
          type="button"
          onClick={onCreate}
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus size={16} />
          Create key
        </button>
      ) : null}
    </div>
  );
}

function ModalShell({
  children,
  maxWidthClassName = "max-w-2xl",
  onClose,
}: {
  children: React.ReactNode;
  maxWidthClassName?: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <motion.button
        type="button"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 8 }}
        className={`relative w-full ${maxWidthClassName}`}
      >
        {children}
      </motion.div>
    </div>
  );
}

function DialogHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
      <h3 className="text-base font-medium">{title}</h3>
      <button
        type="button"
        onClick={onClose}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X size={18} />
      </button>
    </div>
  );
}

function IconButton({
  children,
  destructive = false,
  label,
  onClick,
}: {
  children: React.ReactNode;
  destructive?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
        destructive
          ? "border-destructive/30 text-destructive hover:bg-destructive/10"
          : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function KeyStatus({ apiKey }: { apiKey: ApiKeyItem }) {
  if (isExpired(apiKey)) {
    return <span className="rounded-md bg-destructive/10 px-2 py-0.5 text-xs text-destructive">Expired</span>;
  }

  if (expiresSoon(apiKey)) {
    return <span className="rounded-md bg-nirex-warning/10 px-2 py-0.5 text-xs text-nirex-warning">Expiring</span>;
  }

  return <span className="rounded-md bg-nirex-success/10 px-2 py-0.5 text-xs text-nirex-success">Active</span>;
}

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 text-sm md:text-xs">
      <span className="mr-2 text-muted-foreground md:hidden">{label}</span>
      <span className="break-words text-foreground md:text-muted-foreground">{value}</span>
    </div>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      <AlertCircle size={16} className="shrink-0" />
      <span>{message}</span>
    </div>
  );
}
