/**
 * JARVIS Main Entry Point
 *
 * Week 3: AI Agent with Tool Calling
 *
 * Flow:
 * 1. Gateway receives message via WebSocket/HTTP
 * 2. Gateway publishes to event bus
 * 3. AgentRuntime processes with LLM
 * 4. LLM may request tool execution
 * 5. Tools execute and return results
 * 6. Response streams back through Gateway
 */

import { createLogger } from "@jarvis/core";
import { Gateway } from "@jarvis/gateway";
import { AgentRuntime } from "@jarvis/agent";
import { ToolRegistry, filesystemTools, httpTools } from "@jarvis/tools";
import { MemoryStore } from "@jarvis/memory";

const logger = createLogger("Main");

async function main() {
  logger.info("🚀 Starting JARVIS Platform (Week 3 - Tools Enabled)");

  try {
    // Validate required environment variables
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey || geminiApiKey === "your_gemini_api_key") {
      logger.error("⚠️  GEMINI_API_KEY not configured!");
      logger.info("Please set GEMINI_API_KEY in your .env file");
      logger.info(
        "Get your API key from: https://makersuite.google.com/app/apikey",
      );
      process.exit(1);
    }

    // Read config from environment
    const gatewayConfig = {
      host: process.env.GATEWAY_HOST || "0.0.0.0",
      port: parseInt(process.env.GATEWAY_PORT || "3000"),
      apiKey: process.env.API_KEY,
    };

    const agentConfig = {
      gemini: {
        apiKey: geminiApiKey,
        model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
        temperature: parseFloat(process.env.GEMINI_TEMPERATURE || "0.7"),
      },
      streaming: true,
      maxConversationLength: 20,
      workingDirectory: process.cwd(),
      enableTools: true, // 🆕 Enable tools!
    };

    // Create and register tools
    const toolRegistry = new ToolRegistry();
    toolRegistry.registerMany([...filesystemTools, ...httpTools]);

    logger.info("Tools registered", {
      count: toolRegistry.getToolNames().length,
      tools: toolRegistry.getToolNames(),
    });

    // Initialize Memory Store (SQLite)
    const memoryStore = new MemoryStore("data/jarvis.db");
    logger.info("Memory store initialized", { path: "data/jarvis.db" });

    // Start Gateway
    const gateway = new Gateway(gatewayConfig);
    await gateway.start();

    // Start Agent Runtime with tools and memory
    const agent = new AgentRuntime(agentConfig, toolRegistry, memoryStore);
    await agent.start();

    logger.info("✅ JARVIS platform ready!");
    logger.info("🤖 AI Model: " + agentConfig.gemini.model);
    logger.info("📡 WebSocket: ws://localhost:3000/ws");
    logger.info("🏥 Health: http://localhost:3000/health");
    logger.info("📬 HTTP: POST http://localhost:3000/message");
    logger.info("");
    logger.info("💬 Try: bun run dev:test-client");

    // Graceful shutdown
    const shutdown = async () => {
      logger.info("Shutting down...");
      await gateway.stop();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    logger.error("Failed to start JARVIS", { error });
    process.exit(1);
  }
}

// Start the application
main();
