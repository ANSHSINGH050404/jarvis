import { WebSocket } from "ws";

const SESSION_ID = "computer_test_v1";
// Using the same port/host as start server
const WS_URL = `ws://localhost:3000/ws?userId=tester&sessionId=${SESSION_ID}`;

console.log("🖱️ Testing Computer Control Skill");

const ws = new WebSocket(WS_URL);

ws.on("open", () => {
  console.log("✅ Connected. Ordering mouse move...");
  ws.send(
    JSON.stringify({
      type: "message",
      content:
        "press on start menu",
    }),
  );
});

ws.on("message", (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.type === "text") {
    console.log("🤖 Response:", msg.content);
  } else if (msg.type === "error") {
    console.error("❌ Error:", msg.content);
  } else if (msg.type === "done") {
    console.log("✅ Done.");
    ws.close();
    process.exit(0);
  }
});
