/**
 * WebSocket Test Client - Week 2 Edition
 *
 * Tests:
 * - WebSocket connection
 * - Sending messages
 * - Receiving streaming responses
 * - HTTP endpoint
 * - Health check
 *
 * Usage:
 *   bun run dev:test-client [ws|http|health]
 */

import { createLogger } from "../packages/core/src/index.js";

const logger = createLogger("TestClient");

const WS_URL = "ws://localhost:3000/ws?userId=test_user&sessionId=test_session";

async function testWebSocket() {
  logger.info("Connecting to Gateway...", { url: WS_URL });

  const ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    logger.info("✅ Connected to Gateway");

    // Send test messages
    setTimeout(() => {
      logger.info("Sending: What is TypeScript?");
      ws.send(
        JSON.stringify({
          type: "message",
          content: "What is TypeScript? Keep it brief.",
        }),
      );
    }, 1000);

    setTimeout(() => {
      logger.info("Sending: Explain event-driven architecture");
      ws.send(
        JSON.stringify({
          type: "message",
          content: "Explain event-driven architecture in 2 sentences.",
        }),
      );
    }, 8000);

    // Close after 15 seconds
    setTimeout(() => {
      logger.info("Closing connection...");
      ws.close();
    }, 15000);
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data as string);

      if (data.type === "connected") {
        logger.info("📡 Connection confirmed", { sessionId: data.sessionId });
      } else if (data.type === "message") {
        logger.info("📨 Received complete message:", {
          content: data.content,
        });
      } else if (data.type === "text") {
        // Stream chunk
        process.stdout.write(data.content);
      } else if (data.type === "done") {
        console.log("\n✅ Stream complete");
      } else if (data.type === "error") {
        logger.error("❌ Stream error:", data);
      } else {
        logger.debug("Received:", data);
      }
    } catch (error) {
      logger.error("Failed to parse message", { error });
    }
  };

  ws.onerror = (error) => {
    logger.error("WebSocket error", { error });
  };

  ws.onclose = () => {
    logger.info("Connection closed");
    process.exit(0);
  };
}

async function testHTTP() {
  logger.info("Testing HTTP endpoint...");

  const response = await fetch("http://localhost:3000/message", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId: "test_user",
      sessionId: "http_test",
      content: "Hello! What can you help me with?",
    }),
  });

  const result = await response.json();
  logger.info("HTTP response:", result);

  // Wait a bit for the response to come through
  await new Promise((resolve) => setTimeout(resolve, 5000));
  logger.info("Check server logs for the AI response");
}

async function testHealth() {
  logger.info("Testing health endpoint...");

  const response = await fetch("http://localhost:3000/health");
  const health = await response.json();
  logger.info("Health check:", health);
}

// Choose test mode
const mode = process.argv[2] || "ws";

switch (mode) {
  case "ws":
    testWebSocket();
    break;
  case "http":
    testHTTP();
    break;
  case "health":
    testHealth();
    break;
  default:
    console.log("Usage: bun run scripts/test-client.ts [ws|http|health]");
    process.exit(1);
}
