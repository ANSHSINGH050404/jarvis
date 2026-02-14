# 🎓 Jarvis Project Learning Guide

Welcome! This guide is designed to help students and developers understand the **Jarvis** AI Agent platform. This project combines modern web technologies, Artificial Intelligence, and software architecture patterns into a powerful, modular system.

We have broken down the complex Jarvis system into **5 manageable mini-projects**. By building these individually, you will master the technology stack used in Jarvis.

---

## 🛠️ The Tech Stack

Jarvis uses a cutting-edge stack optimized for performance and type safety.

| Technology            | Purpose                    | Why we use it                                                  | Learn More                                                             |
| --------------------- | -------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **Bun**               | Runtime & Package Manager  | Faster than Node.js, built-in TypeScript support.              | [bun.sh](https://bun.sh/docs)                                          |
| **TypeScript**        | Programming Language       | Type safety prevents bugs and improves code quality.           | [typescriptlang.org](https://www.typescriptlang.org/docs/)             |
| **Google Gemini**     | Large Language Model (LLM) | Provides the "intelligence" (reasoning, generating text).      | [ai.google.dev](https://ai.google.dev/docs)                            |
| **SQLite**            | Database                   | Fast, file-based database for storing memory.                  | [sqlite.org](https://www.sqlite.org/docs.html)                         |
| **WebSockets (`ws`)** | Real-time Communication    | Allows the Agent to "talk" to the Gateway instantly.           | [npmjs.com/package/ws](https://www.npmjs.com/package/ws)               |
| **Telegraf**          | Telegram Bot Framework     | Connects the AI to a Telegram chat interface.                  | [telegraf.js.org](https://telegraf.js.org/)                            |
| **Vector Embeddings** | Memory Search              | Allows the AI to search memory by _meaning_ (Semantic Search). | [Google Embeddings Guide](https://ai.google.dev/docs/embeddings_guide) |

---

## 🚀 5-Step Project Roadmap

To understand Jarvis, try building these 5 projects in order. Each one establishes a core concept used in this repository.

### Project 1: The CLI Chatbot (Foundation)

**Goal:** Build a simple command-line interface (CLI) tool that runs a TypeScript file using Bun.
**Concepts:**

- Setting up a Bun environment.
- Writing basic TypeScript functions.
- Reading user input from the terminal.
  **Task:**

1.  Install Bun.
2.  Create an `index.ts` file.
3.  Write a script that asks "What is your name?" and prints "Hello, [Name]!".

### Project 2: The AI Brain (LLM Integration)

**Goal:** Connect your CLI tool to Google's Gemini API to answer questions.
**Concepts:**

- API Keys and Environment Variables (`.env`).
- Using the `@google/generative-ai` SDK.
- Asynchronous programming (`async/await`).
  **Task:**

1.  Get a free API Key from Google AI Studio.
2.  Modify your script to accept a user prompt (e.g., "Tell me a joke").
3.  Send the prompt to Gemini and print the AI's response.

### Project 3: The Connected Server (WebSockets)

**Goal:** Move your AI from a script to a server that can handle multiple connections.
**Concepts:**

- Building a WebSocket Server.
- Client-Server architecture.
- Handling events (`connection`, `message`, `close`).
  **Task:**

1.  Create a `server.ts` that listens for WebSocket connections on port 3000.
2.  Create a `client.ts` that connects to the server.
3.  Make the server echo messages back to the client (or send them to the AI!).

- _In Jarvis, this is the **Gateway** package._

### Project 4: The Memory Bank (Database & Vectors)

**Goal:** Give your AI long-term memory so it remembers you.
**Concepts:**

- SQL Databases (SQLite).
- Vector Embeddings (converting text to numbers).
- Cosine Similarity (finding related text).
  **Task:**

1.  Create a `memory.db` SQLite database.
2.  When a user sends a message, generate an **embedding** (vector) using Gemini.
3.  Save the message text and the embedding to the database.
4.  Before answering a new question, search the database for similar messages to provide context.

- _In Jarvis, this is the **Memory** package._

### Project 5: The Agentic Tool User (Tools & Telegram)

**Goal:** Allow your AI to perform actions (like searching files) and talk on Telegram.
**Concepts:**

- Function Calling / Tool Use.
- Building a basic Agent loop (Think -> Act -> Observe).
- integrating third-party platforms (Telegram).
  **Task:**

1.  Define a tool (e.g., `calculate_sum(a, b)`).
2.  Tell the AI about this tool.
3.  If the AI asks to use the tool, run the function in your code and give it the result.
4.  Wrap everything in a Telegram Bot using `Telegraf` so you can chat with it from your phone.

- _In Jarvis, this is the **Agent**, **Tools**, and **Telegram-Client** packages._

---

## 📚 Where to Start in this Codebase?

If you want to read the Jarvis code, start here:

1.  **`packages/agent/src/llm/gemini.ts`**: See how we talk to the AI.
2.  **`packages/agent/src/runtime.ts`**: The main loop where the Agent decides what to do.
3.  **`packages/memory/src/repositories/memory-repository.ts`**: How we save and search vectors.
4.  **`packages/telegram-client/src/index.ts`**: How the Telegram bot connects to our system.

Happy coding! 🚀
