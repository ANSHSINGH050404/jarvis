/**
 * Persistence Data Types
 */

export interface PersistedSession {
  id: string; // Session ID (PK)
  userId: string; // User ID
  createdAt: number; // Timestamp
  updatedAt: number; // Last activity
  metadata?: Record<string, unknown>; // Extra data
}

export interface PersistedMessage {
  id: string; // Message ID (PK)
  sessionId: string; // Session ID (FK)
  role: "system" | "user" | "assistant" | "tool"; // Message author
  content: string; // Message body
  createdAt: number; // Timestamp
}

/**
 * Message with extra fields for tool calls if needed
 */
export interface EnhancedPersistedMessage extends PersistedMessage {
  toolCalls?: any; // JSON serialized tool calls
  functionResponse?: any; // JSON serialized function result
}
