# Thick Backend Architecture (Option B)

## Overview

This document outlines the architecture for a thick backend that handles AI model orchestration,
tool execution, and complex reasoning - similar to OpenAI Codex architecture.

```
┌─────────────┐      ┌─────────────────────────────────────┐      ┌──────────────┐
│   CLI       │◄────►│           BACKEND                   │◄────►│ AI Providers │
│  Client     │      │  (Heavy Processing & Orchestration) │      │ (OpenAI,     │
│             │      │                                     │      │ Anthropic,   │
│ • Terminal  │      │ • Auth & Session Management         │      │ Google, etc) │
│ • Display   │      │ • Conversation Storage              │      │              │
│ • Local FS  │      │ • Model Proxy & Routing             │      │              │
└─────────────┘      │ • Tool Orchestration                │      └──────────────┘
                     │ • Context Management                │
                     │ • Sandboxed Execution               │
                     │ • Streaming Pipeline                │
                     │ • Multi-turn Reasoning              │
                     └─────────────────────────────────────┘
```

## Core Components to Implement

### 1. Model Proxy & Abstraction Layer

**Purpose**: Unified interface for multiple AI providers with failover

```typescript
// Required features:
- Provider routing (OpenAI, Anthropic, Google, local models)
- Model fallback (GPT-4 → GPT-3.5 → Claude)
- Request/response transformation
- Token usage tracking
- Rate limiting per model
- Response caching

// API endpoints needed:
POST /api/ai/chat          # Single-turn chat
POST /api/ai/chat/stream   # Streaming chat
POST /api/ai/complete      # Code completion
POST /api/ai/embed         # Embeddings
```

### 2. Tool Orchestration System

**Purpose**: Execute tools on behalf of AI models safely

```typescript
// Tool types to support:
interface ToolRegistry {
  // File operations
  'file_read': Read file contents
  'file_write': Write/modify files
  'file_search': Search file contents
  'directory_list': List directory contents

  // Code operations
  'code_analyze': Analyze code structure
  'code_lint': Run linters
  'code_format': Format code
  'code_execute': Execute code safely

  // Terminal operations
  'terminal_run': Execute shell commands
  'terminal_status': Check running processes
  'terminal_kill': Kill processes

  // Git operations
  'git_status': Check git status
  'git_diff': Show changes
  'git_commit': Create commits
  'git_branch': Branch management

  // LSP operations
  'lsp_definition': Go to definition
  'lsp_references': Find references
  'lsp_rename': Rename symbols
  'lsp_diagnostics': Get errors/warnings

  // Web operations
  'web_search': Search the web
  'web_fetch': Fetch URL content
}
```

### 3. Context Window Management

**Purpose**: Automatically manage conversation length within model limits

```typescript
// Strategies:
1. Sliding Window
   - Keep last N messages
   - Summarize older context

2. Token-based Truncation
   - Calculate token count
   - Remove least important messages
   - Preserve system prompts

3. Smart Summarization
   - Use cheaper model to summarize
   - Extract key decisions/facts
   - Maintain conversation flow

4. Checkpoint-based
   - Create checkpoints at milestones
   - Allow rollback to checkpoints
   - Compress between checkpoints
```

### 4. Streaming Response Pipeline

**Purpose**: Stream AI responses with real-time tool execution

```typescript
// Flow:
User Request → Backend → AI Model
                    ↓
              Stream Chunks
                    ↓
            Tool Call Detected?
                    ↓
              Yes → Execute Tool
                    ↓
              Stream Result
                    ↓
            Continue/Complete

// SSE Events to client:
- content_delta: { text: string }
- tool_call_start: { tool: string, args: any }
- tool_call_result: { result: any, duration: number }
- tool_call_error: { error: string }
- reasoning_start: { topic: string }
- reasoning_step: { step: number, total: number, description: string }
- completion: { usage: TokenUsage }
```

### 5. Sandboxed Execution Environment

**Purpose**: Safely execute user code and commands

```typescript
// Options:

1. Docker Containers (Recommended)
   - Isolated environment per session
   - Resource limits (CPU, memory, disk)
   - Network restrictions
   - Timeout enforcement
   - Ephemeral (deleted after use)

2. Firecracker MicroVMs
   - AWS Lambda-style isolation
   - Faster startup than Docker
   - Stronger security boundaries

3. gVisor
   - User-space kernel
   - syscall interception
   - Lightweight

// Required for:
- Code execution (Python, Node, etc.)
- Terminal commands
- File system operations
- Package installation
```

### 6. Multi-turn Reasoning Engine

**Purpose**: Handle complex multi-step tasks autonomously

