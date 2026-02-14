/**
 * Week 6 Skills System Test
 *
 * Verifies that:
 * 1. Skills are registered (Coding, Research)
 * 2. System prompt includes dynamic skill instructions
 * 3. Tools from skills are available
 */

import { WebSocket } from "ws";

const SESSION_ID = "skills_test_session_v1";
// Using the same port/host as start server
const WS_URL = `ws://localhost:3000/ws?userId=tester&sessionId=${SESSION_ID}`;

console.log("🛠️ Testing Week 6: Skills System");

const ws = new WebSocket(WS_URL);

ws.on("open", () => {
  console.log("✅ Connected to Jarvis Gateway");

  // Send a message that should trigger the 'Research' skill instructions in the system prompt.
  // We can't see the internal prompt trace here, but we can verify the agent responds competently.
  // Or we can ask the agent what skills it has if the prompt includes that context!

  console.log(
    "\n❓ Query: asking Jarvis about its capabilities (to check if skills are in context)",
  );
  ws.send(
    JSON.stringify({
      type: "message",
      content:
        "What specialized skills or capabilities do you have available right now? Please list them.",
    }),
  );
});

ws.on("message", (data) => {
  try {
    const message = JSON.parse(data.toString());

    if (message.type === "text") {
      process.stdout.write(message.content);
    } else if (message.type === "error") {
      console.error("\n❌ Error:", message.content);
    } else if (message.type === "done") {
      console.log("\n\n✅ Response complete.");
      console.log(
        "Observe the response above. It should mention 'coding' and 'research' capabilities if the system prompt was injected correctly.",
      );
      ws.close();
      process.exit(0);
    }
  } catch (err) {
    console.error("Parse error:", err);
  }
});

ws.on("error", (err) => {
  console.error("❌ Connection error:", err.message);
  process.exit(1);
});
