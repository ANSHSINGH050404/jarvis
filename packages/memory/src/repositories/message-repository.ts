/**
 * Message Repository
 *
 * Manages database operations for conversation history.
 */

import type { Database } from "bun:sqlite";
import type { PersistedMessage } from "../types.js";
import { createLogger } from "@jarvis/core";

const logger = createLogger("MessageRepository");

export class MessageRepository {
  constructor(private db: Database) {}

  /**
   * Add a message to history
   */
  add(message: PersistedMessage): void {
    const query = this.db.prepare(`
      INSERT INTO messages (id, session_id, role, content, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    query.run(
      message.id,
      message.sessionId,
      message.role,
      message.content,
      message.createdAt,
    );

    logger.debug("Added message to history", {
      id: message.id,
      sessionId: message.sessionId,
      role: message.role,
    });
  }

  /**
   * Get recent messages for a session
   */
  getRecent(sessionId: string, limit: number = 50): PersistedMessage[] {
    const query = this.db.prepare(`
      SELECT * FROM messages
      WHERE session_id = ?
      ORDER BY created_at ASC
      LIMIT ?
    `);

    const results = query.all(sessionId, limit) as any[];

    return results.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      role: row.role,
      content: row.content,
      createdAt: row.created_at,
    }));
  }

  /**
   * Clear messages for a session
   */
  clear(sessionId: string): void {
    const query = this.db.prepare("DELETE FROM messages WHERE session_id = ?");
    query.run(sessionId);
    logger.info("Cleared conversation history", { sessionId });
  }

  /**
   * Count messages in a session
   */
  count(sessionId: string): number {
    const query = this.db.prepare(
      "SELECT COUNT(*) as count FROM messages WHERE session_id = ?",
    );
    const result = query.get(sessionId) as { count: number };
    return result ? result.count : 0;
  }
}
