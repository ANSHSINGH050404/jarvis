/**
 * Session Manager
 *
 * Responsibilities:
 * - Create and manage user sessions
 * - Track session lifecycle
 * - Handle session expiry
 * - Provide session lookup
 *
 * Design decisions:
 * - In-memory storage for Week 1 (can move to Redis later)
 * - Automatic session cleanup
 * - Thread-safe operations
 */

import {
  type Session,
  type SessionState,
  type ChannelType,
  SessionError,
  createLogger,
  generateId,
  eventBus,
} from "@jarvis/core";

const logger = createLogger("SessionManager");

// Default session expiry: 24 hours
const DEFAULT_SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;

export interface SessionManagerConfig {
  defaultExpiryMs?: number;
  cleanupIntervalMs?: number;
}

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private config: Required<SessionManagerConfig>;
  private cleanupInterval?: Timer;

  constructor(config: SessionManagerConfig = {}) {
    this.config = {
      defaultExpiryMs: config.defaultExpiryMs || DEFAULT_SESSION_EXPIRY_MS,
      cleanupIntervalMs: config.cleanupIntervalMs || 60 * 1000, // 1 minute
    };

    this.startCleanup();
    logger.info("SessionManager initialized", {
      defaultExpiryMs: this.config.defaultExpiryMs,
      cleanupIntervalMs: this.config.cleanupIntervalMs,
    });
  }

  /**
   * Create a new session
   */
  async create(
    userId: string,
    channel: ChannelType,
    sessionId?: string,
  ): Promise<Session> {
    const id = sessionId || generateId(channel);
    const now = Date.now();

    const session: Session = {
      id,
      userId,
      channel,
      state: "active",
      context: {},
      createdAt: now,
      lastActivity: now,
      expiresAt: now + this.config.defaultExpiryMs,
    };

    this.sessions.set(id, session);

    logger.debug("Session created", { sessionId: id, userId, channel });

    // Publish session created event
    await eventBus.publish({
      type: "session.created",
      payload: session,
      timestamp: now,
    });

    return session;
  }

  /**
   * Get existing session or create new one
   */
  async getOrCreate(
    sessionId: string,
    userId: string,
    channel: ChannelType,
  ): Promise<Session> {
    const existing = this.sessions.get(sessionId);

    if (existing) {
      // Update last activity
      existing.lastActivity = Date.now();
      return existing;
    }

    return this.create(userId, channel, sessionId);
  }

  /**
   * Get session by ID
   */
  get(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Update session state
   */
  async updateState(sessionId: string, state: SessionState): Promise<void> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new SessionError(`Session not found: ${sessionId}`);
    }

    session.state = state;
    session.lastActivity = Date.now();

    logger.debug("Session state updated", { sessionId, state });

    await eventBus.publish({
      type: "session.updated",
      payload: session,
      timestamp: Date.now(),
    });
  }

  /**
   * Update session context
   */
  updateContext(sessionId: string, context: Record<string, unknown>): void {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new SessionError(`Session not found: ${sessionId}`);
    }

    session.context = { ...session.context, ...context };
    session.lastActivity = Date.now();

    logger.debug("Session context updated", { sessionId });
  }

  /**
   * End a session
   */
  async end(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new SessionError(`Session not found: ${sessionId}`);
    }

    session.state = "ended";
    session.lastActivity = Date.now();

    logger.info("Session ended", { sessionId });

    await eventBus.publish({
      type: "session.ended",
      payload: session,
      timestamp: Date.now(),
    });

    // Remove from memory after a delay
    setTimeout(() => {
      this.sessions.delete(sessionId);
    }, 5000);
  }

  /**
   * Get all active sessions for a user
   */
  getUserSessions(userId: string): Session[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.userId === userId && s.state === "active",
    );
  }

  /**
   * Get session count
   */
  getCount(): number {
    return this.sessions.size;
  }

  /**
   * Get active session count
   */
  getActiveCount(): number {
    return Array.from(this.sessions.values()).filter(
      (s) => s.state === "active",
    ).length;
  }

  /**
   * Start automatic cleanup of expired sessions
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupIntervalMs);

    logger.debug("Session cleanup started");
  }

  /**
   * Clean up expired sessions
   */
  private async cleanup(): Promise<void> {
    const now = Date.now();
    const expiredSessions: string[] = [];

    for (const [id, session] of this.sessions.entries()) {
      if (session.expiresAt && session.expiresAt < now) {
        expiredSessions.push(id);
      }
    }

    if (expiredSessions.length > 0) {
      logger.info("Cleaning up expired sessions", {
        count: expiredSessions.length,
      });

      for (const id of expiredSessions) {
        await this.end(id);
      }
    }
  }

  /**
   * Stop cleanup and clear all sessions
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.sessions.clear();
    logger.info("SessionManager destroyed");
  }
}
