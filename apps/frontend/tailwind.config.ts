import type { Config } from "tailwindcss";
import sharedConfig from "@nirex/tailwind-config";

const config: Config = {
  ...sharedConfig,
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
};

export default config;
