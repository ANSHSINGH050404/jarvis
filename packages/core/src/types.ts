/**
 * Core type definitions for the JARVIS AI assistant platform
 *
 * These types form the contract between all system components.
 * Changes here affect: gateway, agent, tools, memory, and channels.
 */

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Supported channel types for message ingestion
 */
export type ChannelType =
  | "telegram"
  | "cli"
  | "http"
  | "websocket"
  | "discord"
  | "slack";

/**
 * Session lifecycle states
 */
export type SessionState = "active" | "paused" | "ended" | "error";

/**
 * User session tracking state and context
 *
 * Sessions are the fundamental unit of conversation tracking.
 * Each user interaction creates or attaches to a session.
 */
export interface Session {
  /** Unique session identifier (channel-specific, e.g., 'tg_123456') */
  id: string;

  /** Cross-channel user identifier for linking sessions */
  userId: string;

  /** Channel that created this session */
  channel: ChannelType;

  /** Current session state */
  state: SessionState;

  /** Arbitrary session metadata (preferences, temp data, etc.) */
  context: Record<string, unknown>;

  /** Session creation timestamp (Unix ms) */
  createdAt: number;

  /** Last activity timestamp (Unix ms) */
  lastActivity: number;

  /** Optional session expiry timestamp */
  expiresAt?: number;
}

// ============================================================================
// MESSAGING
// ============================================================================

/**
 * Message direction for tracking flow
 */
export type MessageDirection = "incoming" | "outgoing";

/**
 * Message content types
 */
export type MessageContentType =
  | "text"
  | "image"
  | "file"
  | "audio"
  | "video"
  | "tool_result";

/**
 * Normalized message structure across all channels
 *
 * Channel adapters convert platform-specific messages to this format
 */
export interface Message {
  /** Unique message ID */
  id: string;

  /** Associated session ID */
  sessionId: string;

  /** User ID who sent/received this message */
  userId: string;

  /** Message direction */
  direction: MessageDirection;

  /** Content type */
  contentType: MessageContentType;

  /** Message content (text, URL, base64, etc.) */
  content: string;

  /** Optional structured metadata */
  metadata?: Record<string, unknown>;

  /** Message timestamp */
  timestamp: number;
}

/**
 * Incoming message from a channel adapter
 */
export interface IncomingMessage extends Omit<Message, "id" | "direction"> {
  /** Channel this message came from */
  channel: ChannelType;
}

/**
 * Outgoing message to be sent through a channel
 */
export interface OutgoingMessage extends Omit<Message, "direction"> {
  /** Target channel for delivery */
  channel: ChannelType;

  /** Optional reply-to message ID */
  replyToMessageId?: string;
}

// ============================================================================
// EVENTS
// ============================================================================

/**
 * System event types for the event bus
 */
export type EventType =
  | "session.created"
  | "session.updated"
  | "session.ended"
  | "message.received"
  | "message.sent"
  | "agent.thinking"
  | "agent.tool_call"
  | "agent.response"
  | "agent.error"
  | "tool.executed"
  | "tool.error";

/**
 * Base event structure for the event bus
 */
export interface BaseEvent<T = unknown> {
  /** Event type identifier */
  type: EventType;

  /** Event payload */
  payload: T;

  /** Event timestamp */
  timestamp: number;

  /** Optional correlation ID for request tracing */
  correlationId?: string;
}

/**
 * Session-related events
 */
export interface SessionEvent extends BaseEvent<Session> {
  type: "session.created" | "session.updated" | "session.ended";
}

/**
 * Message-related events
 */
export interface MessageEvent extends BaseEvent<Message> {
  type: "message.received" | "message.sent";
}

/**
 * Agent-related events
 */
export interface AgentEvent extends BaseEvent {
  type: "agent.thinking" | "agent.tool_call" | "agent.response" | "agent.error";
  payload: {
    sessionId: string;
    data: unknown;
  };
}

/**
 * Union type of all events
 */
export type Event = SessionEvent | MessageEvent | AgentEvent;

// ============================================================================
// STREAMING
// ============================================================================

/**
 * Streaming response chunk types
 */
export type StreamChunkType =
  | "text"
  | "tool_call"
  | "tool_result"
  | "thinking"
  | "done"
  | "error";

/**
 * Streaming response chunk
 */
export interface StreamChunk {
  /** Chunk type */
  type: StreamChunkType;

  /** Session ID this chunk belongs to */
  sessionId: string;

  /** Chunk content */
  content: string;

  /** Optional metadata */
  metadata?: Record<string, unknown>;

  /** Sequence number for ordering */
  sequence: number;

  /** Timestamp */
  timestamp: number;
}

// ============================================================================
// TOOLS (Week 3 - defined now for type safety)
// ============================================================================

/**
 * Tool parameter definition (JSON Schema-like)
 */
export interface ToolParameter {
  type: "string" | "number" | "boolean" | "object" | "array";
  description: string;
  required?: boolean;
  default?: unknown;
  enum?: unknown[];
  items?: { type: string };
}

/**
 * Tool definition for LLM function calling
 */
export interface ToolDefinition {
  /** Unique tool name (snake_case) */
  name: string;

  /** Human-readable description for LLM */
  description: string;

  /** Tool parameters */
  parameters: Record<string, ToolParameter>;

  /** Required parameter names */
  required: string[];

  /** Permissions needed to execute this tool */
  permissions?: string[];
}

/**
 * Tool execution request
 */
export interface ToolCall {
  /** Tool name to execute */
  tool: string;

  /** Arguments for the tool */
  args: Record<string, unknown>;

  /** Unique call ID for tracking */
  callId: string;
}

/**
 * Tool execution result
 */
export interface ToolResult {
  /** Call ID this result corresponds to */
  callId: string;

  /** Tool that was executed */
  tool: string;

  /** Execution success status */
  success: boolean;

  /** Result data (if successful) */
  data?: unknown;

  /** Error message (if failed) */
  error?: string;

  /** Execution duration in ms */
  duration: number;
}

// ============================================================================
// AGENT RUNTIME (Week 2 - defined now for type safety)
// ============================================================================

/**
 * Agent response structure
 */
export interface AgentResponse {
  /** Session this response belongs to */
  sessionId: string;

  /** Final text response */
  text: string;

  /** Tools that were called during this response */
  toolCalls?: ToolCall[];

  /** Tool execution results */
  toolResults?: ToolResult[];

  /** Token usage statistics */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };

  /** Response generation time in ms */
  duration: number;
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Error severity levels
 */
export type ErrorSeverity = "low" | "medium" | "high" | "critical";

/**
 * Structured error with context
 */
export interface JarvisError {
  /** Error code for categorization */
  code: string;

  /** Human-readable error message */
  message: string;

  /** Error severity */
  severity: ErrorSeverity;

  /** Optional error details */
  details?: Record<string, unknown>;

  /** Optional original error stack */
  stack?: string;

  /** Timestamp when error occurred */
  timestamp: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Gateway server configuration
 */
export interface GatewayConfig {
  host: string;
  port: number;
  wsPort: number;
  apiKey?: string;
}

/**
 * Agent runtime configuration
 */
export interface AgentConfig {
  provider: "gemini" | "openai";
  model: string;
  apiKey: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * System-wide configuration
 */
export interface Config {
  gateway: GatewayConfig;
  agent?: AgentConfig;
  logLevel: "debug" | "info" | "warn" | "error";
}
