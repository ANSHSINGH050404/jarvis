/**
 * Tool Definition Types
 *
 * These types extend the core types to add execution capabilities
 */

import type {
  ToolDefinition as CoreToolDefinition,
  ToolCall,
  ToolResult,
} from "@jarvis/core";

/**
 * Tool execution context
 */
export interface ToolContext {
  sessionId: string;
  userId: string;
  workingDirectory?: string;
}

/**
 * Tool executor function
 */
export type ToolExecutor = (
  args: Record<string, unknown>,
  context: ToolContext,
) => Promise<unknown>;

/**
 * Full tool definition with executor
 */
export interface Tool extends CoreToolDefinition {
  executor: ToolExecutor;
  category?: "filesystem" | "http" | "system" | "custom" | "memory";
}

/**
 * Tool execution error
 */
export class ToolExecutionError extends Error {
  constructor(
    public tool: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ToolExecutionError";
  }
}
