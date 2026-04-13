
export interface Template {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
}

export interface TerminalStep {
  text: string;
  type: "command" | "output" | "success" | "empty" | "link";
  delay: number;
}

export interface OnboardingPreferences {
  emailNotifications: boolean;
  weeklyReports: boolean;
  betaAccess: boolean;
}

export interface TerminalLine {
  text: string;
  type: string;
}
