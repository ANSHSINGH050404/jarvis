/**
 * Week 3 Tool Test
 *
 * Tests JARVIS's ability to execute tools
 */

import { createLogger } from "../packages/core/src/index.js";

const logger = createLogger("ToolTest");

const WS_URL = "ws://localhost:3000/ws?userId=tool_tester&sessionId=tool_test";

async function testToolExecution() {
  logger.info("Testing Week 3 Tool Execution");

  const ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    logger.info("✅ Connected!");

    // Test 1: Ask JARVIS to read a file
    setTimeout(() => {
      logger.info("\n📝 Test 1: Reading package.json");
      ws.send(
        JSON.stringify({
          type: "message",
          content: "Read the file package.json and tell me what version it is",
        }),
      );
    }, 1000);

    // Test 2: List directory
    setTimeout(() => {
      logger.info("\n📁 Test 2: Listing directory");
      ws.send(
        JSON.stringify({
          type: "message",
          content: "List all files in the current directory",
        }),
      );
    }, 10000);

    // Test 3: HTTP request
    setTimeout(() => {
      logger.info("\n🌐 Test 3: HTTP request");
      ws.send(
        JSON.stringify({
          type: "message",
          content:
            "Make a GET request to https://api.github.com and show me the response",
        }),
      );
    }, 20000);

    // Close after tests
    setTimeout(() => {
      logger.info("\n✅ All tests complete!");
      ws.close();
    }, 30000);
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data as string);

      if (data.type === "message") {
        console.log("\n📨 JARVIS Response:");
        console.log(data.content);
      } else if (data.type === "text") {
        process.stdout.write(data.content);
      } else if (data.type === "done") {
        console.log("\n");
      }
    } catch (error) {
      logger.error("Parse error", { error });
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

testToolExecution();
