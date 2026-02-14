/**
 * Gemini LLM Provider
 *
 * Architecture:
 * - Wrapper around Google Generative AI SDK
 * - Handles streaming and non-streaming responses
 * - Manages token counting and rate limits
 * - Provides unified interface for different models
 *
 * Design decisions:
 * - Use gemini-1.5-flash for speed (Week 2)
 * - Can switch to gemini-1.5-pro for Week 3+ (better reasoning)
 * - Stream by default for better UX
 */

import {
  GoogleGenerativeAI,
  type GenerativeModel,
  type FunctionDeclaration,
  type FunctionCall,
  SchemaType,
} from "@google/generative-ai";
import { createLogger, AgentError, type ToolCall } from "@jarvis/core";

const logger = createLogger("GeminiProvider");

/**
 * Convert string type to Gemini SchemaType
 */
function toSchemaType(type: string): SchemaType {
  switch (type.toLowerCase()) {
    case "string":
      return SchemaType.STRING;
    case "number":
      return SchemaType.NUMBER;
    case "boolean":
      return SchemaType.BOOLEAN;
    case "object":
      return SchemaType.OBJECT;
    case "array":
      return SchemaType.ARRAY;
    default:
      return SchemaType.STRING;
  }
}

/**
 * Convert our tool definitions to Gemini FunctionDeclaration format
 */
function toFunctionDeclarations(
  tools: Array<{
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, any>;
      required: string[];
    };
  }>,
): FunctionDeclaration[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: {
      type: toSchemaType(tool.parameters.type),
      properties: Object.fromEntries(
        Object.entries(tool.parameters.properties).map(([key, prop]) => [
          key,
          {
            type: toSchemaType(prop.type),
            description: prop.description,
            ...(prop.enum ? { enum: prop.enum } : {}),
            ...(prop.items
              ? { items: { type: toSchemaType(prop.items.type) } }
              : {}),
          },
        ]),
      ),
      required: tool.parameters.required,
    },
  }));
}

export interface GeminiConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
}

export interface Message {
  role: "user" | "model" | "function";
  parts: Array<{
    text?: string;
    functionCall?: FunctionCall;
    functionResponse?: any;
  }>;
}

export interface GenerateOptions {
  stream?: boolean;
  systemInstruction?: string;
  tools?: Array<{
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, { type: string; description: string }>;
      required: string[];
    };
  }>;
}

export interface GenerateResponse {
  text?: string;
  toolCalls?: ToolCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
}

export class GeminiProvider {
  private client: GoogleGenerativeAI;
  private model: GenerativeModel;
  private config: Required<Omit<GeminiConfig, "apiKey">>;

  constructor(config: GeminiConfig) {
    if (!config.apiKey || config.apiKey === "your_gemini_api_key") {
      throw new AgentError(
        "Gemini API key not configured. Set GEMINI_API_KEY in .env file.",
        { config: { ...config, apiKey: "[REDACTED]" } },
      );
    }

    this.client = new GoogleGenerativeAI(config.apiKey);

    this.config = {
      model: config.model || "gemini-2.5-flash",
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens || 2048,
      topP: config.topP ?? 0.95,
      topK: config.topK ?? 40,
    };

    this.model = this.client.getGenerativeModel({
      model: this.config.model,
    });

    logger.info("GeminiProvider initialized", {
      model: this.config.model,
      temperature: this.config.temperature,
    });
  }