```typescript
// Capabilities:

1. Plan Generation
   - Break complex tasks into steps
   - Identify required tools
   - Estimate completion time

2. Step Execution
   - Execute one step at a time
   - Handle failures gracefully
   - Retry with modifications

3. State Management
   - Track progress
   - Store intermediate results
   - Allow pause/resume

4. Human-in-the-loop
   - Request confirmation for dangerous ops
   - Ask clarifying questions
   - Present options

// Example task:
"Refactor this codebase to TypeScript"
→ Analyze project structure
→ Identify files to convert
→ Create conversion plan
→ Execute conversions (with tests)
→ Run verification
→ Present summary
```

## New API Endpoints Required

### AI Proxy Endpoints
```
POST   /api/ai/chat                    # Non-streaming chat
POST   /api/ai/chat/stream             # Streaming chat (SSE)
POST   /api/ai/complete                # Code completion
POST   /api/ai/cancel                  # Cancel ongoing request
GET    /api/ai/models                  # List available models
GET    /api/ai/usage                   # Get usage stats
```

### Tool Execution Endpoints
```
POST   /api/tools/execute              # Execute a tool
GET    /api/tools/registry             # List available tools
POST   /api/tools/validate             # Validate tool arguments
GET    /api/tools/:tool/schema         # Get tool JSON schema
```

### Context Management Endpoints
```
POST   /api/sessions/:id/summarize     # Summarize conversation
POST   /api/sessions/:id/truncate      # Truncate to fit context
GET    /api/sessions/:id/tokens        # Get token count
POST   /api/sessions/:id/compact       # Compact with checkpoint
```

### Execution Environment Endpoints
```
POST   /api/exec/create                # Create sandbox
DELETE /api/exec/:id                   # Destroy sandbox
POST   /api/exec/:id/run               # Run command in sandbox
POST   /api/exec/:id/code              # Execute code
GET    /api/exec/:id/status            # Check sandbox status
POST   /api/exec/:id/files             # Upload files
GET    /api/exec/:id/files/:path       # Download files
```

## Implementation Phases

### Phase 1: Model Proxy (Week 1-2)
- [ ] Abstract model provider interface
- [ ] OpenAI integration
- [ ] Anthropic integration
- [ ] Streaming support
- [ ] Token tracking

### Phase 2: Basic Tools (Week 3-4)
- [ ] File read/write
- [ ] Directory listing
- [ ] Terminal command execution
- [ ] Tool registry
- [ ] Tool validation

### Phase 3: Context Management (Week 5-6)
- [ ] Token counting
- [ ] Sliding window
- [ ] Smart truncation
- [ ] Checkpoint compression

### Phase 4: Sandboxed Execution (Week 7-8)
- [ ] Docker integration
- [ ] Code execution
- [ ] Resource limits
- [ ] Security policies

### Phase 5: Advanced Features (Week 9-10)
- [ ] Multi-turn reasoning
- [ ] Plan generation
- [ ] Human-in-the-loop
- [ ] Error recovery

## Security Considerations

1. **API Key Management**
   - Store provider keys securely (KMS/Vault)
   - Rotate keys regularly
   - Monitor usage for abuse

2. **Sandbox Security**
   - No network access by default
   - Read-only filesystem except workspace
   - Resource quotas enforced
   - Timeout all executions

3. **Tool Permissions**
   - Granular permission system
   - Dangerous tools require confirmation
   - Audit all tool executions
   - Rate limit per tool type

4. **Data Protection**
   - Encrypt conversation data
   - PII detection and handling
   - Data retention policies
   - Secure deletion

## Cost Optimization

1. **Caching**
   - Cache common completions
   - Cache embedding results
   - Cache tool outputs

2. **Model Selection**
   - Use cheaper models for simple tasks
   - Upgrade to expensive models only when needed
   - Batch requests when possible

3. **Context Management**
   - Aggressive truncation
   - Smart summarization
   - Checkpoint compression

4. **Resource Management**
   - Reuse sandboxes when safe
   - Kill idle sandboxes
   - Compress stored data

## Monitoring & Observability

```typescript
// Metrics to track:
- Request latency (p50, p95, p99)
- Token usage per model
- Tool execution frequency
- Sandbox creation/destruction rate
- Cache hit rates
- Error rates by type
- Cost per user/session

// Logging:
- All AI model interactions
- All tool executions
- Security events
- Performance bottlenecks
```

## Current System Gaps

Your existing chat-sessions system provides:
✅ Session management
✅ Message persistence
✅ Caching layer
✅ Rate limiting
✅ Search
✅ Encryption

Missing for thick backend:
❌ Model proxy layer
❌ Tool orchestration
❌ Streaming pipeline
❌ Context management
❌ Sandboxed execution
❌ Multi-turn reasoning

## Next Steps

1. Start with **Model Proxy** - it's the foundation
2. Add **Streaming** - essential for UX
3. Implement **File Tools** - most common use case
4. Add **Sandbox** - enables code execution
5. Build **Reasoning Engine** - enables autonomy

Would you like me to implement any of these components?
