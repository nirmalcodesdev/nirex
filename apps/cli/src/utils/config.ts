/**
 * CLI Configuration Manager
 *
 * Loads, merges, and writes Nirex CLI configuration from:
 * 1. Default built-in values
 * 2. Global config: ~/.nirex/config.json
 * 3. Project config: ./.nirexrc.json (highest precedence)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import {
  type NirexCliConfig,
  DEFAULT_CLI_CONFIG,
} from '../types/config.js';

const GLOBAL_CONFIG_DIR = join(homedir(), '.nirex');
const GLOBAL_CONFIG_PATH = join(GLOBAL_CONFIG_DIR, 'config.json');
const PROJECT_CONFIG_PATH = '.nirexrc.json';

function deepMerge<T extends Record<string, unknown>>(base: T, override: Partial<T>): T {
  const result = { ...base } as Record<string, unknown>;
  for (const key of Object.keys(override)) {
    const baseVal = result[key];
    const overrideVal = (override as Record<string, unknown>)[key];
    if (
      baseVal !== null &&
      typeof baseVal === 'object' &&
      !Array.isArray(baseVal) &&
      overrideVal !== null &&
      typeof overrideVal === 'object' &&
      !Array.isArray(overrideVal)
    ) {
      result[key] = deepMerge(
        baseVal as Record<string, unknown>,
        overrideVal as Record<string, unknown>,
      );
    } else if (overrideVal !== undefined) {
      result[key] = overrideVal;
    }
  }
  return result as T;
}

function ensureGlobalConfigDir(): void {
  if (!existsSync(GLOBAL_CONFIG_DIR)) {
    mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true });
  }
}

function loadJsonFile<T>(path: string): T | null {
  try {
    const raw = readFileSync(path, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function saveJsonFile(path: string, data: unknown): void {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
}

let cachedConfig: NirexCliConfig | null = null;

export function loadConfig(): NirexCliConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  let config = { ...DEFAULT_CLI_CONFIG } as NirexCliConfig;

  const globalConfig = loadJsonFile<Partial<NirexCliConfig>>(GLOBAL_CONFIG_PATH);
  if (globalConfig) {
    config = deepMerge(
      config as unknown as Record<string, unknown>,
      globalConfig as unknown as Record<string, unknown>,
    ) as unknown as NirexCliConfig;
  }

  const projectConfig = loadJsonFile<Partial<NirexCliConfig>>(PROJECT_CONFIG_PATH);
  if (projectConfig) {
    config = deepMerge(
      config as unknown as Record<string, unknown>,
      projectConfig as unknown as Record<string, unknown>,
    ) as unknown as NirexCliConfig;
  }

  cachedConfig = config;
  return config;
}

export function saveGlobalConfig(config: Partial<NirexCliConfig>): void {
  ensureGlobalConfigDir();

  let existing = loadJsonFile<NirexCliConfig>(GLOBAL_CONFIG_PATH) ?? DEFAULT_CLI_CONFIG;
  existing = deepMerge(
    existing as unknown as Record<string, unknown>,
    config as unknown as Record<string, unknown>,
  ) as unknown as NirexCliConfig;

  saveJsonFile(GLOBAL_CONFIG_PATH, existing);
  cachedConfig = existing;
}

export function saveProjectConfig(config: Partial<NirexCliConfig>): void {
  let existing = loadJsonFile<NirexCliConfig>(PROJECT_CONFIG_PATH) ?? ({} as NirexCliConfig);
  existing = deepMerge(
    existing as unknown as Record<string, unknown>,
    config as unknown as Record<string, unknown>,
  ) as unknown as NirexCliConfig;

  saveJsonFile(PROJECT_CONFIG_PATH, existing);
}

export function invalidateConfigCache(): void {
  cachedConfig = null;
}

export function getConfigPaths(): { global: string; project: string } {
  return {
    global: GLOBAL_CONFIG_PATH,
    project: PROJECT_CONFIG_PATH,
  };
}
