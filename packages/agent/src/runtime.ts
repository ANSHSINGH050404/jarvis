/**
 * Agent Runtime
 *
 * The brain of JARVIS - orchestrates:
 * 1. Receiving messages from event bus
 * 2. Managing conversation history per session
 * 3. Building prompts with context
 * 4. Calling LLM (streaming or non-streaming)
 * 5. Sending responses back through event bus
 *
 * Week 2: Basic conversational agent
 * Week 3: Add tool calling loop
 * Week 4: Add memory persistence
 */

import {
  type Message,
  type StreamChunk,
  type ToolCall,
  type ToolResult,
  createLogger,
  eventBus,
  generateId,
} from "@jarvis/core";
import { GeminiProvider, type GeminiConfig } from "./llm/gemini.js";
import {
  PromptBuilder,
  type ConversationMessage,
  type PromptContext,
} from "./prompt/builder.js";
import { ToolRegistry, type ToolContext } from "@jarvis/tools";
import { MemoryStore, type PersistedMessage } from "@jarvis/memory";
import { SkillRegistry, CodingSkill, ResearchSkill } from "@jarvis/skills";

const logger = createLogger("AgentRuntime");

export interface AgentConfig {
  gemini: GeminiConfig;
  streaming?: boolean;
  maxConversationLength?: number;
  workingDirectory?: string;
  enableTools?: boolean;
}

/**
 * Main agent runtime
 */
export class AgentRuntime {
  private llm: GeminiProvider;
  private promptBuilder: PromptBuilder;
  private toolRegistry: ToolRegistry;
  private skillRegistry: SkillRegistry;
  private memoryStore?: MemoryStore;
  private config: AgentConfig;

  // In-memory conversation storage (fallback if no memory store)
  private conversations: Map<string, ConversationMessage[]> = new Map();

  constructor(
    config: AgentConfig,
    toolRegistry?: ToolRegistry,
    memoryStore?: MemoryStore,
  ) {
    this.config = config;
    this.llm = new GeminiProvider(config.gemini);
    this.promptBuilder = new PromptBuilder();
    this.toolRegistry = toolRegistry || new ToolRegistry();
    this.memoryStore = memoryStore;
    this.skillRegistry = new SkillRegistry();

    // Register skills (Week 6)
    if (this.config.enableTools) {
      this.registerSkills();
    }

    // Register internal tools (memory)
    if (this.config.enableTools && this.memoryStore) {
      this.registerInternalTools();
    }

    logger.info("AgentRuntime initialized", {
      model: this.llm.getModelInfo().model,
      streaming: config.streaming ?? true,
      toolsEnabled: config.enableTools ?? false,
      toolCount: this.toolRegistry.getToolNames().length,
      persistence: !!this.memoryStore,
    });
  }

  /**
   * Register default skills
   */
  private registerSkills() {
    this.skillRegistry.register(CodingSkill);
    this.skillRegistry.register(ResearchSkill);

    // Register tools from skills
    const tools = this.skillRegistry.getAllTools();
    this.toolRegistry.registerMany(tools);

    logger.info("Registered skills", {
      skills: this.skillRegistry.getAll().map((s) => s.name),
      toolCount: tools.length,
    });
  }

  /**
   * Register internal tools
   */
  private registerInternalTools() {
    if (!this.memoryStore) return;

    // save_memory
    this.toolRegistry.register({
      name: "save_memory",
      description:
        "Save important information, facts, or context to long-term memory.",
      category: "memory",
      parameters: {
        content: { type: "string", description: "The information to save" },
      },
      required: ["content"],
      executor: async (args: any) => {
        try {
          const embedding = await this.llm.embed(args.content);
          this.memoryStore!.memories.add(args.content, embedding);
          return { success: true, message: "Memory saved successfully" };
        } catch (error) {
          return { success: false, error: String(error) };
        }
      },
    });

    // search_memory
    this.toolRegistry.register({
      name: "search_memory",
      description: "Search long-term memory for relevant information.",
      category: "memory",
      parameters: {
        query: { type: "string", description: "The search query" },
      },
      required: ["query"],
      executor: async (args: any) => {
        try {
          const embedding = await this.llm.embed(args.query);
          const results = this.memoryStore!.memories.search(embedding, 5);
          return { success: true, results };
        } catch (error) {
          return { success: false, error: String(error) };
        }
      },
    });
  }

