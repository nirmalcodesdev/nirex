/**
 * Local Session Store
 *
 * Manages local session transcript storage as JSONL files.
 * Format per the PRODUCTION_CLI_PLAN:
 * - Transcripts: ~/.nirex/sessions/<id>.jsonl (one JSON object per line)
 * - Metadata:    ~/.nirex/sessions/<id>.meta.json
 *
 * Each JSONL line is a conversation turn containing:
 *   user message, assistant response, tool calls, tool results
 *
 * Auto-save after every turn (crash-resilient by design).
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  appendFileSync,
  readdirSync,
  unlinkSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

const SESSIONS_DIR = join(homedir(), '.nirex', 'sessions');

// ============================================================================
// Types
// ============================================================================

export interface SessionMeta {
  id: string;
  model: string;
  working_directory: string;
  git_branch?: string;
  total_tokens: TokenCounter;
  turn_count: number;
  tool_call_count: number;
  created_at: string;
  updated_at: string;
  last_turn_at: string;
  status: 'active' | 'completed' | 'archived';
  tags?: string[];
}

export interface TokenCounter {
  input: number;
  output: number;
  cached: number;
  reasoning: number;
  total: number;
}

export interface SessionTurn {
  turn_number: number;
  user_message?: TurnMessage;
  assistant_message?: TurnMessage;
  tool_calls: TurnToolCall[];
  tool_results: TurnToolResult[];
  token_usage: TokenCounter;
  started_at: string;
  completed_at?: string;
  permission_decisions?: TurnPermissionDecision[];
  error?: string;
}

export interface TurnMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: string;
  provider_message_id?: string;
}

export interface TurnToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  started_at: string;
}

export interface TurnToolResult {
  id: string;
  tool_call_id: string;
  content: string;
  is_error: boolean;
  completed_at: string;
}

export interface TurnPermissionDecision {
  request_id: string;
  tool_name: string;
  action: 'allow' | 'deny' | 'ask';
  reason?: string;
  timestamp: string;
}

// ============================================================================
// Session Store
// ============================================================================

function ensureSessionsDir(): void {
  if (!existsSync(SESSIONS_DIR)) {
    mkdirSync(SESSIONS_DIR, { recursive: true });
  }
}

function sessionPath(sessionId: string): string {
  return join(SESSIONS_DIR, `${sessionId}.jsonl`);
}

function metaPath(sessionId: string): string {
  return join(SESSIONS_DIR, `${sessionId}.meta.json`);
}

export function createSession(meta: Omit<SessionMeta, 'total_tokens' | 'turn_count' | 'tool_call_count' | 'created_at' | 'updated_at' | 'last_turn_at'>): SessionMeta {
  ensureSessionsDir();

  const now = new Date().toISOString();
  const sessionMeta: SessionMeta = {
    ...meta,
    total_tokens: { input: 0, output: 0, cached: 0, reasoning: 0, total: 0 },
    turn_count: 0,
    tool_call_count: 0,
    created_at: now,
    updated_at: now,
    last_turn_at: now,
  };

  writeFileSync(sessionPath(meta.id), '', 'utf-8');
  writeFileSync(metaPath(meta.id), JSON.stringify(sessionMeta, null, 2), 'utf-8');

  return sessionMeta;
}

export function readSessionMeta(sessionId: string): SessionMeta | null {
  try {
    const raw = readFileSync(metaPath(sessionId), 'utf-8');
    return JSON.parse(raw) as SessionMeta;
  } catch {
    return null;
  }
}

export function saveSessionMeta(sessionId: string, meta: SessionMeta): void {
  writeFileSync(metaPath(sessionId), JSON.stringify(meta, null, 2), 'utf-8');
}

export function appendTurn(sessionId: string, turn: SessionTurn): void {
  ensureSessionsDir();

  const line = JSON.stringify(turn);
  appendFileSync(sessionPath(sessionId), line + '\n', 'utf-8');

  const meta = readSessionMeta(sessionId);
  if (meta) {
    meta.turn_count += 1;
    meta.tool_call_count += turn.tool_calls.length;
    meta.total_tokens.input += turn.token_usage.input;
    meta.total_tokens.output += turn.token_usage.output;
    meta.total_tokens.cached += turn.token_usage.cached;
    meta.total_tokens.reasoning += turn.token_usage.reasoning;
    meta.total_tokens.total += turn.token_usage.total;
    meta.updated_at = new Date().toISOString();
    meta.last_turn_at = turn.completed_at ?? turn.started_at;
    saveSessionMeta(sessionId, meta);
  }
}

export function readTurns(sessionId: string): SessionTurn[] {
  try {
    const raw = readFileSync(sessionPath(sessionId), 'utf-8');
    const lines = raw.trim().split('\n').filter(Boolean);
    return lines.map((line: string) => JSON.parse(line) as SessionTurn);
  } catch {
    return [];
  }
}

export function listSessions(): SessionMeta[] {
  ensureSessionsDir();

  try {
    const entries = readdirSync(SESSIONS_DIR);
    const metaFiles = entries.filter((f) => f.endsWith('.meta.json'));

    return metaFiles
      .map((f) => {
        const id = f.replace('.meta.json', '');
        return readSessionMeta(id);
      })
      .filter(Boolean) as SessionMeta[];
  } catch {
    return [];
  }
}

export function deleteSession(sessionId: string): void {
  try {
    unlinkSync(sessionPath(sessionId));
    unlinkSync(metaPath(sessionId));
  } catch {
    // Ignore errors if files don't exist
  }
}
