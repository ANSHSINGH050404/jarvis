/**
 * Week 4 Memory Test
 *
 * Tests JARVIS's ability to remember context across sessions.
 */

import { createLogger } from "../packages/core/src/index.js";

const logger = createLogger("MemoryTest");

// Use a fixed session ID to test persistence
const SESSION_ID = "memory_test_session_v1";
const WS_URL = `ws://localhost:3000/ws?userId=tester&sessionId=${SESSION_ID}`;

async function testMemory() {
  logger.info("Testing Week 4 Memory Persistence");

  const ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    logger.info("✅ Connected!");

    // Step 1: Tell JARVIS something to remember
    setTimeout(() => {
      logger.info("\n🧠 Step 1: Teaching JARVIS a secret");
      ws.send(
        JSON.stringify({
          type: "message",
          content:
            "My favorite color is #FF5733 (Persimmon Orange). Remember this!",
        }),
      );
    }, 1000);

    // Close after getting response
    // In a real test we would wait for response, but for simplicity here we just wait
    setTimeout(() => {
      logger.info("\n✅ Step 1 complete. Closing connection.");
      ws.close();
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

testMemory();