  /**
   * Retrieve relevant context from memory
   */
  private async retrieveContext(query: string): Promise<string> {
    if (!this.memoryStore) return "";

    try {
      const embedding = await this.llm.embed(query);
      const results = this.memoryStore.memories.search(embedding, 3);

      if (results.length === 0) return "";

      const formatted = results
        .filter((m) => (m.score || 0) > 0.55) // Only relevant memories
        .map((m) => `- ${m.content} (Confidence: ${m.score?.toFixed(2)})`)
        .join("\n");

      return formatted ? formatted : "";
    } catch (error) {
      logger.warn("Failed to retrieve context", { error });
      return "";
    }
  }

  /**
   * Start the agent - subscribe to events
   */
  async start(): Promise<void> {
    // Subscribe to incoming messages
    eventBus.subscribe("message.received", async (event: any) => {
      const message = event.payload as Message;

      // Only process text messages
      if (message.contentType !== "text") {
        logger.debug("Skipping non-text message", {
          contentType: message.contentType,
        });
        return;
      }

      await this.handleMessage(message);
    });

    logger.info("AgentRuntime started - listening for messages");
  }

  /**
   * Load conversation history
   */
  private async loadConversation(
    sessionId: string,
  ): Promise<ConversationMessage[]> {
    if (this.memoryStore) {
      const messages = this.memoryStore.messages.getRecent(
        sessionId,
        this.config.maxConversationLength || 20,
      );
      return messages.map((msg) => ({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: msg.content,
        timestamp: msg.createdAt,
      }));
    }
    return this.conversations.get(sessionId) || [];
  }

