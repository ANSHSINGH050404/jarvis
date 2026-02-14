/**
 * Tool Registry
 *
 * Central registry for all available tools
 *
 * Responsibilities:
 * - Register tools
 * - Get tool definitions for LLM
 * - Execute tools safely
 * - Track tool usage
 */

import {
  createLogger,
  type ToolCall,
  type ToolResult,
  generateId,
} from "@jarvis/core";
import type { Tool, ToolContext } from "./types.js";
import { ToolExecutionError } from "./types.js";

const logger = createLogger("ToolRegistry");

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();
  private executionHistory: Array<{
    callId: string;
    tool: string;
    timestamp: number;
    duration: number;
  }> = [];

  constructor() {
    logger.info("ToolRegistry initialized");
  }

  /**
   * Register a tool
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      logger.warn("Tool already registered, overwriting", { tool: tool.name });
    }

    this.tools.set(tool.name, tool);
    logger.debug("Tool registered", {
      name: tool.name,
      category: tool.category,
    });
  }

  /**
   * Register multiple tools
   */
  registerMany(tools: Tool[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
    logger.info("Registered tools", { count: tools.length });
  }

  /**
   * Get a tool by name
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all tool definitions (for LLM)
   */
  getDefinitions(): Array<{
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, { type: string; description: string }>;
      required: string[];
    };
  }> {
    const definitions = [];

    for (const tool of this.tools.values()) {
      const properties: Record<string, { type: string; description: string }> =
        {};

      for (const [name, param] of Object.entries(tool.parameters)) {
        properties[name] = {
          type: param.type,
          description: param.description,
        };
      }

      definitions.push({
        name: tool.name,
        description: tool.description,
        parameters: {
          type: "object" as const,
          properties,
          required: tool.required,
        },
      });
    }

    return definitions;
  }

  /**
   * Execute a tool
   */
  async execute(toolCall: ToolCall, context: ToolContext): Promise<ToolResult> {
    const startTime = Date.now();
    const { tool: toolName, args, callId } = toolCall;

    logger.info("Executing tool", {
      tool: toolName,
      callId,
      sessionId: context.sessionId,
    });

    try {
      const tool = this.tools.get(toolName);

      if (!tool) {
        throw new ToolExecutionError(toolName, `Tool not found: ${toolName}`, {
          availableTools: Array.from(this.tools.keys()),
        });
      }

      // Execute the tool
      const result = await tool.executor(args, context);
      const duration = Date.now() - startTime;

      // Track execution
      this.executionHistory.push({
        callId,
        tool: toolName,
        timestamp: startTime,
        duration,
      });

      logger.info("Tool executed successfully", {
        tool: toolName,
        callId,
        duration,
        sessionId: context.sessionId,
      });

      return {
        callId,
        tool: toolName,
        success: true,
        data: result,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error("Tool execution failed", {
        tool: toolName,
        callId,
        error,
        sessionId: context.sessionId,
      });

      return {
        callId,
        tool: toolName,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        duration,
      };
    }
  }

  /**
   * Execute multiple tools
   */
  async executeMany(
    toolCalls: ToolCall[],
    context: ToolContext,
  ): Promise<ToolResult[]> {
    logger.debug("Executing multiple tools", {
      count: toolCalls.length,
      sessionId: context.sessionId,
    });

    // Execute all tools in parallel
    const results = await Promise.all(
      toolCalls.map((call) => this.execute(call, context)),
    );

    return results;
  }

  /**
   * Get tool names list
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Get tools by category
   */
  getByCategory(category: string): Tool[] {
    return Array.from(this.tools.values()).filter(
      (tool) => tool.category === category,
    );
  }

  /**
   * Get execution statistics
   */
  getStats() {
    return {
      totalTools: this.tools.size,
      totalExecutions: this.executionHistory.length,
      toolsByCategory: this.getToolsByCategory(),
    };
  }

  private getToolsByCategory(): Record<string, number> {
    const counts: Record<string, number> = {};

    for (const tool of this.tools.values()) {
      const category = tool.category || "uncategorized";
      counts[category] = (counts[category] || 0) + 1;
    }

    return counts;
  }

  /**
   * Clear execution history
   */
  clearHistory(): void {
    this.executionHistory = [];
    logger.debug("Execution history cleared");
  }
}
