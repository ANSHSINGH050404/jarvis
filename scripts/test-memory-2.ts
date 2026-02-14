/**
 * Week 4 Memory Test - Part 2
 *
 * Tests JARVIS's ability to recall memory from previous session.
 */

import { createLogger } from "../packages/core/src/index.js";

const logger = createLogger("MemoryTest2");

// Use SAME session ID to test persistence
const SESSION_ID = "memory_test_session_v1";
const WS_URL = `ws://localhost:3000/ws?userId=tester&sessionId=${SESSION_ID}`;

async function verifyMemory() {
  logger.info("Verifying Week 4 Memory Recall");

  const ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    logger.info("✅ Connected!");

    // Step 2: Ask JARVIS what I said
    setTimeout(() => {
      logger.info("\n❓ Asking JARVIS for the secret");
      ws.send(
        JSON.stringify({
          type: "message",
          content: "What is my favorite color?",
        }),
      );
    }, 1000);

    // Close after getting response
    setTimeout(() => {
      logger.info("\n✅ Step 2 complete. Closing connection.");
      ws.close();
      process.exit(0);
    }, 10000);
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data as string);
      if (data.type === "text") {
        process.stdout.write(data.content);
      } else if (data.type === "done") {
        console.log("\n");
      }
    } catch (error) {
      console.log("Message:", event.data);
    }
  };
}

verifyMemory();
