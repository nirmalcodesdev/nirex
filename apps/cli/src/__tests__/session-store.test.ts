import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';

describe('Session Store', () => {
  const originalHomedir = process.env.USERPROFILE ?? process.env.HOME ?? '';
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nirex-sessions-test-'));
    process.env.USERPROFILE = tempDir;
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    process.env.USERPROFILE = originalHomedir;
  });

  it('creates a session with metadata and empty transcript', async () => {
    const { createSession, readSessionMeta, readTurns } = await import('../utils/session-store.js');

    const meta = createSession({
      id: 'test-session-001',
      model: 'claude-sonnet-4-20250514',
      working_directory: '/tmp/test',
      status: 'active',
    });

    expect(meta.id).toBe('test-session-001');
    expect(meta.turn_count).toBe(0);
    expect(meta.total_tokens.total).toBe(0);
    expect(meta.status).toBe('active');

    const readMeta = readSessionMeta('test-session-001');
    expect(readMeta).not.toBeNull();
    expect(readMeta!.id).toBe('test-session-001');

    const turns = readTurns('test-session-001');
    expect(turns).toHaveLength(0);

    // Cleanup
    const { deleteSession } = await import('../utils/session-store.js');
    deleteSession('test-session-001');
  });

  it('appends turns and updates metadata correctly', async () => {
    const { createSession, appendTurn, readSessionMeta, readTurns, deleteSession } = await import('../utils/session-store.js');

    createSession({
      id: 'test-session-002',
      model: 'claude-sonnet-4-20250514',
      working_directory: '/tmp/test',
      status: 'active',
    });

    const turn = {
      turn_number: 0,
      user_message: {
        role: 'user' as const,
        content: 'Hello',
        timestamp: new Date().toISOString(),
      },
      tool_calls: [],
      tool_results: [],
      token_usage: { input: 5, output: 0, cached: 0, reasoning: 0, total: 5 },
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    };

    appendTurn('test-session-002', turn);

    const meta = readSessionMeta('test-session-002');
    expect(meta).not.toBeNull();
    expect(meta!.turn_count).toBe(1);
    expect(meta!.total_tokens.total).toBe(5);

    const turns = readTurns('test-session-002');
    expect(turns).toHaveLength(1);
    expect(turns[0].turn_number).toBe(0);
    expect(turns[0].user_message?.content).toBe('Hello');

    // Append another turn with tool calls
    const turn2 = {
      turn_number: 1,
      assistant_message: {
        role: 'assistant' as const,
        content: 'Hi!',
        timestamp: new Date().toISOString(),
      },
      tool_calls: [
        {
          id: 'tool_1',
          name: 'read_file',
          arguments: { path: '/tmp/test' },
          started_at: new Date().toISOString(),
        },
      ],
      tool_results: [
        {
          id: 'result_1',
          tool_call_id: 'tool_1',
          content: 'file contents',
          is_error: false,
          completed_at: new Date().toISOString(),
        },
      ],
      token_usage: { input: 5, output: 10, cached: 0, reasoning: 0, total: 15 },
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    };

    appendTurn('test-session-002', turn2);

    const meta2 = readSessionMeta('test-session-002');
    expect(meta2!.turn_count).toBe(2);
    expect(meta2!.tool_call_count).toBe(1);
    expect(meta2!.total_tokens.total).toBe(20);

    // Cleanup
    deleteSession('test-session-002');
  });

  it('lists all sessions', async () => {
    const { createSession, listSessions, deleteSession } = await import('../utils/session-store.js');

    createSession({
      id: 'test-session-a',
      model: 'gpt-4o',
      working_directory: '/tmp/a',
      status: 'active',
    });

    createSession({
      id: 'test-session-b',
      model: 'claude-sonnet-4-20250514',
      working_directory: '/tmp/b',
      status: 'completed',
    });

    const sessions = listSessions();
    expect(sessions.length).toBeGreaterThanOrEqual(2);
    expect(sessions.find((s) => s.id === 'test-session-a')).toBeTruthy();
    expect(sessions.find((s) => s.id === 'test-session-b')).toBeTruthy();

    // Cleanup
    deleteSession('test-session-a');
    deleteSession('test-session-b');
  });

  it('deletes sessions cleanly', async () => {
    const { createSession, readSessionMeta, deleteSession } = await import('../utils/session-store.js');

    createSession({
      id: 'test-session-del',
      model: 'gpt-4o',
      working_directory: '/tmp/del',
      status: 'active',
    });

    expect(readSessionMeta('test-session-del')).not.toBeNull();

    deleteSession('test-session-del');

    expect(readSessionMeta('test-session-del')).toBeNull();
  });
});
