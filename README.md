# JARVIS - Local-First AI Assistant Platform

A self-hosted, privacy-first AI assistant that can execute actions, maintain memory, and integrate with multiple channels.

## 🎯 Project Status: Week 3 - Tools System Complete

### ✅ Week 1: Foundation (Complete)

- [x] Monorepo structure with TypeScript + Bun
- [x] Core types and interfaces
- [x] Event-driven architecture (in-memory event bus)
- [x] WebSocket Gateway server
- [x] Session management
- [x] HTTP endpoints for testing
- [x] Structured logging
- [x] Error handling framework

### ✅ Week 2: Agent Runtime (Complete)

- [x] Gemini API integration
- [x] Prompt builder system with JARVIS personality
- [x] Conversation history management
- [x] Streaming responses (real-time tokens)
- [x] Non-streaming mode support
- [x] Context-aware prompts
- [x] Error handling and recovery

### ✅ Week 3: Tools System (Complete)

- [x] Tool registry and execution framework
- [x] Filesystem tools (read, write, list, search)
- [x] HTTP request tool
- [x] Gemini function calling integration
- [x] Type-safe tool definitions
- [x] Path validation and security
- [x] Tool execution loop in agent

### 📋 Roadmap

**Week 4: Memory & Persistence**

- [ ] SQLite database
- [ ] Conversation history
- [ ] Context retrieval

**Week 5: Channel Adapters**

- [ ] Telegram bot integration
- [ ] CLI interface

**Week 6: Skills System**

- [ ] Plugin loader
- [ ] Permission sandbox
- [ ] Hot-reload skills

## 🚀 Quick Start

### Prerequisites

- Bun runtime (>= 1.0.0)
- Node.js (>= 20.0.0) - optional, Bun preferred

### Install Bun

```bash
curl -fsSL https://bun.sh/install | bash
```

### Installation

1. Install dependencies:

```bash
bun install
```

2. Create environment file:

```bash
cp .env.example .env
```

3. **Configure Gemini API Key** (Week 2+):

Get your free API key: https://makersuite.google.com/app/apikey

Then edit `.env`:

```env
GEMINI_API_KEY=your_actual_api_key_here
```

See [Week 2 Setup Guide](./docs/WEEK2_SETUP.md) for details.

4. Start the server:

```bash
bun run dev
```

The server will start on:

- WebSocket: `ws://localhost:3000/ws`
- HTTP: `http://localhost:3000`
- Health Check: `http://localhost:3000/health`

### Testing

#### Test WebSocket Connection

```bash
# In a new terminal
bun run dev:test-client
```

#### Test HTTP Endpoint

```bash
curl -X POST http://localhost:3000/message \
  -H "Content-Type: application/json" \
  -d '{"content": "Hello JARVIS!"}'
```

#### Health Check

```bash
curl http://localhost:3000/health
```

## 📂 Project Structure

```
jarvis/
├── packages/
│   ├── core/           # Shared types, events, utilities
│   ├── gateway/        # WebSocket server & session management
│   ├── agent/          # AI agent runtime (Week 2)
│   ├── tools/          # Tool system (Week 3)
│   ├── memory/         # Persistence layer (Week 4)
│   └── channels/       # Channel adapters (Week 5)
├── src/
│   └── index.ts        # Main entry point
├── scripts/
│   └── test-client.ts  # Test utilities
└── skills/             # User plugins (Week 6)
```

## 🏗️ Architecture

### Message Flow

```
User Message
    ↓
Channel Adapter (Telegram/CLI/WebSocket)
    ↓
Gateway Server
    ↓
Event Bus (pub/sub)
    ↓
Agent Runtime
    ├─→ LLM (Gemini)
    ├─→ Tools Executor
    └─→ Memory System
    ↓
Response (streamed back through Gateway)
    ↓
User
```

### Components

- **Gateway**: WebSocket/HTTP server, session management
- **Event Bus**: Decouples components via pub/sub
- **Agent Runtime**: LLM integration, reasoning loop
- **Tools System**: Sandboxed execution of actions
- **Memory**: SQLite for persistence, cache for speed
- **Channels**: Adapters for Telegram, CLI, etc.

## 🛠️ Development

### Project Scripts

```bash
# Development mode (auto-reload)
bun run dev

# Type checking
bun run type-check

# Test client
bun run dev:test-client

# Clean build artifacts
bun run clean
```

### Adding New Packages

1. Create package directory: `packages/my-package/`
2. Add `package.json` with workspace dependency
3. Export from `src/index.ts`
4. Import using `@jarvis/my-package`

## 📝 Environment Variables

See `.env.example` for all available options.

Key variables:

- `GATEWAY_HOST`: Server host (default: 0.0.0.0)
- `GATEWAY_PORT`: Server port (default: 3000)
- `LOG_LEVEL`: Logging verbosity (debug|info|warn|error)

## 🤝 Contributing

This is a learning project following a week-by-week implementation plan. Each week builds on the previous foundation.

## 📄 License

MIT

## 🙏 Credits

Inspired by OpenClaw and modern agentic AI architectures.
