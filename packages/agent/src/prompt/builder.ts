/**
 * Prompt Builder
 *
 * Responsibilities:
 * - Build system prompts with personality
 * - Format conversation history
 * - Add context (user info, time, etc.)
 * - Prepare prompts for tool calling (Week 3)
 *
 * Design philosophy:
 * - Clear, structured prompts
 * - Personality: helpful, concise, action-oriented
 * - Context-aware (time, user preferences)
 */

import { createLogger } from "@jarvis/core";
import type { Message as LLMMessage } from "../llm/gemini.js";

const logger = createLogger("PromptBuilder");

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface PromptContext {
  userId: string;
  sessionId: string;
  userName?: string;
  userPreferences?: Record<string, unknown>;
  currentTime?: Date;
  availableTools?: string[]; // For Week 3
  memories?: string; // For Week 5
  skillInstructions?: string; // For Week 6
}

export class PromptBuilder {
  private systemPrompt: string;

  constructor() {
    this.systemPrompt = this.buildSystemPrompt();
  }

  /**
   * Build the core system prompt
   */
  private buildSystemPrompt(): string {
    return `You are JARVIS, a highly capable AI assistant.

Your personality:
- Helpful and proactive
- Concise but thorough
- Action-oriented (you prefer doing over explaining, when possible)
- Professional yet friendly
- Privacy-respecting (all data stays local)

Your capabilities:
- Answer questions across many domains
- Help with coding, writing, analysis
- Remember context within conversations
- (More capabilities coming in future updates)

Guidelines:
- Be direct and clear
- Ask for clarification when needed
- Admit when you don't know something
- Prioritize user's intent over literal interpretation
- Keep responses focused and relevant

Current mode: Conversational assistant (Week 2)
Future: Tool execution, file operations, web automation`;
  }

  /**
   * Build messages array for LLM
   */
  buildMessages(
    conversation: ConversationMessage[],
    context: PromptContext,
  ): LLMMessage[] {
    const messages: LLMMessage[] = [];

    // Add conversation history
    for (const msg of conversation) {
      messages.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      });
    }

    logger.debug("Built messages", {
      messageCount: messages.length,
      sessionId: context.sessionId,
    });

    return messages;
  }

  /**
   * Build system instruction with context
   */
  buildSystemInstruction(context: PromptContext): string {
    const parts = [this.systemPrompt];

    // Add contextual information
    const contextInfo: string[] = [];

    if (context.currentTime) {
      contextInfo.push(`Current time: ${context.currentTime.toISOString()}`);
    }

    if (context.userName) {
      contextInfo.push(`User name: ${context.userName}`);
    }

    if (contextInfo.length > 0) {
      parts.push("\nContext:\n" + contextInfo.join("\n"));
    }

    if (context.memories) {
      parts.push("\nRelevant Memories/Facts:\n" + context.memories);
    }

    if (context.skillInstructions) {
      parts.push(context.skillInstructions);
    }

    return parts.join("\n\n");
  }

  /**
   * Format a user message
   */
  formatUserMessage(content: string): ConversationMessage {
    return {
      role: "user",
      content,
      timestamp: Date.now(),
    };
  }

  /**
   * Format an assistant message
   */
  formatAssistantMessage(content: string): ConversationMessage {
    return {
      role: "assistant",
      content,
      timestamp: Date.now(),
    };
  }

  /**
   * Truncate conversation to fit context window
   * Keep most recent messages
   */
  truncateConversation(
    conversation: ConversationMessage[],
    maxMessages: number = 20,
  ): ConversationMessage[] {
    if (conversation.length <= maxMessages) {
      return conversation;
    }

    logger.debug("Truncating conversation", {
      original: conversation.length,
      truncated: maxMessages,
    });

    // Keep the most recent messages
    return conversation.slice(-maxMessages);
  }

  /**
   * Update system prompt (for customization)
   */
  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
    logger.info("System prompt updated");
  }

  /**
   * Get current system prompt
   */
  getSystemPrompt(): string {
    return this.systemPrompt;
  }
}
