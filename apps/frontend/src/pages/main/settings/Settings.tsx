import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  Clipboard,
  Key,
  Laptop,
  LogOut,
  Menu,
  Monitor,
  Moon,
  RefreshCw,
  Shield,
  Smartphone,
  Sun,
  Trash2,
  User,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { PageHeader, SectionCard, StatusBadge } from "@nirex/ui";
import {
  changePasswordSchema,
  PASSWORD_POLICY,
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
import { ApiKeysSettings } from "./ApiKeysSettings";
import { PasswordPolicyFeedback } from "../../../components/auth/PasswordPolicyFeedback";

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
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams.get("tab");
    const validTabs = settingsNav.map((n) => n.id);
    return tab && validTabs.includes(tab) ? tab : "profile";
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  const handleTabChange = (id: string) => {
    setActiveTab(id);
    setIsMobileMenuOpen(false);
  };

  const activeNavItem = settingsNav.find((n) => n.id === activeTab);

  return (
    <div className="flex flex-col gap-6 lg:gap-8 py-4 sm:py-6 lg:py-8 px-3 mx-auto max-w-[1600px]">
      <PageHeader title="Settings" description="Account settings." />

      <div className="flex flex-col md:flex-row gap-6 sm:gap-8 relative">
        {/* Mobile Tab Selector */}
        <div className="md:hidden">
          <div className="flex items-center justify-between bg-card border border-border p-3">
            <div className="flex items-center gap-2 font-medium">
              {activeNavItem && <activeNavItem.icon size={18} />}
              {activeNavItem?.label}
            </div>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-1.5 hover:bg-muted transition-colors"
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

          {isMobileMenuOpen && (
            <div className="mt-2 bg-card border border-border p-2 z-20">
              {settingsNav.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleTabChange(item.id)}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors w-full text-left ${ isActive ? "bg-nirex-accent/10 text-nirex-accent" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground" }`}
                  >
                    <Icon size={16} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Desktop Sidebar */}
        <div className="hidden md:flex md:w-64 flex-col gap-1 shrink-0">
          {settingsNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleTabChange(item.id)}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left border-l-2 ${ isActive ? "border-l-primary bg-muted/60 text-foreground" : "border-l-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground" }`}
              >
                <div className={`flex items-center justify-center w-6 h-6 ${isActive ? 'bg-primary/10' : 'bg-muted/60'}`}>
                  <Icon size={14} className={isActive ? "text-primary" : "text-muted-foreground"} />
                </div>
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 min-w-0">
          {activeTab === "profile" && <ProfileSettings />}
          {activeTab === "appearance" && <AppearanceSettings theme={theme} setTheme={setTheme} />}
          {activeTab === "security" && <SecuritySettings />}
          {activeTab === "api-keys" && <ApiKeysSettings />}
        </div>
      </div>
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
    <SectionCard
      title="Profile Settings"
      icon={User}
      footer={
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground text-center sm:text-left">
            Changes apply immediately across signed-in sessions.
          </p>
          <div className="flex items-center gap-4 w-full sm:w-auto">
            {saved && (
              <span className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={16} /> Saved
              </span>
            )}
            <button
              type="submit"
              disabled={isSaving}
              className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-2 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
            <UserAvatar className="w-20 h-20 text-2xl" name={user?.fullName} />
            <div>
              <p className="text-sm font-medium">{user?.email ?? "Signed in account"}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {user?.isEmailVerified ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={12} /> Email verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <AlertCircle size={12} /> Email verification pending
                  </span>
                )}
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
      </form>
    </SectionCard>
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
    <SectionCard
      title="Appearance"
      icon={Monitor}
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <label className="text-sm font-medium">Theme Preference</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {themes.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTheme(item.id)}
                className={`flex flex-col items-center gap-3 p-4 border-2 transition-all ${ theme === item.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 bg-background" }`}
              >
                <div className={`flex items-center justify-center w-10 h-10 ${theme === item.id ? 'bg-primary/10' : 'bg-muted/60'}`}>
                  <item.icon size={22} className={theme === item.id ? "text-primary" : "text-muted-foreground"} />
                </div>
                <span className="text-sm font-medium">{item.label}</span>
                {theme === item.id && (
                  <span className="text-[10px] uppercase tracking-wider text-primary font-medium">Active</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </SectionCard>
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
    <SectionCard
      title="Password"
      icon={Shield}
      footer={
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-2 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isSaving ? "Updating..." : "Update Password"}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-4 max-w-xl">
          {error && <InlineError message={error} />}
          <InputField label="Current password" type="password" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" spellCheck={false} />
          <InputField
            label="New password"
            type="password"
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
            minLength={PASSWORD_POLICY.minLength}
            maxLength={PASSWORD_POLICY.maxLength}
            spellCheck={false}
          />
          <PasswordPolicyFeedback password={newPassword} compact />
          <InputField
            label="Confirm new password"
            type="password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
            minLength={PASSWORD_POLICY.minLength}
            maxLength={PASSWORD_POLICY.maxLength}
            spellCheck={false}
          />
        </div>
      </form>
    </SectionCard>
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
    <SectionCard
      title="Two-Factor Authentication"
      icon={Shield}
      headerAction={
        <StatusBadge
          label={isLoading ? "Checking" : status?.enabled ? "Enabled" : "Disabled"}
          variant={isLoading ? "neutral" : status?.enabled ? "success" : "neutral"}
        />
      }
    >

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
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isWorking ? "Starting..." : "Enable 2FA"}
            </button>
          </div>
        )}

        {setup && (
          <div className="space-y-5 border border-border p-4 bg-background">
            <div className="grid gap-5 lg:grid-cols-[260px_1fr] lg:items-center">
              <div className="mx-auto border border-border bg-background p-4">
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
                  Use an authenticator app. After scanning, enter the 6-digit code.
                </p>
                <p className="text-xs text-muted-foreground mt-3">
                  Expires {formatDate(setup.expiresAt)}.
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
              <button type="button" onClick={() => setSetup(null)} className=" border border-border px-4 py-2 text-sm font-medium hover:bg-muted">Cancel</button>
              <button type="button" onClick={() => void verifySetup()} disabled={isWorking} className=" bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                {isWorking ? "Verifying..." : "Verify and Enable"}
              </button>
            </div>
          </div>
        )}

        {backupCodes.length > 0 && (
          <div className="border border-nirex-warning/30 p-4 bg-nirex-warning/10">
            <p className="text-sm font-medium mb-2">Save these backup codes now</p>
            <p className="text-xs text-muted-foreground mb-3">
              Each backup code can be used once if you lose access to your authenticator app. They will not be shown again.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {backupCodes.map((code) => (
                <code key={code} className=" bg-background px-3 py-2 text-sm font-mono">{code}</code>
              ))}
            </div>
            <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <button type="button" onClick={() => void copyBackupCodes()} className="inline-flex items-center justify-center gap-2 border border-border bg-background px-3 py-2 text-sm hover:bg-muted">
                <Clipboard size={14} /> Copy backup codes
              </button>
              <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={backupCodesSaved}
                  onChange={(event) => setBackupCodesSaved(event.target.checked)}
                  className="h-4 w-4 border-border text-nirex-accent focus:ring-nirex-accent"
                />
                I have saved these backup codes
              </label>
              <button
                type="button"
                disabled={!backupCodesSaved}
                onClick={() => setBackupCodes([])}
                className=" bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
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
                className="mt-3 border border-destructive/30 text-destructive hover:bg-destructive/10 px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isWorking ? "Disabling..." : "Disable 2FA"}
              </button>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
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
  const otherActiveDevices = useMemo(() => activeDevices.filter((device) => !device.isCurrent), [activeDevices]);

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
    const deviceIds = otherActiveDevices.map((device) => device.id);
    const parsed = terminateDevicesSchema.safeParse({ deviceIds, reason: "User requested sign-out from settings" });

    if (!parsed.success || deviceIds.length === 0) {
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
      toast(`${response.summary.terminated} device session(s) signed out.`, "success");
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
      toast("Signed out from all devices.", "success");
      navigate(ROUTES.AUTH.SIGNIN, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, "Unable to sign out from all devices."));
      setWorkingId(null);
    }
  };

  return (
    <SectionCard
      title="Active Devices"
      icon={Laptop}
      headerAction={
        <div className="flex gap-2">
          <button type="button" onClick={() => void loadDevices()} disabled={isLoading} className="inline-flex items-center justify-center w-8 h-8 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50" title="Refresh" aria-label="Refresh device list">
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
          </button>
          <button type="button" onClick={() => void signOutOtherDevices()} disabled={workingId !== null || otherActiveDevices.length === 0} className="inline-flex items-center justify-center w-8 h-8 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50" title="Sign out others" aria-label="Sign out other devices">
            <LogOut size={14} />
          </button>
        </div>
      }
      footer={
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">Sign out everywhere if you suspect unauthorized access.</p>
          <button
            type="button"
            onClick={() => void signOutEverywhere()}
            disabled={workingId !== null || devices.length === 0}
            className=" bg-destructive text-destructive-foreground px-4 py-2 text-sm font-medium hover:bg-destructive/90 disabled:opacity-50"
          >
            {workingId === "all" ? "Signing out..." : "Sign Out Everywhere"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && <InlineError message={error} />}
        {isLoading && <p className="text-sm text-muted-foreground">Loading active devices...</p>}
        {!isLoading && devices.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Laptop size={24} className="mb-2 text-muted-foreground/60" />
            <p className="text-sm font-medium text-muted-foreground">No active devices</p>
            <p className="text-xs text-muted-foreground mt-1">Sessions from this browser and the CLI will appear here.</p>
          </div>
        )}

        <div className="space-y-3">
          {devices.map((device) => (
            <div key={device.id} className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border border-border bg-background p-4">
              <div className="flex gap-3 min-w-0">
                <div className="h-10 w-10 bg-muted flex items-center justify-center shrink-0">
                  {device.deviceInfo.toLowerCase().includes("mobile") ? <Smartphone size={18} /> : <Laptop size={18} />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{device.deviceInfo}</p>
                    {device.isCurrent && <StatusBadge label="Current" variant="info" />}
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
                className="inline-flex items-center justify-center gap-2 border border-destructive/30 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
              >
                <Trash2 size={14} />
                {workingId === device.id ? "Revoking..." : device.isCurrent ? "Sign Out" : "Revoke"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <div className=" border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive flex items-center gap-2">
      <AlertCircle size={16} className="shrink-0" />
      <span>{message}</span>
    </div>
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
  minLength?: number;
  maxLength?: number;
  spellCheck?: boolean;
}

function InputField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  inputMode,
  minLength,
  maxLength,
  spellCheck,
}: InputFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        minLength={minLength}
        maxLength={maxLength}
        spellCheck={spellCheck}
        onChange={(event) => onChange(event.target.value)}
        className="bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
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
        className="bg-muted/50 border border-border px-3 py-2 text-sm text-muted-foreground"
      />
    </div>
  );
}
