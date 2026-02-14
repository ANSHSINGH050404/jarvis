/**
 * Session Repository
 *
 * Manages database operations for user sessions.
 */

import type { Database } from "bun:sqlite";
import type { PersistedSession } from "../types.js";
import { createLogger } from "@jarvis/core";

const logger = createLogger("SessionRepository");

export class SessionRepository {
  constructor(private db: Database) {}

  /**
   * Create or update a session
   */
  upsert(session: PersistedSession): void {
    const updatedAt = Date.now();
    const query = this.db.prepare(`
      INSERT INTO sessions (id, user_id, created_at, updated_at, metadata)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET updated_at = ?, metadata = ?
    `);

    query.run(
      session.id,
      session.userId,
      session.createdAt,
      updatedAt,
      JSON.stringify(session.metadata || {}),
    );
    logger.debug("Upserted session", { sessionId: session.id });
  }

  /**
   * Create a new session if it doesn't exist
   */
  create(session: PersistedSession): void {
    const query = this.db.prepare(`
      INSERT OR IGNORE INTO sessions (id, user_id, created_at, updated_at, metadata)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = query.run(
      session.id,
      session.userId,
      session.createdAt,
      session.updatedAt || session.createdAt,
      JSON.stringify(session.metadata || {}),
    );

    if (result.changes > 0) {
      logger.info("Created new session", { sessionId: session.id });
    } else {
      logger.debug("Session already exists", { sessionId: session.id });
    }
  }

  /**
   * Get a session by ID
   */
  get(id: string): PersistedSession | null {
    const query = this.db.prepare("SELECT * FROM sessions WHERE id = ?");
    const result = query.get(id) as any;

    if (!result) return null;

    return {
      id: result.id,
      userId: result.user_id,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
      metadata: result.metadata ? JSON.parse(result.metadata) : undefined,
    };
  }

  /**
   * Update last activity
   */
  touch(id: string): void {
    const query = this.db.prepare(
      "UPDATE sessions SET updated_at = ? WHERE id = ?",
    );
    query.run(Date.now(), id);
  }

  /**
   * Delete a session (and its messages via CASCADE)
   */
  delete(id: string): void {
    const query = this.db.prepare("DELETE FROM sessions WHERE id = ?");
    query.run(id);
    logger.info("Deleted session", { sessionId: id });
  }
}
