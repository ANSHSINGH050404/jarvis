/**
 * Week 5 RAG Test
 *
 * Tests JARVIS's ability to:
 * 1. Save information to long-term memory (Vector Store)
 * 2. Retrieve relevant information using Semantic Search
 */

import { createLogger } from "../packages/core/src/index.js";

const logger = createLogger("RAGTest");

const SESSION_ID = "rag_test_session_v1";
const WS_URL = `ws://localhost:3000/ws?userId=tester&sessionId=${SESSION_ID}`;

async function testRAG() {
  logger.info("Testing Week 5 Vector Memory (RAG)");

  const ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    logger.info("✅ Connected!");

    // Step 1: Teach JARVIS a fact (trigger save_memory tool)
    setTimeout(() => {
      logger.info("\n🧠 Step 1: Teaching JARVIS (should trigger save_memory)");
      ws.send(
        JSON.stringify({
          type: "message",
          content:
            "Please save this to your long-term memory: The secret codename for Project X is 'Blue Sky'.",
        }),
      );
    }, 1000);

    // Step 2: Ask unrelated question (should NOT retrieve)
    setTimeout(() => {
      logger.info("\n💬 Step 2: Asking unrelated question");
      ws.send(
        JSON.stringify({
          type: "message",
          content: "What is the capital of France?",
        }),
      );
    }, 15000);

    // Step 3: Ask related question (should trigger search_memory or automatic context injection)
    setTimeout(() => {
      logger.info("\n❓ Step 3: Verifying Recall");
      ws.send(
        JSON.stringify({
          type: "message",
          content: "What is the codename for Project X?",
        }),
      );
    }, 25000);

    // Close
    setTimeout(() => {
      logger.info("\n✅ Test complete. Closing connection.");
      ws.close();
      process.exit(0);
    }, 35000);
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

testRAG();
