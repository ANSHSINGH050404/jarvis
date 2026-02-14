import { Telegraf } from "telegraf";
import WebSocket from "ws";
import dotenv from "dotenv";

dotenv.config(); // Load environment variables

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GATEWAY_URL = process.env.GATEWAY_URL || "ws://localhost:3000/ws";

console.log("🚀 Starting Jarvis Telegram Client...");
console.log(`📡 Gateway URL: ${GATEWAY_URL}`);
console.log(
  `🤖 Bot Token: ${BOT_TOKEN ? BOT_TOKEN.substring(0, 10) + "..." : "MISSING"}`,
);

if (!BOT_TOKEN) {
  console.error("❌ TELEGRAM_BOT_TOKEN is missing in .env");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const sessions = new Map<number, WebSocket>();
const messageBuffers = new Map<number, string>(); // Buffer for streaming responses

// Helper to get or create a WebSocket connection for a chat session
function getSession(chatId: number): WebSocket {
  let ws = sessions.get(chatId);

  if (!ws || ws.readyState === WebSocket.CLOSED) {
    const userId = `telegram_user_${chatId}`;
    const sessionId = `telegram_chat_${chatId}`;
    const url = `${GATEWAY_URL}?userId=${userId}&sessionId=${sessionId}`;

    console.log(`🔌 Connecting session for chat ${chatId}...`);
    ws = new WebSocket(url);

    ws.on("open", () => {
      console.log(`✅ Session connected for chat ${chatId}`);
    });

    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log(
          `[DEBUG] Received chunk type: ${message.type}, content length: ${message.content?.length}`,
        );

        if (message.type === "text") {
          // Buffer text chunks
          const current = messageBuffers.get(chatId) || "";
          messageBuffers.set(chatId, current + message.content);
          // Keep typing indicator active
          bot.telegram.sendChatAction(chatId, "typing").catch(() => {});
        } else if (message.type === "done") {
          // Send operational buffer
          const finalMessage = messageBuffers.get(chatId);
          if (finalMessage) {
            bot.telegram
              .sendMessage(chatId, finalMessage, { parse_mode: "Markdown" })
              .catch(() => bot.telegram.sendMessage(chatId, finalMessage)); // Fallback if markdown fails
            messageBuffers.set(chatId, ""); // Clear buffer
          }
        } else if (message.type === "error") {
          const finalMessage = messageBuffers.get(chatId);
          if (finalMessage) bot.telegram.sendMessage(chatId, finalMessage); // Send whatever we have
          bot.telegram.sendMessage(chatId, `❌ Error: ${message.content}`);
          messageBuffers.set(chatId, "");
        }
      } catch (err) {
        console.error("Error parsing message from Jarvis:", err);
      }
    });

    ws.on("close", () => {
      console.log(`Session closed for chat ${chatId}`);
      sessions.delete(chatId);
    });

    ws.on("error", (err) => {
      console.error(`WebSocket error for chat ${chatId}:`, err);
      bot.telegram.sendMessage(
        chatId,
        "⚠️ Connection to Jarvis lost. Retrying...",
      );
      sessions.delete(chatId);
    });

    sessions.set(chatId, ws);
  }

  return ws;
}

// Handle incoming text messages
bot.on("text", async (ctx) => {
  const chatId = ctx.chat.id;
  const text = ctx.message.text;
  const username = ctx.from.first_name || "User";

  const ws = getSession(chatId);

  // Wait for connection to open if new
  if (ws.readyState === WebSocket.CONNECTING) {
    await new Promise((resolve) => ws.once("open", resolve));
  }

  if (ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        type: "message",
        content: text,
        metadata: { source: "telegram", username },
      }),
    );
    ctx.sendChatAction("typing"); // Show typing indicator
  } else {
    ctx.reply("⚠️ Could not connect to Jarvis. Please try again.");
  }
});

bot
  .launch()
  .then(() => {
    console.log("🤖 Telegram Bot is online!");
  })
  .catch((err) => {
    console.error("Failed to launch bot:", err);
  });

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
