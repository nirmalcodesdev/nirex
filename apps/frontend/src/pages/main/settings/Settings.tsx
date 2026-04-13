// Settings Page - Account settings and preferences
import { useState } from "react";
import {
  User,
  Shield,
  Key,
  CheckCircle2,
  Menu,
  X,
  Monitor,
  Moon,
  Sun,
  Laptop,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "@nirex/ui";
import { useToast } from "../../../components/ToastProvider";
import { useTheme } from "../../../components/ui/ThemeProvider";

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

export function Settings() {
  const [activeTab, setActiveTab] = useState("profile");
  const [isSaved, setIsSaved] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCreateApiKeyModalOpen, setIsCreateApiKeyModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  const handleSave = () => {
    setIsSaved(true);
    toast("Settings saved successfully.", "success");
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleTabChange = (id: string) => {
    setActiveTab(id);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-6 lg:gap-8 pb-8 sm:pb-12 py-2 sm:py-4 lg:py-5 px-3 mx-auto">
      <PageHeader
        title="Settings"
        description="Manage your account settings and preferences."
      />

      <div className="flex flex-col md:flex-row gap-6 sm:gap-8 relative">
        {/* Mobile Sidebar Toggle */}
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
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-1.5 hover:bg-muted rounded-md transition-colors"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Sidebar */}
        <div
          className={`
          md:w-64 flex-col gap-1 shrink-0
          ${isMobileMenuOpen
              ? "flex absolute top-14 left-0 right-0 z-10 bg-card border border-border p-2 rounded-lg"
              : "hidden md:flex"
            }
        `}
        >
          {settingsNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive
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

        {/* Content */}
        <div className="flex-1 min-w-0">
          {activeTab === "profile" && (
            <ProfileSettings onSave={handleSave} isSaved={isSaved} />
          )}

          {activeTab === "appearance" && (
            <AppearanceSettings theme={theme} setTheme={setTheme} />
          )}

          {activeTab === "api-keys" && (
            <ApiKeysSettings
              onCreateKey={() => setIsCreateApiKeyModalOpen(true)}
            />
          )}

          {activeTab === "security" && <SecuritySettings onSave={handleSave} />}
        </div>
      </div>

      {/* Create API Key Modal */}
      <AnimatePresence>
        {isCreateApiKeyModalOpen && (
          <CreateApiKeyModal
            keyName={newKeyName}
            setKeyName={setNewKeyName}
            onClose={() => setIsCreateApiKeyModalOpen(false)}
            onCreate={() => {
              toast(
                `API Key "${newKeyName || "New Key"}" created successfully.`,
                "success"
              );
              setIsCreateApiKeyModalOpen(false);
              setNewKeyName("");
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Sub-components
interface ProfileSettingsProps {
  onSave: () => void;
  isSaved: boolean;
}

function ProfileSettings({ onSave, isSaved }: ProfileSettingsProps) {
  const { toast } = useToast();

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-5 sm:p-6 border-b border-border">
        <h2 className="text-lg sm:text-xl font-medium mb-1">Profile Settings</h2>
        <p className="text-sm text-muted-foreground">
          Update your personal information and public profile.
        </p>
      </div>

      <div className="p-5 sm:p-6 flex flex-col gap-6">
        {/* Avatar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-nirex-accent to-nirex-accent-hi flex-shrink-0 border-4 border-background" />
          <div className="flex flex-col gap-2">
            <button
              onClick={() => toast("Avatar upload dialog opened.", "info")}
              className="bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg px-4 py-2 text-sm font-medium transition-colors w-fit"
            >
              Change Avatar
            </button>
            <p className="text-xs text-muted-foreground">
              JPG, GIF or PNG. 1MB max.
            </p>
          </div>
        </div>

        {/* Name Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <FormField label="First Name" defaultValue="John" />
          <FormField label="Last Name" defaultValue="Doe" />
        </div>

        {/* Email */}
        <FormField
          label="Email Address"
          type="email"
          defaultValue="john@example.com"
          hint="This email will be used for account-related notifications."
        />

        {/* Bio */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Bio</label>
          <textarea
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow min-h-[100px] resize-y"
            placeholder="Tell us a little bit about yourself..."
            defaultValue="Senior Developer at TechCorp. Building awesome CLI tools."
          />
        </div>
      </div>

      {/* Footer */}
      <div className="p-5 sm:p-6 border-t border-border bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground text-center sm:text-left">
          Please save your changes to apply them.
        </p>
        <div className="flex items-center gap-4 w-full sm:w-auto">
          {isSaved && (
            <span className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-nirex-success animate-in fade-in slide-in-from-right-4">
              <CheckCircle2 size={16} /> Saved
            </span>
          )}
          <button
            onClick={onSave}
            className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-6 py-2 text-sm font-medium transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
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
        <p className="text-sm text-muted-foreground">
          Customize the look and feel of your dashboard.
        </p>
      </div>
      <div className="p-5 sm:p-6 flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <label className="text-sm font-medium">Theme Preference</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${theme === t.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 bg-background"
                  }`}
              >
                <t.icon
                  size={24}
                  className={
                    theme === t.id ? "text-primary" : "text-muted-foreground"
                  }
                />
                <span className="text-sm font-medium">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
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
    {
      name: "Production Key",
      key: "nrx_live_********************",
      created: "Oct 12, 2025",
    },
    {
      name: "Development Key",
      key: "nrx_test_********************",
      created: "Jan 05, 2026",
    },
  ];

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-5 sm:p-6 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-medium mb-1">API Keys</h2>
          <p className="text-sm text-muted-foreground">
            Manage your secret keys for API access.
          </p>
        </div>
        <button
          onClick={onCreateKey}
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap"
        >
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
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {key.key}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{key.created}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => toast("API key revoked.", "success")}
                      className="text-sm font-medium text-nirex-error hover:underline"
                    >
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

interface SecuritySettingsProps {
  onSave: () => void;
}

function SecuritySettings({ onSave }: SecuritySettingsProps) {
  const { toast } = useToast();

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-5 sm:p-6 border-b border-border">
        <h2 className="text-lg sm:text-xl font-medium mb-1">Security</h2>
        <p className="text-sm text-muted-foreground">
          Manage your password and security preferences.
        </p>
      </div>
      <div className="p-5 sm:p-6 flex flex-col gap-6">
        <FormField
          label="Current Password"
          type="password"
          placeholder="••••••••"
          maxWidth
        />
        <FormField
          label="New Password"
          type="password"
          placeholder="••••••••"
          maxWidth
        />
        <FormField
          label="Confirm New Password"
          type="password"
          placeholder="••••••••"
          maxWidth
        />

        <div className="pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium">Two-Factor Authentication</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Add an extra layer of security to your account.
              </p>
            </div>
            <button
              onClick={() => toast("2FA setup initiated.", "info")}
              className="bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              Enable 2FA
            </button>
          </div>
        </div>
      </div>
      <div className="p-5 sm:p-6 border-t border-border bg-muted/20 flex justify-end">
        <button
          onClick={onSave}
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-6 py-2 text-sm font-medium transition-colors"
        >
          Update Password
        </button>
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

function CreateApiKeyModal({
  keyName,
  setKeyName,
  onClose,
  onCreate,
}: CreateApiKeyModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-md bg-card border border-border rounded-xl overflow-hidden"
      >
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h2 className="text-xl font-semibold">Create New API Key</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:bg-muted rounded-md transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Key Name</label>
            <input
              type="text"
              placeholder="e.g. Production Server"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
            />
            <p className="text-xs text-muted-foreground">
              A memorable name to identify this key.
            </p>
          </div>
        </div>
        <div className="p-6 border-t border-border bg-muted/20 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onCreate}
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            Create Key
          </button>
        </div>
      </motion.div>
    </div>
  );
}

interface FormFieldProps {
  label: string;
  type?: string;
  defaultValue?: string;
  placeholder?: string;
  hint?: string;
  maxWidth?: boolean;
}

function FormField({
  label,
  type = "text",
  defaultValue,
  placeholder,
  hint,
  maxWidth,
}: FormFieldProps) {
  return (
    <div className={`flex flex-col gap-2 ${maxWidth ? "max-w-md" : ""}`}>
      <label className="text-sm font-medium">{label}</label>
      <input
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
      />
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}
