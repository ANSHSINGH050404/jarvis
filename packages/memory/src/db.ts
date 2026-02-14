/**
 * SQLite Database Manager
 *
 * Uses Bun's native SQLite driver for fast, embedded persistence.
 */

import { Database } from "bun:sqlite";
import { createLogger } from "@jarvis/core";
import { mkdirSync } from "fs";
import { dirname } from "path";

const logger = createLogger("Database");

export class DatabaseManager {
  private static instance: DatabaseManager;
  private db: Database;

  private constructor(dbPath: string) {
    // Ensure directory exists
    mkdirSync(dirname(dbPath), { recursive: true });

    this.db = new Database(dbPath, { create: true });
    logger.info("Connected to SQLite database", { path: dbPath });

    this.initializeSchema();
  }

  static getInstance(dbPath: string = "data/jarvis.db"): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager(dbPath);
    }
    return DatabaseManager.instance;
  }

  private initializeSchema() {
    // Enable WAL mode for better concurrency
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA foreign_keys = ON;");

    // Sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        metadata TEXT -- JSON string for extra data
      );
    `);

    // Messages table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL, -- 'user', 'assistant', 'system'
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );
    `);

    // Create index on session_id for faster lookups
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
    `);

    // Memories table (Vector Store)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        embedding BLOB NOT NULL, -- Float32Array
        created_at INTEGER NOT NULL,
        metadata TEXT
      );
    `);

    logger.debug("Database schema initialized");
  }

  getDb(): Database {
    return this.db;
  }

  close() {
    this.db.close();
    logger.info("Database connection closed");
  }
}
