# Motlbot Clone (Bun + TypeScript)

This is a high-performance, autonomous AI agent clone of Motlbot/OpenClaw.

## Features

- **ReAct Loop**: Autonomous reasoning using Google Gemini 2.0.
- **Tools**:
  - `ShellTool`: Execute system commands.
  - `BrowserTool`: Control Chrome for web automation (Playwright).
- **Runtime**: Built on Bun for speed.

## Setup

1. **Install Dependencies**:
   ```bash
   bun install
   ```
2. **Configure Environment**:
   - Open `.env`.
   - Add your Gemini API Key: `GEMINI_API_KEY=AIzaSy...`

3. **Run**:
   - **Interactive Mode**:
     ```bash
     bun run src/index.ts
     ```
   - **One-shot Task**:
     ```bash
     bun run run.ts "Go to google.com and search for 'OpenClaw architecture'"
     ```

## Project Structure

- `src/core/agent.ts`: The Brain (ReAct Loop).
- `src/tools/`: The Hands & Eyes (System, Browser).
- `src/index.ts`: The Main Interface.

## Next Steps

- Implement "autonomous heartbeat" (scheduler).
- Add specific "skills" folder for complex workflows.
