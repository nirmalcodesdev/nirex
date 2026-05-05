import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  Clipboard,
  Key,
  Laptop,
  Menu,
  Monitor,
  Moon,
  Shield,
  Smartphone,
  Sun,
  Trash2,
  User,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { PageHeader } from "@nirex/ui";
import {
  changePasswordSchema,
  terminateDevicesSchema,
  updateProfileSchema,
  type BeginTwoFactorSetupResponse,
  type SessionDTO,
  type TwoFactorStatusResponse,
} from "@nirex/shared";
import { useToast } from "../../../components/ToastProvider";
import { useTheme } from "../../../components/ui/ThemeProvider";
import { authApi } from "../../../features/auth/authApi";
import { authUserUpdated, signedOutLocally } from "../../../features/auth/authSlice";
import { useAppDispatch, useAppSelector } from "../../../store/hooks";
import { ROUTES } from "../../../constant/routes";
import { UserAvatar } from "../../../components/ui/UserAvatar";

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

const settingsNav: NavItem[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "appearance", label: "Appearance", icon: Monitor },
  { id: "security", label: "Security", icon: Shield },
  { id: "api-keys", label: "API Keys", icon: Key },
];

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function Settings() {
  const [activeTab, setActiveTab] = useState("profile");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCreateApiKeyModalOpen, setIsCreateApiKeyModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  const handleTabChange = (id: string) => {
    setActiveTab(id);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-6 lg:gap-8 pb-8 sm:pb-12 py-2 sm:py-4 lg:py-5 px-3 mx-auto">
      <PageHeader title="Settings" description="Manage your account settings and preferences." />

      <div className="flex flex-col md:flex-row gap-6 sm:gap-8 relative">
        <div className="md:hidden flex items-center justify-between bg-card border border-border rounded-lg p-3">
          <div className="flex items-center gap-2 font-medium">
            {(() => {
              const activeItem = settingsNav.find((n) => n.id === activeTab);
              if (!activeItem) return null;
              const Icon = activeItem.icon;
              return (
                <>
                  <Icon size={18} />
                  {activeItem.label}
                </>
              );
            })()}
          </div>
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-1.5 hover:bg-muted rounded-md transition-colors"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <div
          className={`md:w-64 flex-col gap-1 shrink-0 ${
            isMobileMenuOpen
              ? "flex absolute top-14 left-0 right-0 z-10 bg-card border border-border p-2 rounded-lg"
              : "hidden md:flex"
          }`}
        >
          {settingsNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleTabChange(item.id)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-nirex-accent/10 text-nirex-accent"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
              >
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 min-w-0">
          {activeTab === "profile" && <ProfileSettings />}
          {activeTab === "appearance" && <AppearanceSettings theme={theme} setTheme={setTheme} />}
          {activeTab === "security" && <SecuritySettings />}
          {activeTab === "api-keys" && (
            <ApiKeysSettings onCreateKey={() => setIsCreateApiKeyModalOpen(true)} />
          )}
        </div>
      </div>

      <AnimatePresence>
        {isCreateApiKeyModalOpen && (
          <CreateApiKeyModal
            keyName={newKeyName}
            setKeyName={setNewKeyName}
            onClose={() => setIsCreateApiKeyModalOpen(false)}
            onCreate={() => {
              toast(`API Key "${newKeyName || "New Key"}" created successfully.`, "success");
              setIsCreateApiKeyModalOpen(false);
              setNewKeyName("");
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ProfileSettings() {
  const user = useAppSelector((state) => state.auth.user);
  const dispatch = useAppDispatch();
  const { toast } = useToast();
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setFullName(user?.fullName ?? "");
  }, [user?.fullName]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    const parsed = updateProfileSchema.safeParse({ fullName });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a valid full name.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await authApi.updateProfile(parsed.data);
      dispatch(authUserUpdated(response.user));
      setSaved(true);
      toast("Profile updated.", "success");
      window.setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to update profile."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-5 sm:p-6 border-b border-border">
        <h2 className="text-lg sm:text-xl font-medium mb-1">Profile Settings</h2>
        <p className="text-sm text-muted-foreground">Update your account identity.</p>
      </div>

      <div className="p-5 sm:p-6 flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          <UserAvatar className="w-20 h-20 text-2xl" name={user?.fullName} />
          <div>
            <p className="text-sm font-medium">{user?.email ?? "Signed in account"}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {user?.isEmailVerified ? "Email verified" : "Email verification pending"}
            </p>
          </div>
        </div>

        {error && <InlineError message={error} />}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <InputField
            label="Full name"
            value={fullName}
            onChange={setFullName}
            autoComplete="name"
          />
          <ReadOnlyField label="Email address" value={user?.email ?? ""} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <ReadOnlyField label="Account created" value={formatDate(user?.createdAt)} />
          <ReadOnlyField label="Last profile update" value={formatDate(user?.updatedAt)} />
        </div>
      </div>

      <div className="p-5 sm:p-6 border-t border-border bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground text-center sm:text-left">
          Changes apply immediately across signed-in sessions.
        </p>
        <div className="flex items-center gap-4 w-full sm:w-auto">
          {saved && (
            <span className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-nirex-success">
              <CheckCircle2 size={16} /> Saved
            </span>
          )}
          <button
            type="submit"
            disabled={isSaving}
            className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-6 py-2 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </form>
  );
}

interface AppearanceSettingsProps {
  theme: string;
  setTheme: (theme: "light" | "dark" | "system") => void;
}

function AppearanceSettings({ theme, setTheme }: AppearanceSettingsProps) {
  const themes = [
    { id: "light", label: "Light", icon: Sun },
    { id: "dark", label: "Dark", icon: Moon },
    { id: "system", label: "System", icon: Laptop },
  ] as const;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-5 sm:p-6 border-b border-border">
        <h2 className="text-lg sm:text-xl font-medium mb-1">Appearance</h2>
        <p className="text-sm text-muted-foreground">Customize the look and feel of your dashboard.</p>
      </div>
      <div className="p-5 sm:p-6 flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <label className="text-sm font-medium">Theme Preference</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {themes.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTheme(item.id)}
                className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                  theme === item.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 bg-background"
                }`}
              >
                <item.icon size={24} className={theme === item.id ? "text-primary" : "text-muted-foreground"} />
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SecuritySettings() {
  return (
    <div className="space-y-6">
      <PasswordSettings />
      <TwoFactorSettings />
      <DeviceSettings />
    </div>
  );
}

function PasswordSettings() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    const parsed = changePasswordSchema.safeParse({ currentPassword, newPassword });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a valid password.");
      return;
    }

    setIsSaving(true);
    try {
      await authApi.changePassword(parsed.data);
      toast("Password changed. Please sign in again.", "success");
      dispatch(signedOutLocally());
      navigate(ROUTES.AUTH.SIGNIN, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, "Unable to change password."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-5 sm:p-6 border-b border-border">
        <h2 className="text-lg sm:text-xl font-medium mb-1">Password</h2>
        <p className="text-sm text-muted-foreground">Update your password. Other sessions are terminated after a change.</p>
      </div>
      <div className="p-5 sm:p-6 flex flex-col gap-4 max-w-xl">
        {error && <InlineError message={error} />}
        <InputField label="Current password" type="password" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" />
        <InputField label="New password" type="password" value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
        <InputField label="Confirm new password" type="password" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
      </div>
      <div className="p-5 sm:p-6 border-t border-border bg-muted/20 flex justify-end">
        <button
          type="submit"
          disabled={isSaving}
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-6 py-2 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {isSaving ? "Updating..." : "Update Password"}
        </button>
      </div>
    </form>
  );
}

function TwoFactorSettings() {
  const { toast } = useToast();
  const [status, setStatus] = useState<TwoFactorStatusResponse | null>(null);
  const [setup, setSetup] = useState<BeginTwoFactorSetupResponse | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [backupCodesSaved, setBackupCodesSaved] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);

  const loadStatus = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      setStatus(await authApi.getTwoFactorStatus());
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load two-factor status."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const beginSetup = async () => {
    setIsWorking(true);
    setError("");
    setBackupCodes([]);
    setBackupCodesSaved(false);
    try {
      setSetup(await authApi.beginTwoFactorSetup());
      toast("Two-factor setup started.", "success");
    } catch (err) {
      setError(getErrorMessage(err, "Unable to start two-factor setup."));
    } finally {
      setIsWorking(false);
    }
  };

  const verifySetup = async () => {
    const code = verifyCode.trim();
    if (code.length < 6) {
      setError("Enter the code from your authenticator app.");
      return;
    }

    setIsWorking(true);
    setError("");
    try {
      const response = await authApi.verifyTwoFactorSetup(code);
      setBackupCodes(response.backupCodes);
      setBackupCodesSaved(false);
      setSetup(null);
      setVerifyCode("");
      await loadStatus();
      toast("Two-factor authentication enabled.", "success");
    } catch (err) {
      setError(getErrorMessage(err, "Unable to verify two-factor setup."));
    } finally {
      setIsWorking(false);
    }
  };

  const disableTwoFactor = async () => {
    const code = disableCode.trim();
    if (code.length < 6) {
      setError("Enter a valid authenticator or backup code.");
      return;
    }

    setIsWorking(true);
    setError("");
    try {
      await authApi.disableTwoFactor(code);
      setDisableCode("");
      await loadStatus();
      toast("Two-factor authentication disabled.", "success");
    } catch (err) {
      setError(getErrorMessage(err, "Unable to disable two-factor authentication."));
    } finally {
      setIsWorking(false);
    }
  };

  const copyBackupCodes = async () => {
    await navigator.clipboard.writeText(backupCodes.join("\n"));
    toast("Backup codes copied.", "success");
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-5 sm:p-6 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-medium mb-1">Two-Factor Authentication</h2>
          <p className="text-sm text-muted-foreground">Protect sign-in with an authenticator app or backup code.</p>
        </div>
        <StatusPill active={!!status?.enabled} loading={isLoading} />
      </div>

      <div className="p-5 sm:p-6 space-y-5">
        {error && <InlineError message={error} />}

        {!status?.enabled && !setup && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Authenticator app setup</p>
              <p className="text-xs text-muted-foreground mt-1">Start setup, add the secret to your app, then verify the generated code.</p>
            </div>
            <button
              type="button"
              onClick={() => void beginSetup()}
              disabled={isWorking || isLoading}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isWorking ? "Starting..." : "Enable 2FA"}
            </button>
          </div>
        )}

        {setup && (
          <div className="space-y-5 border border-border rounded-lg p-4 bg-background">
            <div className="grid gap-5 lg:grid-cols-[260px_1fr] lg:items-center">
              <div className="mx-auto rounded-xl border border-border bg-white p-4 shadow-sm">
                <QRCodeSVG
                  value={setup.otpauthUrl}
                  size={224}
                  level="H"
                  marginSize={2}
                  bgColor="#ffffff"
                  fgColor="#020617"
                />
              </div>
              <div>
                <p className="text-sm font-medium">Scan the QR code</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Use an authenticator app such as 1Password, Google Authenticator, Microsoft Authenticator, or Authy. After scanning, enter the 6-digit code generated by the app.
                </p>
                <p className="text-xs text-muted-foreground mt-3">
                  This setup session expires {formatDate(setup.expiresAt)}. Start again if the code is rejected after expiry.
                </p>
              </div>
            </div>
            <InputField
              label="Authenticator code"
              value={verifyCode}
              onChange={(value) => setVerifyCode(value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setSetup(null)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">Cancel</button>
              <button type="button" onClick={() => void verifySetup()} disabled={isWorking} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                {isWorking ? "Verifying..." : "Verify and Enable"}
              </button>
            </div>
          </div>
        )}

        {backupCodes.length > 0 && (
          <div className="border border-nirex-warning/30 rounded-lg p-4 bg-nirex-warning/10">
            <p className="text-sm font-medium mb-2">Save these backup codes now</p>
            <p className="text-xs text-muted-foreground mb-3">
              Each backup code can be used once if you lose access to your authenticator app. They will not be shown again.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {backupCodes.map((code) => (
                <code key={code} className="rounded bg-background px-3 py-2 text-sm font-mono">{code}</code>
              ))}
            </div>
            <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <button type="button" onClick={() => void copyBackupCodes()} className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted">
                <Clipboard size={14} /> Copy backup codes
              </button>
              <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={backupCodesSaved}
                  onChange={(event) => setBackupCodesSaved(event.target.checked)}
                  className="h-4 w-4 rounded border-border text-nirex-accent focus:ring-nirex-accent"
                />
                I have saved these backup codes
              </label>
              <button
                type="button"
                disabled={!backupCodesSaved}
                onClick={() => setBackupCodes([])}
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {status?.enabled && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ReadOnlyField label="Enabled" value={formatDate(status.enabledAt)} />
              <ReadOnlyField label="Last verified" value={formatDate(status.lastVerifiedAt)} />
            </div>
            <div className="border-t border-border pt-4 max-w-xl">
              <InputField label="Authenticator or backup code" value={disableCode} onChange={setDisableCode} autoComplete="one-time-code" />
              <button
                type="button"
                onClick={() => void disableTwoFactor()}
                disabled={isWorking}
                className="mt-3 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isWorking ? "Disabling..." : "Disable 2FA"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DeviceSettings() {
  const [devices, setDevices] = useState<SessionDTO[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const { toast } = useToast();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const activeDevices = useMemo(() => devices.filter((device) => device.isActive), [devices]);

  const loadDevices = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      setDevices(await authApi.listDevices());
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load active devices."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  const revokeDevice = async (device: SessionDTO) => {
    setWorkingId(device.id);
    setError("");
    try {
      if (device.isCurrent) {
        await authApi.signOut();
        dispatch(signedOutLocally());
        toast("Signed out from this device.", "success");
        navigate(ROUTES.AUTH.SIGNIN, { replace: true });
        return;
      }

      await authApi.deleteSession(device.id);
      toast("Device session revoked.", "success");
      await loadDevices();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to revoke device session."));
    } finally {
      setWorkingId(null);
    }
  };

  const signOutOtherDevices = async () => {
    const deviceIds = devices.filter((device) => !device.isCurrent && device.isActive).map((device) => device.id);
    const parsed = terminateDevicesSchema.safeParse({ deviceIds, reason: "User requested sign-out from settings" });

    if (!parsed.success) {
      setError("There are no other active devices to sign out.");
      return;
    }

    setWorkingId("bulk");
    setError("");
    try {
      const response = await authApi.terminateDevices({
        deviceIds: parsed.data.deviceIds,
        ...(parsed.data.reason ? { reason: parsed.data.reason } : {}),
      });
      toast(`Terminated ${response.summary.terminated} device session(s).`, "success");
      await loadDevices();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to sign out other devices."));
    } finally {
      setWorkingId(null);
    }
  };

  const signOutEverywhere = async () => {
    setWorkingId("all");
    setError("");
    try {
      await authApi.signOutAll();
      dispatch(signedOutLocally());
      toast("All sessions terminated.", "success");
      navigate(ROUTES.AUTH.SIGNIN, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, "Unable to terminate all sessions."));
      setWorkingId(null);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-5 sm:p-6 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-medium mb-1">Active Devices</h2>
          <p className="text-sm text-muted-foreground">Review and revoke browser sessions tied to your account.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void loadDevices()} disabled={isLoading} className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50">
            Refresh
          </button>
          <button type="button" onClick={() => void signOutOtherDevices()} disabled={workingId !== null || activeDevices.length <= 1} className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50">
            Sign Out Others
          </button>
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-4">
        {error && <InlineError message={error} />}
        {isLoading && <p className="text-sm text-muted-foreground">Loading active devices...</p>}
        {!isLoading && devices.length === 0 && <p className="text-sm text-muted-foreground">No active device sessions found.</p>}

        <div className="space-y-3">
          {devices.map((device) => (
            <div key={device.id} className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-lg border border-border bg-background p-4">
              <div className="flex gap-3 min-w-0">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  {device.deviceInfo.toLowerCase().includes("mobile") ? <Smartphone size={18} /> : <Laptop size={18} />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{device.deviceInfo}</p>
                    {device.isCurrent && <span className="rounded-full bg-nirex-accent/10 px-2 py-0.5 text-[11px] font-medium text-nirex-accent">Current</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {device.ipAddress} {device.country ? `- ${device.country}` : ""} - Last used {formatDate(device.lastUsedAt)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Expires {formatDate(device.expiresAt)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void revokeDevice(device)}
                disabled={workingId !== null}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-destructive/30 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
              >
                <Trash2 size={14} />
                {workingId === device.id ? "Revoking..." : device.isCurrent ? "Sign Out" : "Revoke"}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="p-5 sm:p-6 border-t border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">Use this if you suspect account access from an unknown device.</p>
        <button
          type="button"
          onClick={() => void signOutEverywhere()}
          disabled={workingId !== null}
          className="rounded-lg bg-destructive text-destructive-foreground px-4 py-2 text-sm font-medium hover:bg-destructive/90 disabled:opacity-50"
        >
          {workingId === "all" ? "Terminating..." : "Sign Out Everywhere"}
        </button>
      </div>
    </div>
  );
}

interface ApiKeysSettingsProps {
  onCreateKey: () => void;
}

function ApiKeysSettings({ onCreateKey }: ApiKeysSettingsProps) {
  const { toast } = useToast();
  const apiKeys = [
    { name: "Production Key", key: "nrx_live_********************", created: "Oct 12, 2025" },
    { name: "Development Key", key: "nrx_test_********************", created: "Jan 05, 2026" },
  ];

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-5 sm:p-6 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-medium mb-1">API Keys</h2>
          <p className="text-sm text-muted-foreground">Manage your secret keys for API access.</p>
        </div>
        <button type="button" onClick={onCreateKey} className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap">
          Create New Key
        </button>
      </div>

      <div className="p-5 sm:p-6">
        <div className="border border-border rounded-lg overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Key</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {apiKeys.map((key) => (
                <tr key={key.name} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{key.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{key.key}</td>
                  <td className="px-4 py-3 text-muted-foreground">{key.created}</td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => toast("API key revoked.", "success")} className="text-sm font-medium text-nirex-error hover:underline">
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

interface CreateApiKeyModalProps {
  keyName: string;
  setKeyName: (name: string) => void;
  onClose: () => void;
  onCreate: () => void;
}

function CreateApiKeyModal({ keyName, setKeyName, onClose, onCreate }: CreateApiKeyModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-md bg-card border border-border rounded-xl overflow-hidden"
      >
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h2 className="text-xl font-semibold">Create New API Key</h2>
          <button type="button" onClick={onClose} className="p-1.5 text-muted-foreground hover:bg-muted rounded-md transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <InputField label="Key Name" value={keyName} onChange={setKeyName} placeholder="e.g. Production Server" />
          <p className="text-xs text-muted-foreground">A memorable name to identify this key.</p>
        </div>
        <div className="p-6 border-t border-border bg-muted/20 flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Cancel
          </button>
          <button type="button" onClick={onCreate} className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium transition-colors">
            Create Key
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive flex items-center gap-2">
      <AlertCircle size={16} className="shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function StatusPill({ active, loading }: { active: boolean; loading: boolean }) {
  if (loading) {
    return <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">Checking</span>;
  }

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${active ? "bg-nirex-success/10 text-nirex-success" : "bg-muted text-muted-foreground"}`}>
      {active ? "Enabled" : "Disabled"}
    </span>
  );
}

interface InputFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}

function InputField({ label, value, onChange, type = "text", placeholder, autoComplete, inputMode }: InputFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
      />
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium">{label}</label>
      <input
        type="text"
        value={value}
        readOnly
        className="bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-muted-foreground"
      />
    </div>
  );
}
