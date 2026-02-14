/**
 * JARVIS Memory Package
 *
 * Provides persistence for sessions and messages using SQLite.
 */

import { DatabaseManager } from "./db.js";
import {
  SessionRepository,
  MessageRepository,
  MemoryRepository,
} from "./repositories/index.js";
import type { PersistedSession, PersistedMessage } from "./types.js";
import type { Memory } from "./repositories/memory-repository.js";

// Export types
export * from "./types.js";
export * from "./repositories/index.js";
export { DatabaseManager } from "./db.js";

/**
 * Main Memory Store
 */
export class MemoryStore {
  private dbManager: DatabaseManager;
  public sessions: SessionRepository;
  public messages: MessageRepository;
  public memories: MemoryRepository;

  constructor(dbPath?: string) {
    this.dbManager = DatabaseManager.getInstance(dbPath);
    const db = this.dbManager.getDb();

    this.sessions = new SessionRepository(db);
    this.messages = new MessageRepository(db);
    this.memories = new MemoryRepository(db);
  }

  /**
   * Close the database connection
   */
  close() {
    this.dbManager.close();
  }
}
