/**
 * CLI Configuration Types
 *
 * Configuration schema for the Nirex CLI tool, supporting both
 * global (~/.nirex/config.json) and project-level (.nirexrc.json) config.
 */

export interface NirexCliConfig {
  backend?: BackendConfig;
  agent?: AgentCliConfig;
  ui?: UIConfig;
  sessions?: SessionsConfig;
  permissions?: PermissionCliConfig;
}

export interface BackendConfig {
  baseUrl: string;
  apiKey?: string;
  wsUrl?: string;
  timeoutMs: number;
}

export interface AgentCliConfig {
  model: string;
  maxTurns: number;
  temperature: number;
  systemPrompt?: string;
  maxContextTokens: number;
}

export interface UIConfig {
  color: boolean;
  progressBars: boolean;
  compact: boolean;
}

export interface SessionsConfig {
  directory: string;
  autoSave: boolean;
  compressOld: boolean;
}

export interface PermissionCliConfig {
  defaultAction: 'allow' | 'deny' | 'ask';
  autoAllowTools: string[];
  autoDenyTools: string[];
  askTimeoutMs: number;
}

export const DEFAULT_CLI_CONFIG: NirexCliConfig = {
  backend: {
    baseUrl: 'http://localhost:3001/api/v1',
    wsUrl: 'ws://localhost:3001',
    timeoutMs: 30000,
  },
  agent: {
    model: 'claude-sonnet-4-20250514',
    maxTurns: 25,
    temperature: 0,
    maxContextTokens: 128000,
  },
  ui: {
    color: true,
    progressBars: true,
    compact: false,
  },
  sessions: {
    directory: '~/.nirex/sessions',
    autoSave: true,
    compressOld: true,
  },
  permissions: {
    defaultAction: 'ask',
    autoAllowTools: [],
    autoDenyTools: [],
    askTimeoutMs: 60000,
  },
};