  /**
   * Generate a response from the LLM
   */
  async generate(
    messages: Message[],
    options: GenerateOptions = {},
  ): Promise<GenerateResponse> {
    try {
      logger.debug("Generating response", {
        messageCount: messages.length,
        stream: options.stream,
        hasTools: !!options.tools,
      });

      // Build generation config
      const generationConfig = {
        temperature: this.config.temperature,
        maxOutputTokens: this.config.maxTokens,
        topP: this.config.topP,
        topK: this.config.topK,
      };

      // Convert messages to chat history format
      const history = messages.slice(0, -1); // All but last message
      const userMessage = messages[messages.length - 1]; // Last message

      if (!userMessage || userMessage.role !== "user") {
        throw new AgentError("Last message must be from user");
      }

      // Build tools for Gemini API using type-safe converter
      const tools = options.tools
        ? [
            {
              functionDeclarations: toFunctionDeclarations(options.tools),
            },
          ]
        : undefined;

      // Create model with system instruction and tools if provided
      const model = this.client.getGenerativeModel({
        model: this.config.model,
        systemInstruction: options.systemInstruction,
        tools,
      });

      // Log request details
      logger.debug("Gemini Request", {
        model: this.config.model,
        historyCount: history.length,
        userParts: userMessage.parts,
        hasTools: !!tools,
      });

      // Start chat session
      const chat = model.startChat({
        generationConfig,
        history: history.map((msg) => ({
          role: msg.role,
          parts: msg.parts,
        })) as any,
      });

      // Send message
      const result = await chat.sendMessage(userMessage.parts[0]?.text || "");
      const response = result.response;

      // Check if LLM wants to call functions
      const functionCalls = response.functionCalls();

      if (functionCalls && functionCalls.length > 0) {
        logger.debug("Function calls detected", {
          count: functionCalls.length,
          functions: functionCalls.map((fc) => fc.name),
        });

        const toolCalls: ToolCall[] = functionCalls.map((fc) => ({
          tool: fc.name,
          args: fc.args as Record<string, unknown>,
          callId: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        }));

        return {
          toolCalls,
          finishReason: "tool_calls",
        };
      }

      // Regular text response
      const text = response.text();

      logger.debug("Response generated", {
        textLength: text.length,
      });

      return {
        text,
        usage: {
          promptTokens: 0, // Gemini doesn't provide this in basic API
          completionTokens: 0,
          totalTokens: 0,
        },
      };
    } catch (error) {
      logger.error("Generation failed", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        error,
      });
      throw new AgentError("Failed to generate response", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Generate a streaming response
   */
  async *generateStream(
    messages: Message[],
    options: GenerateOptions = {},
  ): AsyncGenerator<string, void, unknown> {
    try {
      logger.debug("Generating streaming response", {
        messageCount: messages.length,
      });

      const generationConfig = {
        temperature: this.config.temperature,
        maxOutputTokens: this.config.maxTokens,
        topP: this.config.topP,
        topK: this.config.topK,
      };

      const history = messages.slice(0, -1);
      const userMessage = messages[messages.length - 1];

      if (!userMessage || userMessage.role !== "user") {
        throw new AgentError("Last message must be from user");
      }

      const model = options.systemInstruction
        ? this.client.getGenerativeModel({
            model: this.config.model,
            systemInstruction: options.systemInstruction,
          })
        : this.model;

      const chat = model.startChat({
        generationConfig,
        history: history.map((msg) => ({
          role: msg.role,
          parts: msg.parts,
        })),
      });

      // Send message with streaming
      const result = await chat.sendMessageStream(
        userMessage.parts[0]?.text || "",
      );

      // Yield chunks as they arrive
      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          yield text;
        }
      }

      logger.debug("Streaming complete");
    } catch (error) {
      logger.error("Streaming failed", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        error,
      });
      throw new AgentError("Failed to generate streaming response", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Count tokens in text (approximate)
   */
  async countTokens(text: string): Promise<number> {
    try {
      const result = await this.model.countTokens(text);
      return result.totalTokens;
    } catch (error) {
      logger.warn("Token counting failed, using approximation", { error });
      // Fallback: rough approximation (1 token ≈ 4 characters)
      return Math.ceil(text.length / 4);
    }
  }

  /**
   * Get model info
   */
  getModelInfo() {
    return {
      model: this.config.model,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
    };
  }

  /**
   * Generate embedding for text
   */
  async embed(text: string): Promise<number[]> {
    try {
      // Use embedding-001 for better compatibility
      const embeddingModel = this.client.getGenerativeModel({
        model: "embedding-001",
      });

      const result = await embeddingModel.embedContent(text);

      return result.embedding.values;
    } catch (error: any) {
      logger.error("Embedding generation failed, returning dummy vector", {
        error: error instanceof Error ? error.message : String(error),
      });
      // Return a dummy float32 vector of 768 dimensions (embedding-001 size)
      // We add a tiny value to avoid zero-norm issues in distance calculations
      const dummy = new Array(768).fill(0);
      dummy[0] = 0.0001;
      return dummy;
    }
  }
}
