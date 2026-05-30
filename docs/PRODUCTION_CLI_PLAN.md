# Nirex CLI — Production-Grade AI Coding Tool: Phased Execution Plan

> **Status**: Living document — update as phases complete.  
> **Inspired by**: Claude Code (Anthropic), Codex CLI (OpenAI), Aider (independent open-source)  
> **Goal**: Build a CLI coding agent that matches or surpasses Claude Code quality, powered by our own thick backend.

---

## Table of Contents

1. [Where We Are Today](#where-we-are-today)
2. [Target Architecture Diagram](#target-architecture-diagram)
3. [Phase 0 — Foundation Audit (Week 1)](#phase-0--foundation-audit-week-1)
4. [Phase 1 — AI Model Proxy + Streaming (Weeks 2–4)](#phase-1--ai-model-proxy--streaming-weeks-24)
5. [Phase 2 — Tool Execution Engine (Weeks 5–7)](#phase-2--tool-execution-engine-weeks-57)
6. [Phase 3 — Agent Loop + CLI Agent MVP (Weeks 8–11)](#phase-3--agent-loop--cli-agent-mvp-weeks-811)
7. [Phase 4 — Repository Intelligence (Weeks 12–14)](#phase-4--repository-intelligence-weeks-1214)
8. [Phase 5 — Sandboxing & Security (Weeks 15–17)](#phase-5--sandboxing--security-weeks-1517)
9. [Phase 6 — Context Window Mastery (Weeks 18–20)](#phase-6--context-window-mastery-weeks-1820)
10. [Phase 7 — Advanced Agent Features (Weeks 21–25)](#phase-7--advanced-agent-features-weeks-2125)
11. [Phase 8 — Production Hardening (Weeks 26–30)](#phase-8--production-hardening-weeks-2630)
12. [Phase 9 — Enterprise & Scale (Weeks 31–36)](#phase-9--enterprise--scale-weeks-3136)
13. [Phase 10 — Moonshots (Ongoing)](#phase-10--moonshots-ongoing)

---

## Where We Are Today

### What Nirex Already Has (Strengths)

| Capability | Status | Details |
|-----------|--------|---------|
| User auth | **Done** | Email/password, Google/GitHub OAuth, 2FA, JWT rotation |
| Billing | **Done** | Stripe subscriptions, plans, credits, invoices, webhooks |
| Chat sessions | **Done** | CRUD, messages, forking, resuming, checkpoints, export/import |
| Usage tracking | **Done** | Token counting, credit deduction, rolling windows, request logs |
| Message encryption | **Done** | AES-256-GCM, auto PII detection |
| SSE infrastructure | **Done** | Redis-backed pub/sub for real-time streaming |
| Rate limiting | **Done** | 11 Redis-based limiters (auth, API, messages, search, etc.) |
| API keys | **Done** | Scoped HMAC-SHA256 API keys for programmatic access |
| CLI scaffold | **Partial** | Commander.js with hello + billing-check commands |
| Monorepo tooling | **Done** | Turborepo, pnpm workspace, shared types package |

### What's Missing (Gaps)

| Capability | Needed For |
|-----------|-----------|
| AI model proxy | Calling OpenAI, Anthropic, Google, etc. from unified interface |
| Tool execution engine | Running file ops, bash, git, LSP commands on behalf of the AI |
| Agent loop | Multi-turn autonomous reasoning with tool use |
| CLI TUI / REPL | Interactive chat-like coding experience |
| Repository intelligence | Repo map, tree-sitter symbol extraction, context ranking |
| Sandboxed execution | Safely running code and terminal commands |
| Context window management | Compaction, summarization, checkpoint compression |
| Multi-model routing | Choosing cheapest/smartest model per task |
| Permission system | Granular tool approval with user-defined rules |
| Hooks system | Lifecycle event callbacks for extensibility |

### Relevant Existing Files

| File | Purpose |
|------|---------|
| `apps/backend/docs/THICK_BACKEND_ARCHITECTURE.md` | Existing architecture blueprint |
| `apps/backend/src/modules/chat-session/` | Chat session service (extensible for agent) |
| `apps/backend/src/modules/usage/` | Usage + quota services (ready for AI metering) |
| `apps/backend/src/middleware/deductCredit.ts` | Per-request credit deduction |
| `apps/backend/src/modules/chat-session/services/sse-manager.ts` | SSE pub/sub ready for AI streaming |
| `apps/cli/src/index.ts` | CLI entry point to evolve into full agent CLI |
| `packages/shared/src/` | Shared types (AIModel, ChatMessage — extend for tools) |

---

## Target Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                             CLI AGENT (Nirex)                                 │
│                                                                              │
│  ┌──────────┐  ┌──────────────┐  ┌──────────┐  ┌──────────────────┐        │
│  │   TUI    │  │  Agent Loop  │  │   Repo   │  │  Permission      │        │
│  │ (Ink/RT) │  │ (reasoning)  │  │   Intel  │  │  Manager         │        │
│  └────┬─────┘  └──────┬───────┘  │(tree-sit)│  └────────┬─────────┘        │
│       │               │          └────┬─────┘           │                  │
│       └───────────────┴───────────────┴─────────────────┘                  │
│                                │                                             │
│  ┌────────────────────────────┐│┌────────────────────────────┐              │
│  │    Local Session Store     │││       Tool Executor        │              │
│  │  ~/.nirex/sessions/*.jsonl │││  ┌──────┬──────┬──────┐   │              │
│  │  (primary, always-on)      │││  │ File │ Bash │ Git  │   │              │
│  │                            │││  └──────┴──────┴──────┘   │              │
│  └─────────────┬──────────────┘││  ┌──────┬──────┬──────┐   │              │
│                │sync/export    ││  │ LSP  │ Sand │ Web  │   │              │
│                │(user-driven)  ││  └──────┴──────┴──────┘   │              │
│                │               │└────────────────────────────┘              │
└────────────────┼───────────────┼─────────────────────────────────────────────┘
                 │               │ WS/SSE/HTTP
┌────────────────┼───────────────┼─────────────────────────────────────────────┐
│                │     NIREX BACKEND                                           │
│                │                                                            │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐  ┌───────────┐        │
│  │  Model Proxy │  │   Context   │  │ Cloud Session│  │  Credits  │        │
│  │  (multi-AI)  │  │   Manager   │  │ Storage(opt) │  │  + Billing│        │
│  └──────┬───────┘  └──────┬──────┘  └──────┬───────┘  └─────┬─────┘        │
│         │                 │                │                │               │
│    ┌────┴────┐       ┌────┴────┐      ┌────┴────┐      ┌───┴─────┐         │
│    │OpenAI   │       │Compact  │      │MongoDB  │      │ Stripe  │         │
│    │Anthropic│       │Summarize│      │  (push  │      │ Credits │         │
│    │Google   │       │Checkpt  │      │ on-demand)     └─────────┘         │
│    │Local    │       └─────────┘      └─────────┘                          │
│    └─────────┘                                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 0 — Foundation Audit (Week 1)

**Goal**: Validate the current codebase is ready to support the agent architecture. Fill obvious gaps before building new features.

### 0.1 — Type System Expansion
- [ ] Extend `@nirex/shared` types to include tool definitions, tool call, agent state
  ```typescript
  // New types needed in packages/shared/src/
  ToolDefinition, ToolCall, ToolResult, AgentState,
  PermissionRule, HookEvent, SandboxConfig
  ```
- [ ] Add `AgentMessage` type extending `ChatMessage` with tool-use/tool-result
- [ ] Define `StreamEvent` union type for SSE streaming contract

### 0.2 — Backend Readiness
- [ ] Audit all existing chat-session routes for scalability (indexes, query patterns)
- [ ] Validate Redis pub/sub handles WebSocket upgrade (not just SSE)
- [ ] Ensure message encryption works correctly with tool-result messages
- [ ] Add database indexes for agent-specific queries (session_id + turn_number)

### 0.3 — CLI Readiness
- [ ] Extract CLI into proper module structure (`src/commands/`, `src/utils/`, `src/services/`)
- [ ] Add WebSocket client library (`ws` or `socket.io-client`)
- [ ] Add ANSI rendering library for TUI (`ink`, `blessed`, or `terminal-kit`)
- [ ] Set up CLI config file format (`.nirexrc.json` or `config.toml`)
- [ ] Define local session storage format:
  - Session transcripts as **JSONL files** in `~/.nirex/sessions/<id>.jsonl`
  - Each line = one conversation turn (user message, assistant response, tool calls, tool results)
  - Session metadata (model, tokens, timestamps) in `~/.nirex/sessions/<id>.meta.json`
  - Auto-save after every turn (crash-resilient by design)

### 0.4 — Developer Experience
- [ ] Set up integration test framework across CLI ↔ Backend
- [ ] Add E2E test harness for full agent loop (mock LLM responses)
- [ ] Create development fixtures (sample projects, recorded LLM conversations)

**Checkpoint**: All tests pass. CLI has modular structure. Types are extended.

---

## Phase 1 — AI Model Proxy + Streaming (Weeks 2–4)

**Goal**: Build the foundation layer that lets the backend talk to any AI provider with unified interface.

> **Maps to THICK_BACKEND_ARCHITECTURE.md Phase 1 (Model Proxy)**

### 1.1 — Provider Abstraction Interface
```typescript
// apps/backend/src/modules/ai/models/provider.interface.ts
interface AIProvider {
  readonly id: string;
  readonly models: string[];
  chat(request: ChatRequest): Promise<ChatResponse>;
  chatStream(request: ChatRequest): AsyncIterable<StreamChunk>;
  complete(request: CompleteRequest): Promise<CompleteResponse>;
  embed(request: EmbedRequest): Promise<EmbedResponse>;
  tokenCount(text: string, model: string): number;
  healthCheck(): Promise<boolean>;
}
```

- [ ] Define `ChatRequest`, `ChatResponse`, `StreamChunk` types in shared package
- [ ] Define `ToolDefinition` schema (JSON Schema compatible with OpenAI/Anthropic formats)
- [ ] Build abstract base with shared logic (rate limiting, retry, transformation)

### 1.2 — Provider Implementations
- [ ] **OpenAI provider**: GPT-4o, GPT-4.1, o3/o4-mini, all via `/v1/chat/completions`
  - Tool use via `tools` + `tool_choice` params
  - Response format switching (`json_object`, `json_schema`)
  - Reasoning effort parameter for o-series
- [ ] **Anthropic provider**: Claude Opus 4, Sonnet 4, Haiku 3.5 via `/v1/messages`
  - Tool use via `tools` + `tool_choice`
  - Prompt caching support (`cache_control` breakpoints)
  - Extended thinking (`thinking` parameter)
- [ ] **Google provider**: Gemini 2.5 Pro, Flash via `/v1beta/models/`
  - Tool use via `tools.functionDeclarations`
  - `response_schema` for structured output
- [ ] **Local provider** (future): Ollama, LM Studio compatible

### 1.3 — Model Router & Failover
```typescript
// apps/backend/src/modules/ai/router/
class ModelRouter {
  route(preferences: RoutingPreference): AIProvider;
  failover(failedProvider: string, request: ChatRequest): AIProvider;
  selectByCapability(requiredTools: string[]): AIProvider;
  selectByBudget(maxCredits: number): { provider: AIProvider; model: string };
}
```

- [ ] Implement round-robin + priority-based routing
- [ ] Health check loop (every 30s) — auto-remove unhealthy providers
- [ ] Circuit breaker pattern (3 failures = 60s cooldown)
- [ ] `GET /api/ai/models` — list available models with capabilities and credit costs

### 1.4 — Streaming Pipeline
```
Client ←── SSE/WS ──→ Backend ←── SSE ──→ AI Provider
                     Stream Transformer
                     (normalize provider formats)
```

- [ ] Build `StreamNormalizer` that converts per-provider chunks to unified `StreamEvent`
- [ ] SSE endpoint: `POST /api/ai/chat/stream` (existing SSE manager can be extended)
- [ ] WebSocket endpoint: `WS /api/ai/chat/ws` (new, for persistent bidirectional)
- [ ] Stream event types (see THICK_BACKEND_ARCHITECTURE.md line 133-139):
  ```
  content_delta | tool_call_start | tool_call_result |
  tool_call_error | reasoning_start | reasoning_step | completion
  ```

### 1.5 — API Keys & Security
- [ ] Encrypted provider API key storage (AES-256, key per provider)
- [ ] Key rotation support (graceful overlap period)
- [ ] Rate limiting per provider + per model
- [ ] Token usage recording per request (input/output/reasoning tokens)

### 1.6 — Caching Layer
- [ ] Embedding cache (Redis, TTL: 7 days)
- [ ] Prompt prefix cache (Anthropic-style cache_control markers)
- [ ] Tool output cache (configurable TTL per tool type)

**Checkpoint**: Backend can fulfill a simple chat request through any of 3+ providers with streaming. Token usage is tracked.

---

## Phase 2 — Tool Execution Engine (Weeks 5–7)

**Goal**: Build the tool registry and execution system that AI models can call.

> **Maps to THICK_BACKEND_ARCHITECTURE.md Phase 2 (Basic Tools)**

### 2.1 — Tool Registry
```typescript
// apps/backend/src/modules/tools/
interface ToolExecutor {
  definition: ToolDefinition;      // JSON schema for the model
  execute(args: unknown, ctx: ExecutionContext): Promise<ToolResult>;
  validate?(args: unknown): ValidationResult;
  permission?: PermissionLevel;    // none | read_only | write | dangerous
  rateLimit?: RateLimitConfig;
}
```

- [ ] Base `ToolRegistry` class (register, list, get-by-name, validate)
- [ ] Tool schema generation (OpenAI format, Anthropic format, Google format)
- [ ] `POST /api/tools/execute` — execute a tool (with permission check)
- [ ] `GET /api/tools/registry` — list available tools for current user/session

### 2.2 — File System Tools (Tier 1)
- [ ] **file_read**: Read file contents at path
  - Range support (offset + limit for large files)
  - Image/PDF rendering (return as base64 for vision models)
  - Binary detection (skip binary files unless explicitly requested)
- [ ] **file_write**: Write/create files
  - Requires `file_read` of same file first (stale-edit guard)
  - Directory auto-creation
  - Backup creation before overwrite
- [ ] **file_edit**: Exact string replacement (not regex — safer, deterministic)
  - Same as Claude Code's Edit tool: `old_string` must match exactly once
  - Returns diff of changes
- [ ] **directory_list**: List directory with metadata
- [ ] **file_search**: Glob pattern matching
- [ ] **content_search**: Regex/grep across files (powered by ripgrep)

### 2.3 — Bash Tool (Tier 1)
- [ ] Execute shell commands as subprocess
- [ ] Working directory scoping (commands inherit session working dir)
- [ ] Output truncation at 30K chars (configurable)
- [ ] Full output saved to log file for later retrieval
- [ ] Timeout enforcement (default 120s)
- [ ] Background mode (detach process, monitor output)
- [ ] Command blocklist (`curl`, `wget`, etc. — disableable)

### 2.4 — Git Tools (Tier 2)
- [ ] **git_status**: Working tree status
- [ ] **git_diff**: Staged/unstaged diff
- [ ] **git_log**: Commit history
- [ ] **git_commit**: Create commits (requires confirmation)
- [ ] **git_branch**: Branch management
- [ ] **git_checkout**: Switch branches
- [ ] Auto-commit after successful edits (like Aider)

### 2.5 — LSP Tools (Tier 2)
- [ ] **lsp_diagnostics**: Get errors/warnings for file
- [ ] **lsp_definition**: Go to definition
- [ ] **lsp_references**: Find references
- [ ] **lsp_hover**: Type info on hover
- [ ] **lsp_rename**: Rename symbol
- [ ] **lsp_format**: Format document
- [ ] Language support: TypeScript/JavaScript first (built-in `typescript-language-server`)

### 2.6 — Web Tools (Tier 2)
- [ ] **web_search**: Search the web (powered by Brave/Bing API or Tavily)
- [ ] **web_fetch**: Fetch URL content (convert to markdown)
  - Isolated context window to prevent prompt injection
  - Domain allowlist/denylist
  - Timeout + size limits

### 2.7 — Tool Execution Context
```typescript
interface ExecutionContext {
  sessionId: string;
  userId: string;
  workingDirectory: string;
  sandboxId?: string;
  permissions: PermissionSet;
  abortSignal: AbortSignal;
}
```

- [ ] Each tool execution passes through permission gate
- [ ] Tool results include timing metadata
- [ ] All tool executions logged to audit trail
- [ ] Idempotent tool execution (avoid re-running same tool call after retry)

**Checkpoint**: All Tier 1 tools work. AI can read, write, edit, search files and run bash commands through the backend. All operations logged.

---

## Phase 3 — Agent Loop + CLI Agent MVP (Weeks 8–11)

**Goal**: Build the reasoning engine that connects the model proxy with tools, and a CLI frontend to interact with it.

> **Maps to THICK_BACKEND_ARCHITECTURE.md Phase 5 (Multi-turn Reasoning) — pulled forward because CLIs need it early**

### 3.1 — Agent Loop Engine
```typescript
// apps/backend/src/modules/agent/agent-loop.ts
class AgentLoop {
  async run(config: AgentConfig): Promise<AgentResult> {
    while (this.shouldContinue()) {
      const response = await this.modelRouter.chat(this.buildRequest());
      
      if (response.hasToolCalls()) {
        for (const call of response.toolCalls) {
          const permission = await this.permissions.check(call);
          if (!permission.allowed) continue;
          
          const result = await this.toolExecutor.execute(call);
          this.history.append(call, result);
        }
      } else {
        // Text response — stream to client, wait for next input
        this.emit('response', response.text);
        const userInput = await this.waitForInput();
        if (userInput) this.history.append(userInput);
      }
    }
  }
}
```

- [ ] Core agent loop with pluggable components (router, executor, permissions, hooks)
- [ ] State machine: `idle → planning → executing → waiting → completed | errored`
- [ ] Parallel tool execution (model requests multiple tools → execute concurrently)
- [ ] Error recovery: tool failure → inform model → retry with fixes (max 3 retries)
- [ ] Turn limits (`maxTurns`) and cost caps (`maxBudgetCredits`)
- [ ] Streaming: all intermediate states streamed to client

### 3.2 — Permission System
```typescript
// Three-tier permission model (inspired by Claude Code + Codex CLI):
enum PermissionLevel {
  ALLOW = 'allow',           // Auto-run, no prompt
  ASK = 'ask',              // Prompt user each time
  DENY = 'deny',            // Never run
}

interface PermissionRule {
  tool: string;             // Tool name or pattern
  specifier?: string;       // e.g., "npm run *" or "/src/**"
  level: PermissionLevel;
  scope: 'session' | 'project' | 'user' | 'managed';
}
```

**Permission modes** (togglable in CLI):
| Mode | Read-only | Write | Bash | Description |
|------|-----------|-------|------|-------------|
| `default` | AUTO | ASK | ASK | Standard safety |
| `acceptEdits` | AUTO | AUTO | ASK* | Auto-approve edits in workspace |
| `plan` | AUTO | DENY | DENY | Read-only planning mode |
| `auto` | AUTO | AUTO | AUTO† | Run all without prompts |
| `dontAsk` | AUTO | AUTO | DENY* | Deny anything not pre-approved |

- [ ] Rule evaluation: DENY → ASK → ALLOW (deny wins first-match)
- [ ] Scope priority: Managed > User > Project > Session
- [ ] Pattern syntax: `Bash(npm run *)`, `Edit(/src/**)`, `WebFetch(domain:docs.example.com)`
- [ ] Protected paths: `.git/`, `.env`, `*.pem`, `*.key` — DENY by default

### 3.3 — Hooks System
```typescript
// Lifecycle hook events (18+ events, inspired by Claude Code):
type HookEvent =
  | 'SessionStart' | 'SessionEnd'
  | 'PreToolUse' | 'PostToolUse' | 'PostToolUseFailure' | 'PostToolBatch'
  | 'UserPromptSubmit' | 'PermissionRequest'
  | 'PreCompact' | 'PostCompact'
  | 'AgentStart' | 'AgentStop';
```

- [ ] Hook types: shell commands, HTTP POST, webhooks
- [ ] Hook input: JSON on stdin (tool call params, session context)
- [ ] Hook output: can modify, block, or pass-through
- [ ] Configuration: per-project hooks in `.nirex/hooks/`

### 3.4 — CLI Agent (MVP)

**Architecture principle: local-first storage.** Sessions live on your machine by default.
The backend is used for model proxying, billing, and credits — not for mandatory cloud
storage. Users push sessions to the cloud only when they want cross-device sync or sharing.
This mirrors Claude Code and Codex CLI architecture.

```typescript
// apps/cli/src/ commands:
nirex chat                    # Interactive coding session (TUI)
nirex exec "prompt"           # One-shot non-interactive
nirex plan "task"             # Plan-only mode (no edits)
nirex resume <session-id>     # Resume from local session
nirex list                    # List local sessions
nirex list --cloud            # List cloud-synced sessions
nirex save <session-id>       # Push local session to cloud
nirex pull <session-id>       # Pull cloud session to local
nirex export <session-id>     # Export transcript (JSON/Markdown)
```

**Storage layout** (`~/.nirex/`):
```
~/.nirex/
├── config.json                   # User preferences, API keys (never synced)
├── sessions/
│   ├── <id>.jsonl               # Full transcript (one JSON object per line)
│   ├── <id>.meta.json           # Session metadata (model, budget, timestamps)
│   └── <id>.checkpoints/        # Compaction snapshots
├── plugins/                      # Installed plugins
├── skills/                       # User-defined skill files
└── hooks/                        # Per-user hook scripts
```

**JSONL transcript format** (each line):
```jsonl
{"type":"user","content":"Fix the login bug","timestamp":"2026-05-30T10:00:00Z"}
{"type":"assistant","content":"I'll look at the auth module...","timestamp":"2026-05-30T10:00:05Z"}
{"type":"tool_call","tool":"file_read","args":{"path":"/src/auth/login.ts"},"timestamp":"..."}
{"type":"tool_result","tool":"file_read","result":"...","duration_ms":45,"timestamp":"..."}
{"type":"turn_complete","tokens":{"input":1200,"output":450,"cached":0},"timestamp":"..."}
```

#### 3.4a — Interactive TUI Mode (`nirex chat`)
- **Framework**: React + Ink (terminal React) or `blessed`/`terminal-kit`
- **Panels**:
  - Chat panel (model messages, markdown rendering)
  - Tool execution panel (shows tool calls in real-time)
  - Context panel (token count, model name, turn number)
  - File diff panel (preview changes before accepting)
- **Keybindings**:
  - `/` to start slash commands
  - `Ctrl+C` to interrupt / cancel
  - `Ctrl+O` to toggle permission mode
  - `Ctrl+D` to show diff of current changes
  - `Enter` to approve pending tool call
  - `Esc` to deny pending tool call
- **Slash commands**: `/model`, `/permissions`, `/clear`, `/compact`, `/undo`, `/diff`, `/help`

#### 3.4b — One-shot Mode (`nirex exec`)
- Non-interactive, scriptable, exits with code 0/1
- Flags: `--model`, `--max-turns`, `--max-budget`, `--approval-mode`
- Output: text on stdout, optionally JSON with `--json`
- CI/CD ready (GitHub Actions, GitLab CI)

#### 3.4c — Plan-Only Mode (`nirex plan`)
- Read-only: model inspects codebase and produces a plan
- Outputs structured plan (phases, steps, files affected)
- Allows user to review before switching to exec mode

### 3.5 — Backend Role (Thin for Sessions, Thick for AI)

The backend does NOT store full session transcripts by default. Its responsibilities:

| Responsibility | Where it lives |
|---------------|----------------|
| Session transcripts | **CLI local disk** (`~/.nirex/sessions/*.jsonl`) |
| Session metadata (model, tokens, cost) | Backend (REST API — needed for billing) |
| Full sessions on explicit user action | Backend (when user runs `nirex save`) |
| Model proxying + streaming | **Backend** (API keys live server-side) |
| Billing + credits + quotas | **Backend** (Stripe, usage tracking) |
| Tool execution | **CLI** (filesystem, bash, git — runs locally) |
| Sandboxed code execution | CLI or backend, depending on mode |

```
# Agent runtime endpoints (model proxy — hits backend):
POST   /api/ai/chat/stream              # Streaming model proxy
POST   /api/ai/chat                     # Non-streaming chat

# Agent control endpoints (lightweight — no transcript storage):
POST   /api/agent/run                   # Start agent session (SSE/WS)
POST   /api/agent/:id/approve           # Approve pending tool execution
POST   /api/agent/:id/deny              # Deny pending tool execution
POST   /api/agent/:id/cancel            # Cancel running agent
GET    /api/agent/:id/status            # Current state + turn info

# Cloud sync endpoints (user-initiated — push/pull on demand):
POST   /api/sessions/:id/push           # Upload full transcript to cloud
GET    /api/sessions/:id/pull           # Download full transcript from cloud
GET    /api/sessions                    # List cloud-synced sessions (metadata only)
DELETE /api/sessions/:id                # Delete cloud copy (local stays intact)
```

**Checkpoint**: Users can run `nirex chat` and have a multi-turn coding conversation entirely locally — the backend only sees model requests. Transcripts stay on disk. `nirex save` pushes a copy to cloud on demand. Permission prompts work.

---

## Phase 4 — Repository Intelligence (Weeks 12–14)

**Goal**: Give the model deep understanding of the codebase without consuming context window. Inspired by Aider's "repo map".

### 4.1 — Tree-sitter Integration
- [ ] Install tree-sitter + language grammars (TypeScript, Python, Rust, Go, Java, C#)
- [ ] Build `RepoParser` that extracts:
  - Class/interface/function/method definitions
  - Imports and exports
  - Type definitions and signatures
  - JSDoc/docstring summaries
- [ ] Incremental parsing (re-parse only changed files)

### 4.2 — Repo Graph & Ranking
```typescript
// Aider-style PageRank on the code dependency graph
interface RepoGraph {
  nodes: Map<string, SymbolNode>;    // file-path → symbol
  edges: Map<string, string[]>;      // caller → callees
  rank(symbols: SymbolNode[]): SymbolNode[];  // PageRank
}
```

- [ ] Build dependency graph from imports + LSP call hierarchy
- [ ] PageRank algorithm to rank code importance
- [ ] **Token-budgeted selection**: given N tokens, return top-K most relevant symbols

### 4.3 — Context Assembly
- [ ] `prepareContext(query: string, maxTokens: number): ContextChunk[]`
- [ ] TF-IDF / BM25 keyword matching to find relevant snippets
- [ ] Mix of: repo map (symbols) + grep results + recently modified files + project structure
- [ ] Context refresh: when model edits code, update repo map incrementally

### 4.4 — Tool: `code_explore`
- [ ] Ask the model to explore the codebase before acting
- [ ] Returns ranked relevant files + symbols + dependencies
- [ ] Model can request specific file contents on demand

**Checkpoint**: The agent understands the codebase structure and imports relevant context automatically. Token usage for context drops significantly.

---

## Phase 5 — Sandboxing & Security (Weeks 15–17)

**Goal**: Safely execute arbitrary code and shell commands with OS-level isolation.

> **Maps to THICK_BACKEND_ARCHITECTURE.md Phase 4 (Sandboxed Execution)**

### 5.1 — Sandbox Architecture
```typescript
interface SandboxProvider {
  create(config: SandboxConfig): Promise<Sandbox>;
  destroy(sandboxId: string): Promise<void>;
  status(sandboxId: string): Promise<SandboxStatus>;
}
```

- [ ] **Provider 1 — Docker** (cross-platform, good enough for MVP):
  - Per-session Docker container
  - Resource limits: CPU (1 core), memory (512MB), disk (1GB)
  - Filesystem: workspace mounted read-write, rest read-only
  - Network: disabled by default, domain allowlist via proxy
  - Timeout: all commands killed after 120s
  - Ephemeral: container destroyed when session ends
- [ ] **Provider 2 — Firecracker microVMs** (future, for stronger isolation):
  - AWS Lambda/Nitro-style isolation
  - Faster cold start than Docker (< 200ms vs ~2s)
  - Stronger security boundary (hardware virtualization)
  - Suitable for multi-tenant SaaS deployments

### 5.2 — Per-Platform Sandboxing (for CLI-local execution)
- [ ] **macOS**: Seatbelt (App Sandbox) profile
- [ ] **Linux**: bubblewrap (`bwrap`) + seccomp filters
- [ ] **Windows**: Windows Sandbox or restricted job object
- [ ] Graceful fallback: warn user if sandbox unavailable, offer to run without

### 5.3 — Code Execution Service
```typescript
POST /api/sandbox/execute
{
  "language": "python|javascript|typescript|bash|ruby|go|rust",
  "code": "print('hello')",
  "timeout_ms": 30000,
  "env": { "NODE_ENV": "test" }
}
```

- [ ] Code execution in sandbox with:
  - Language detection + appropriate runtime
  - Stdin/stdout/stderr capture
  - Exit code tracking
  - Package installation support (with whitelist for `pip`, `npm`)
- [ ] File upload/download to/from sandbox
- [ ] Interactive terminal mode (PTY for live shell interaction)

### 5.4 — Security Hardening
- [ ] **Defense in depth**:
  1. Permission rules → block dangerous operations
  2. Sandbox → OS-enforced filesystem/network boundary
  3. Command allowlist → restrict shell operations
  4. Output scanning → detect secrets in tool results
- [ ] **Protected paths**: `.git/`, `.env`, `*.pem`, `*.key`, `credentials.*`
- [ ] **Secret detection**: scan tool outputs for API keys, tokens, passwords
- [ ] **Prompt injection defense**: 
  - Web-fetched content goes to isolated context window
  - File content is treated as untrusted input
  - Model instructions are in system prompt (not user prompt territory)

### 5.5 — Audit Trail
- [ ] Every tool execution logged: user, session, tool, args, result summary, timing
- [ ] Every sandbox creation/destruction logged
- [ ] Anomaly detection: unusual tool usage patterns, large data exfiltration attempts
- [ ] Retention: audit logs retained per compliance requirements

**Checkpoint**: Code execution works in Docker sandbox. Permission system catches dangerous operations before they reach the sandbox.

---

## Phase 6 — Context Window Mastery (Weeks 18–20)

**Goal**: Handle conversations that exceed model context limits. Never lose important state.

> **Maps to THICK_BACKEND_ARCHITECTURE.md Phase 3 (Context Management)**

### 6.1 — Token Counting
- [ ] Provider-specific tokenizers: `tiktoken` (OpenAI), Anthropic API, Gemini API
- [ ] Accurate count for mixed content (text + tool results + images)
- [ ] Threshold alerts: warn at 70% capacity, force compact at 85%

### 6.2 — Compaction Strategies
```
1. Sliding Window
   - Keep N most recent messages (configurable)
   - Drop older messages after summarizing

2. Smart Truncation
   - Token-aware: count each message's tokens
   - Preserve: system prompt, recent tool results, pending action
   - Drop: old tool calls, emoji-only responses, duplicate content

3. AI-Powered Summary
   - Use cheaper model (GPT-4o-mini, Claude Haiku) to summarize old messages
   - Extract: key decisions, current state, pending tasks, important facts
   - Inject as "Conversation Summary" at conversation boundary

4. Checkpoint Compression (already partially built)
   - Roll up N turns of conversation into a checkpoint
   - Replace tool results with summaries (keep only actionable data)
   - Allow rollback to any checkpoint
```

### 6.3 — Context Budgeting
```typescript
class ContextBudget {
  readonly total: number;          // Model's max context
  readonly systemPrompt: number;   // Reserved for instructions
  readonly repoMap: number;        // Reserved for code context
  readonly history: number;        // Conversation history
  readonly working: number;        // Current tool results
  
  allocate(component: string, tokens: number): boolean;
  remaining(): number;
  shouldCompact(): boolean;
}
```

- [ ] Dynamic allocation: system prompt + repo map are fixed budget; history and tool results compete
- [ ] Context "pressure" metric → triggers compaction at thresholds
- [ ] User-configurable budgets per component

### 6.4 — Checkpoint System Enhancement
- [ ] Extend existing `SessionCheckpoint` model with full conversation snapshot
- [ ] Compact: replace N messages with summary + checkpoint reference
- [ ] Resume: load checkpoint + conversation summary when resuming old sessions
- [ ] Merge: combine checkpoints when branching/merging sessions

**Checkpoint**: Multi-hour coding sessions work without context overflow. Old state is never lost.

---

## Phase 7 — Advanced Agent Features (Weeks 21–25)

**Goal**: Match and exceed Claude Code / Codex CLI in capability.

### 7.1 — Subagents
```typescript
// Spawn child agents with isolated context and restricted tools
nirex exec "refactor the auth module"  // spawns subagents for each file

interface SubagentConfig {
  prompt: string;
  tools: string[];               // Restricted tool set
  model?: string;                // Different (cheaper) model
  maxTurns: number;
  isolation: 'full' | 'shared_filesystem';
}
```

- [ ] Subagent spawning from main agent loop
- [ ] Isolated context window (subagent's tool calls don't flood parent)
- [ ] Parent receives only final result + diff
- [ ] Parallel subagents for independent tasks
- [ ] Subagent timeout + cost cap
- [ ] `AgentStart` / `AgentStop` hooks for subagent lifecycle

### 7.2 — Auto-Review / Self-Correction
- [ ] **Lint-then-fix**: after every edit, run linter → feed errors back to model
- [ ] **Test-then-fix**: after edits, run affected tests → feed failures back
- [ ] **Type-check loop**: run `tsc --noEmit` → fix type errors
- [ ] **Auto-fix threshold**: max 3 rounds of fix attempts per issue
- [ ] Cost tracking: each fix round counts toward budget

### 7.3 — Multi-Model Orchestration
```typescript
// Use different models for different tasks:
class ModelOrchestrator {
  selector: ModelSelector;       // Routes to cheapest capable model
  
  plan(): AIProvider;            // Strong reasoning model (Opus, o3)
  edit(): AIProvider;            // Cost-effective editor (Sonnet, GPT-4o-mini)
  summarize(): AIProvider;       // Cheapest model (Haiku, GPT-4o-mini)
  review(): AIProvider;          // Different model than editor (avoids self-bias)
}
```

- [ ] **Architect/Editor split** (inspired by Aider):
  - Architect model: plans changes, writes specs
  - Editor model: implements code changes following the spec
  - Reviewer model: cross-checks changes for correctness
- [ ] **Task routing**: classify task → route to appropriate model tier
- [ ] **Cost optimization**: use cheapest model that can do the job

### 7.4 — Skills & Plugins
- [ ] **Skills**: reusable prompt-based workflows with metadata
  ```yaml
  # .nirex/skills/deploy.yml
  name: deploy
  description: Deploy to staging
  prompt: |
    Run `pnpm build`, verify tests pass,
    deploy to Vercel/Cloudflare preview.
  tools: [bash, file_read]
  ```
- [ ] **Plugin system**: packaged extensions with hooks + tools + skills
  - npm-based distribution
  - Verified publisher program (security)
  - `nirex plugin install @scope/plugin-name`
- [ ] **NIREX.md**: project-level instructions (equivalent to CLAUDE.md)
  - Auto-loaded at session start
  - Can define project conventions, architecture notes, common commands

### 7.5 — Background Agents
- [ ] Long-running `nirex exec --background` for CI/automation
- [ ] Monitor progress via `nirex status`
- [ ] Notifications on completion (desktop, Slack, email webhook)
- [ ] Background task queue in backend (Redis/BullMQ)

### 7.6 — Memory & Personalization
- [ ] **Session memory**: auto-extracted learnings from past sessions
- [ ] **User preferences**: preferred models, permission presets, code style
- [ ] **Project knowledge graph**: accumulated understanding of codebase
- [ ] Opt-in: user controls what's stored and for how long

**Checkpoint**: The agent is smarter than single-model naive execution. It delegates to subagents, self-corrects, and uses the right model for each task.

---

## Phase 8 — Production Hardening (Weeks 26–30)

**Goal**: Make the system reliable, observable, and performant enough for daily production use.

### 8.1 — Performance & Scaling
- [ ] **Backend**:
  - Connection pooling for AI providers (reuse HTTP connections)
  - Response streaming through proxy (no buffering)
  - Redis-backed session state (serverless-friendly)
  - Horizontal scaling with Redis pub/sub coordination
- [ ] **CLI**:
  - Startup time < 500ms (native binary with Bun/pkg or Rust rewrite)
  - Lazy loading of heavy dependencies (tree-sitter, language servers)
  - Cached repo map (only reparse changed files since last session)

### 8.2 — Observability
```typescript
// Metrics (OpenTelemetry / Prometheus):
- Agent turn latency (p50, p95, p99)
- Token usage per model per user
- Tool execution frequency + latency
- Sandbox creation/destruction rate
- Cache hit rates
- Error rates by tool type
- Credits consumed per session
- Agent success rate (completed task vs. aborted)
```

- [ ] Structured logging with correlation IDs (trace across CLI + backend + AI providers)
- [ ] Session transcripts stored as JSONL on disk (CLI — always on) + optional push to DB (backend — user-initiated via `nirex save`)
- [ ] Debug mode: `nirex --debug` shows raw API requests/responses
- [ ] Telemetry: opt-in anonymous usage stats for product improvement
- [ ] Admin dashboard for usage monitoring and customer support

### 8.3 — Error Resilience
- [ ] **Graceful degradation**:
  - Primary model down → auto-failover to backup model
  - Sandbox unavailable → warn user, offer to continue without
  - LSP not installed → skip symbol extraction
- [ ] **Session recovery**:
  - CLI crashes → can `nirex resume` from last checkpoint
  - Network interruption → reconnection with retry
  - Backend restart → session state restored from Redis
- [ ] **User-facing errors**: clean messages (no stack traces in production)

### 8.4 — Testing Infrastructure
```
Test Pyramid:
  ├── Unit tests: provider mocks, tool executors, token counting
  ├── Integration tests: agent loop with recorded LLM fixtures
  ├── E2E tests: CLI ↔ Backend ↔ mock AI provider
  └── Chaos tests: network failures, provider timeouts, large repos
```

- [ ] **Golden-file tests**: record LLM responses → replay for deterministic testing
- [ ] **Edit accuracy benchmarks**: measure % of edits that produce working code
- [ ] **Regression suite**: 50+ real-world coding tasks with expected outcomes
- [ ] CI on every PR: unit → integration → E2E

### 8.5 — Packaging & Distribution
- [ ] **npm package**: `npm install -g nirex` (cross-platform)
- [ ] **Homebrew** (macOS): `brew install nirex`
- [ ] **Winget** (Windows): `winget install nirex`
- [ ] **Native binary** (optional, for performance):
  - pkg (Vercel) for single-file Node.js binary
  - Bun compile for fast startup
  - Or Rust rewrite via Tauri CLI
- [ ] Auto-update mechanism (check for new version on startup)

### 8.6 — Documentation
- [ ] Getting started guide (5-minute quickstart)
- [ ] Full CLI reference (`nirex --help` tree)
- [ ] Permission system guide with examples
- [ ] Advanced workflows (subagents, hooks, plugins)
- [ ] Self-hosting guide (run your own backend)
- [ ] API reference for backend endpoints

**Checkpoint**: The system is production-ready. Can be shipped to external users with confidence.

---

## Phase 9 — Enterprise & Scale (Weeks 31–36)

**Goal**: Features that make Nirex viable for teams and enterprises.

### 9.1 — Multi-Tenant SaaS Backend
- [ ] Workspace isolation (teams/orgs with separate billing)
- [ ] Team management (invite members, role-based access: admin/member/viewer)
- [ ] Shared sessions: collaborate on the same agent session
- [ ] Usage dashboards per team/project

### 9.2 — Managed Policies (Enterprise)
```typescript
// Admin-enforced policies that users cannot override:
{
  "policies": {
    "maxBudgetPerSession": 500,        // credits
    "maxTurnsPerSession": 100,
    "deniedTools": ["bash_execute"],   // always blocked
    "allowedModels": ["gpt-4o", "claude-sonnet-4"],
    "requireApprovalFor": ["git_commit", "git_push"],
    "auditRetentionDays": 90,
    "dataResidency": "us|eu"
  }
}
```

- [ ] Admin dashboard for policy management
- [ ] Policy enforcement in both CLI and backend (defense in depth)
- [ ] SSO integration (SAML, OIDC)
- [ ] Audit log export (SIEM integration)

### 9.3 — On-Prem / Self-Hosted
- [ ] Docker Compose deployment (backend + MongoDB + Redis)
- [ ] Kubernetes Helm chart
- [ ] Air-gapped support (local models via Ollama/LM Studio)
- [ ] Bring-your-own-model-keys (enterprise API accounts)

### 9.4 — Compliance & Security
- [ ] SOC 2 Type II readiness (audit logging, access controls, encryption)
- [ ] GDPR compliance (data residency, right to deletion, consent)
- [ ] Regular penetration testing
- [ ] Bug bounty program

### 9.5 — IDE Integration
- [ ] VS Code extension (sidebar chat + inline suggestions)
- [ ] JetBrains plugin
- [ ] Cursor integration
- [ ] Shared engine: same backend powers CLI, VS Code, and JetBrains

**Checkpoint**: Nirex is enterprise-grade. SOC 2 ready, multi-tenant, managed policies, IDE integrations.

---

## Phase 10 — Moonshots (Ongoing)

**Goal**: Features that could make Nirex the best coding tool in the market.

### 10.1 — Chronicle / Persistent Memory
- [ ] "Nirex learns your codebase" — persistent knowledge graph across sessions
- [ ] Auto-detection of architectural patterns, conventions, tech debt
- [ ] Proactive suggestions: "I notice you always write X before Y — want me to handle this?"

### 10.2 — Voice-to-Code
- [ ] Voice input → transcription → agent execution
- [ ] Pair programming with voice narration
- [ ] Accessibility: full agent control via voice commands

### 10.3 — Live Collaboration
- [ ] Multi-user agent sessions (like Google Docs for coding)
- [ ] Shared context window, shared tool approvals
- [ ] Screen share with code annotation

### 10.4 — Autonomous CI Agent
- [ ] GitHub app: auto-fix failing CI builds
- [ ] Auto-code-review on PRs (pre-merge)
- [ ] Auto-migration: upgrade dependencies, fix breaking changes

### 10.5 — Database & Infrastructure Agent
- [ ] SQL query generation + execution in sandbox
- [ ] Schema migration planning
- [ ] Infrastructure-as-code generation (Terraform, Pulumi)
- [ ] Cloud resource management

### 10.6 — Local-First Model Runtime
- [ ] Ollama/LM Studio integration for completely offline mode
- [ ] Hybrid mode: simple tasks on local models, complex tasks on cloud models
- [ ] Model fine-tuning from project context

### 10.7 — Rust Rewrite (Performance)
- [ ] Rewrite CLI in Rust for:
  - Sub-50ms startup
  - Native tree-sitter performance
  - Lower memory footprint
  - Single static binary distribution
- [ ] Keep TypeScript backend for business logic flexibility
- [ ] Or: rewrite agent loop in Rust as a sidecar to Node backend

---

## Summary Timeline

| Phase | Duration | Key Deliverable |
|-------|----------|----------------|
| 0 — Foundation Audit | Week 1 | Validated codebase, extended types, CLI structure |
| 1 — Model Proxy + Streaming | Weeks 2–4 | Backend talks to OpenAI/Anthropic/Google with streaming |
| 2 — Tool Execution Engine | Weeks 5–7 | File, bash, git, LSP, web tools execute safely |
| 3 — Agent Loop + CLI MVP | Weeks 8–11 | `nirex chat` works: multi-turn coding conversations |
| 4 — Repository Intelligence | Weeks 12–14 | Codebase-aware context: repo map, tree-sitter |
| 5 — Sandboxing & Security | Weeks 15–17 | Docker-based code execution, OS sandbox, audit trail |
| 6 — Context Window Mastery | Weeks 18–20 | Never lose context: compaction, checkpoint, budgeting |
| 7 — Advanced Agent Features | Weeks 21–25 | Subagents, auto-review, multi-model orchestration |
| 8 — Production Hardening | Weeks 26–30 | Ready for public release: perf, testing, docs, distribution |
| 9 — Enterprise & Scale | Weeks 31–36 | SaaS multi-tenant, managed policies, IDE integrations |
| 10 — Moonshots | Ongoing | Persistent memory, voice, collaboration, Rust rewrite |

**Total to production-ready MVP (Phase 1–5)**: ~17 weeks  
**Total to full-featured public launch (Phase 1–8)**: ~30 weeks  
**Total to enterprise-grade (Phase 1–9)**: ~36 weeks

---

## Key Architecture Decisions

1. **CLI-first, not IDE-first**: IDEs are crowded (GitHub Copilot, Cursor, Codex). Terminal is under-served by current-gen tools and preferred by power users.
2. **Thick backend for AI, thin backend for storage**: Backend handles model proxying, billing, and credits (must be server-side). Session transcripts stay on user's machine by default — cloud sync is opt-in via `nirex save`.
3. **Local-first session storage**: Sessions as JSONL on disk in `~/.nirex/sessions/`. Always on, works offline, no privacy concern. Cloud push is explicit and user-driven. Both Claude Code and Codex CLI use this model.
4. **TypeScript across the stack**: Shared types via `@nirex/shared` ensure end-to-end type safety from CLI through backend to AI providers.
5. **Plugin architecture from Day 1**: Hooks system, MCP support, and skill definitions let the community extend Nirex.
6. **Permission model inspired by Claude Code** (tiered, first-match, managed policies) — it's the gold standard for agent safety.
7. **Edit strategy inspired by Aider** (exact string replacement, read-before-edit, auto-commit via git) — proven reliable for large-scale code changes.
8. **Subagents inspired by Claude Code** (isolated context, parallel execution) — essential for complex tasks without context explosion.

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| AI provider API instability | High | Multi-provider failover; circuit breaker pattern; local model fallback |
| Context window limits block complex tasks | High | Subagents, compaction, checkpoint system, repo map |
| Permission bypass vulnerability | Critical | Defense in depth: rules → sandbox → audit; regular pentesting |
| Cost overruns from runaway agent loops | Medium | Turn limits, credit caps, idle timeout, cost monitoring |
| Slow startup hurts adoption | Medium | Lazy loading, Bun compile, potential Rust rewrite of CLI |
| Model output quality varies per provider | Medium | Per-model edit format tuning, fallback chains, review models |
| Local session data loss (no backups) | Medium | Auto-save to disk after every turn; `nirex save` as manual cloud backup; educate users on backup paths |
| Backend sees source code via model proxy | Privacy | Model requests flow through backend (needed for API key security), but full source is only in the prompts sent to AI providers — not stored on backend unless user pushes |

---