  /**
   * Save message to conversation
   */
  private async appendToConversation(
    sessionId: string,
    userId: string,
    message: ConversationMessage,
  ): Promise<void> {
    // 1. Update in-memory (always needed for current turn context if we don't reload every time)
    let conversation = this.conversations.get(sessionId);
    if (!conversation) {
      conversation = [];
      this.conversations.set(sessionId, conversation);
    }
    conversation.push(message);

    // 2. Persist if memory enabled
    if (this.memoryStore) {
      // Ensure session exists
      this.memoryStore.sessions.create({
        id: sessionId,
        userId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Save message
      this.memoryStore.messages.add({
        id: generateId("msg"),
        sessionId,
        role: message.role,
        content: message.content,
        createdAt: message.timestamp,
      });
    }
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(message: Message): Promise<void> {
    const { sessionId, userId, content } = message;

    logger.info("Processing message", {
      sessionId,
      userId,
      contentLength: content.length,
    });

    try {
      // Load conversation history
      let conversation = await this.loadConversation(sessionId);

      // Add user message to history
      const userMessage = this.promptBuilder.formatUserMessage(content);
      await this.appendToConversation(sessionId, userId, userMessage);

      // Reload conversation to ensure sync (optional but safe)
      conversation = await this.loadConversation(sessionId);

      // Build context
      const context: PromptContext = {
        userId,
        sessionId,
        currentTime: new Date(),
        skillInstructions: this.skillRegistry.getSystemInstructions(),
      };

      // Inject memory context for RAG
      if (this.memoryStore) {
        const memoryContext = await this.retrieveContext(content);
        if (memoryContext) {
          context.memories = memoryContext;
          logger.info("Injected relevant memories into context", { sessionId });
        }
      }

      // Generate response
      if (this.config.streaming ?? true) {
        await this.generateStreamingResponse(sessionId, conversation, context);
      } else {
        await this.generateResponse(sessionId, conversation, context);
      }
    } catch (error) {
      logger.error("Error handling message", { error, sessionId });

      // Send error message to user
      await this.sendMessage(
        sessionId,
        userId,
        "Sorry, I encountered an error processing your message. Please try again.",
      );
    }
  }

  /**
   * Generate non-streaming response
   */
  private async generateResponse(
    sessionId: string,
    conversation: ConversationMessage[],
    context: PromptContext,
  ): Promise<void> {
    logger.debug("Generating response", { sessionId });

    // Build messages for LLM
    const messages = this.promptBuilder.buildMessages(conversation, context);
    const systemInstruction =
      this.promptBuilder.buildSystemInstruction(context);

    // Get tool definitions if tools are enabled
    const tools = this.config.enableTools
      ? this.toolRegistry.getDefinitions()
      : undefined;

    // Generate response
    const startTime = Date.now();
    const result = await this.llm.generate(messages, {
      systemInstruction,
      tools,
    });
    const duration = Date.now() - startTime;

    // Check if LLM wants to use tools
    if (result.toolCalls && result.toolCalls.length > 0) {
      logger.info("Tool calls requested", {
        sessionId,
        count: result.toolCalls.length,
        tools: result.toolCalls.map((tc) => tc.tool),
      });

      // Execute tools
      const toolContext: ToolContext = {
        sessionId,
        userId: context.userId,
        workingDirectory: this.config.workingDirectory || process.cwd(),
      };

      const toolResults = await this.toolRegistry.executeMany(
        result.toolCalls,
        toolContext,
      );

      // Send tool execution results back to user for now
      // TODO: In future, feed results back to LLM for synthesis
      const resultsSummary = toolResults
        .map((tr) => {
          if (tr.success) {
            return `✅ ${tr.tool}: ${JSON.stringify(tr.data, null, 2)}`;
          } else {
            return `❌ ${tr.tool}: ${tr.error}`;
          }
        })
        .join("\n\n");

      await this.sendMessage(sessionId, context.userId, resultsSummary);

      return;
    }

    // Regular text response
    if (result.text) {
      logger.info("Response generated", {
        sessionId,
        duration,
        textLength: result.text.length,
      });

      // Add assistant response to history
      const assistantMessage = this.promptBuilder.formatAssistantMessage(
        result.text,
      );
      await this.appendToConversation(
        sessionId,
        context.userId,
        assistantMessage,
      );

      // Send response
      await this.sendMessage(sessionId, context.userId, result.text);
    } else {
      logger.warn("No text or tool calls in response", { sessionId });
      await this.sendMessage(
        sessionId,
        context.userId,
        "I'm not sure how to respond to that.",
      );
    }
  }

  /**
   * Generate streaming response with tool support
   *
   * Two-phase execution:
   * 1. Non-streaming: Check if tools needed, execute them
   * 2. Streaming: Synthesize natural response from tool results
   */
  private async generateStreamingResponse(
    sessionId: string,
    conversation: ConversationMessage[],
    context: PromptContext,
  ): Promise<void> {
    logger.debug("Generating streaming response", { sessionId });

    // Build messages for LLM
    const messages = this.promptBuilder.buildMessages(conversation, context);
    const systemInstruction =
      this.promptBuilder.buildSystemInstruction(context);

    // Get tool definitions if tools are enabled
    const tools = this.config.enableTools
      ? this.toolRegistry.getDefinitions()
      : undefined;

    // PHASE 1: Check if tools are needed (non-streaming)
    if (tools && tools.length > 0) {
      logger.debug("Checking for tool needs", { sessionId });

      const toolCheckResult = await this.llm.generate(messages, {
        systemInstruction,
        tools,
      });

      // If LLM wants to use tools, execute them
      if (toolCheckResult.toolCalls && toolCheckResult.toolCalls.length > 0) {
        logger.info("Tool calls requested", {
          sessionId,
          count: toolCheckResult.toolCalls.length,
          tools: toolCheckResult.toolCalls.map((tc) => tc.tool),
        });

        // Execute tools
        const toolContext: ToolContext = {
          sessionId,
          userId: context.userId,
          workingDirectory: this.config.workingDirectory || process.cwd(),
        };

        const toolResults = await this.toolRegistry.executeMany(
          toolCheckResult.toolCalls,
          toolContext,
        );

        // PHASE 2: Synthesize results into natural response (streaming)
        const resultsContext = toolResults
          .map((tr) => {
            if (tr.success) {
              return `Tool ${tr.tool} succeeded: ${JSON.stringify(tr.data)}`;
            } else {
              return `Tool ${tr.tool} failed: ${tr.error}`;
            }
          })
          .join("\n");

        // Add context about tool results to the conversation
        const synthesisPrompt = `Based on the following tool execution results, provide a natural, helpful response to the user:\n\n${resultsContext}\n\nProvide a clear, concise answer.`;

        // Add tool results as a system message
        const synthesisMessages = [
          ...messages,
          {
            role: "model" as const,
            parts: [
              { text: "I'll use the available tools to help with that." },
            ],
          },
          {
            role: "user" as const,
            parts: [{ text: synthesisPrompt }],
          },
        ];

        // Stream the synthesis
        const startTime = Date.now();
        let fullResponse = "";
        let sequence = 0;

        try {
          for await (const chunk of this.llm.generateStream(synthesisMessages, {
            systemInstruction:
              "You are a helpful assistant. Synthesize the tool results into a natural, conversational response.",
          })) {
            fullResponse += chunk;

            await this.sendStreamChunk({
              type: "text",
              sessionId,
              content: chunk,
              sequence: sequence++,
              timestamp: Date.now(),
            });
          }

          await this.sendStreamChunk({
            type: "done",
            sessionId,
            content: "",
            sequence: sequence++,
            timestamp: Date.now(),
          });

          const duration = Date.now() - startTime;

          logger.info("Synthesis streaming complete", {
            sessionId,
            duration,
            textLength: fullResponse.length,
            chunks: sequence,
          });

          // Add to conversation history
          const assistantMessage =
            this.promptBuilder.formatAssistantMessage(fullResponse);
          await this.appendToConversation(
            sessionId,
            context.userId,
            assistantMessage,
          );

          await this.sendMessage(sessionId, context.userId, fullResponse);

          return;
        } catch (error) {
          logger.error("Synthesis streaming error", { error, sessionId });
          throw error;
        }
      }
    }

    // No tools needed - regular streaming response
    const startTime = Date.now();
    let fullResponse = "";
    let sequence = 0;

    try {
      for await (const chunk of this.llm.generateStream(messages, {
        systemInstruction,
      })) {
        fullResponse += chunk;

        await this.sendStreamChunk({
          type: "text",
          sessionId,
          content: chunk,
          sequence: sequence++,
          timestamp: Date.now(),
        });
      }

      // Send completion chunk
      await this.sendStreamChunk({
        type: "done",
        sessionId,
        content: "",
        sequence: sequence++,
        timestamp: Date.now(),
      });

      const duration = Date.now() - startTime;

      logger.info("Streaming response complete", {
        sessionId,
        duration,
        textLength: fullResponse.length,
        chunks: sequence,
      });

      // Add assistant response to history
      const assistantMessage =
        this.promptBuilder.formatAssistantMessage(fullResponse);
      await this.appendToConversation(
        sessionId,
        context.userId,
        assistantMessage,
      );

      // Also send as final message (for non-streaming clients)
      await this.sendMessage(sessionId, context.userId, fullResponse);
    } catch (error) {
      logger.error("Streaming error", { error, sessionId });

      // Send error chunk
      await this.sendStreamChunk({
        type: "error",
        sessionId,
        content: "Stream interrupted",
        sequence: sequence,
        timestamp: Date.now(),
      });

      throw error;
    }
  }

  /**
   * Send message through event bus
   */
  private async sendMessage(
    sessionId: string,
    userId: string,
    content: string,
  ): Promise<void> {
    await eventBus.publish({
      type: "message.sent",
      payload: {
        id: generateId("msg"),
        sessionId,
        userId,
        direction: "outgoing",
        contentType: "text",
        content,
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    });
  }

  /**
   * Send stream chunk through event bus
   */
  private async sendStreamChunk(chunk: StreamChunk): Promise<void> {
    await eventBus.publish({
      type: "agent.response",
      payload: {
        sessionId: chunk.sessionId,
        data: chunk,
      },
      timestamp: Date.now(),
    });
  }

  /**
   * Get conversation history for a session
   */
  getConversation(sessionId: string): ConversationMessage[] {
    return this.conversations.get(sessionId) || [];
  }

  /**
   * Clear conversation history for a session
   */
  clearConversation(sessionId: string): void {
    this.conversations.delete(sessionId);
    logger.info("Conversation cleared", { sessionId });
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      activeSessions: this.conversations.size,
      modelInfo: this.llm.getModelInfo(),
    };
  }
}
