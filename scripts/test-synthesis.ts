/**
 * Week 4 Synthesis Loop Test
 *
 * Tests JARVIS's ability to:
 * 1. Execute a tool (read_file)
 * 2. Synthesize the result into a natural response (streaming)
 */

import { createLogger } from "../packages/core/src/index.js";

const logger = createLogger("SynthesisTest");

const SESSION_ID = "synthesis_test_v1";
const WS_URL = `ws://localhost:3000/ws?userId=tester&sessionId=${SESSION_ID}`;

const ws = new WebSocket(WS_URL);

ws.onopen = () => {
  logger.info("Week 4 Synthesis Loop Test");
  logger.info("✅ Connected!");

  setTimeout(() => {
    logger.info("\n🛠️ Asking JARVIS to read file (Tool -> Synthesis)");
    ws.send(
      JSON.stringify({
        type: "message",
        content: "Read package.json and tell me what the version is.",
      }),
    );
  }, 1000);

  // Close after getting response
  setTimeout(() => {
    logger.info("\n✅ Test complete. Closing connection.");
    ws.close();
    process.exit(0);
  }, 20000);
};

ws.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data as string);
    if (data.type === "message") {
      process.stdout.write(data.content);
    } else if (data.type === "text") {
      process.stdout.write(data.content);
    } else if (data.type === "done") {
      console.log("\n");
    }
  } catch (error) {
    console.log("Message:", event.data);
  }
};
