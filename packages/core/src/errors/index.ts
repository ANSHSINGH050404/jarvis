/**
 * Custom error classes for JARVIS platform
 *
 * Design rationale:
 * - Structured error information for debugging
 * - Error codes for programmatic handling
 * - Severity levels for alerting/monitoring
 */

import type { JarvisError as IJarvisError, ErrorSeverity } from "../types.js";

/**
 * Base error class for all JARVIS errors
 */
export class JarvisError extends Error implements IJarvisError {
  code: string;
  severity: ErrorSeverity;
  details?: Record<string, unknown>;
  timestamp: number;

  constructor(
    code: string,
    message: string,
    severity: ErrorSeverity = "medium",
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "JarvisError";
    this.code = code;
    this.severity = severity;
    this.details = details;
    this.timestamp = Date.now();

    // Maintain proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): IJarvisError {
    return {
      code: this.code,
      message: this.message,
      severity: this.severity,
      details: this.details,
      stack: this.stack,
      timestamp: this.timestamp,
    };
  }
}

/**
 * Gateway-related errors
 */
export class GatewayError extends JarvisError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("GATEWAY_ERROR", message, "high", details);
    this.name = "GatewayError";
  }
}

/**
 * Session management errors
 */
export class SessionError extends JarvisError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("SESSION_ERROR", message, "medium", details);
    this.name = "SessionError";
  }
}

/**
 * Message processing errors
 */
export class MessageError extends JarvisError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("MESSAGE_ERROR", message, "medium", details);
    this.name = "MessageError";
  }
}

/**
 * Agent runtime errors
 */
export class AgentError extends JarvisError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("AGENT_ERROR", message, "high", details);
    this.name = "AgentError";
  }
}

/**
 * Tool execution errors
 */
export class ToolError extends JarvisError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("TOOL_ERROR", message, "medium", details);
    this.name = "ToolError";
  }
}

/**
 * Configuration errors
 */
export class ConfigError extends JarvisError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("CONFIG_ERROR", message, "critical", details);
    this.name = "ConfigError";
  }
}

/**
 * Validation errors
 */
export class ValidationError extends JarvisError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("VALIDATION_ERROR", message, "low", details);
    this.name = "ValidationError";
  }
}
