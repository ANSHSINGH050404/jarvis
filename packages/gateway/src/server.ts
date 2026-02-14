/**
 * Gateway Server
 *
 * Bun-native WebSocket + HTTP server
 *
 * Architecture:
 * - WebSocket for real-time bidirectional communication
 * - HTTP for health checks and webhooks
 * - Session-based connection tracking
 * - Event-driven message routing
 *
 * Message Flow:
 * 1. Client connects via WebSocket
 * 2. Client sends message with sessionId
 * 3. Gateway validates and publishes to event bus
 * 4. Agent processes and sends response back
 * 5. Gateway routes response to correct WebSocket client
 */

import type { ServerWebSocket } from "bun";
import {
  type IncomingMessage,
  type StreamChunk,
  type Message,
  createLogger,
  generateId,
  eventBus,
} from "@jarvis/core";
import { SessionManager } from "./session-manager.js";

const logger = createLogger("Gateway");

interface WebSocketData {
  sessionId: string;
  userId: string;
  connectedAt: number;
}

interface GatewayConfig {
  host: string;
  port: number;
  apiKey?: string;
}

export class Gateway {
  private sessionManager: SessionManager;
  private connections: Map<string, ServerWebSocket<WebSocketData>> = new Map();
  private config: GatewayConfig;
  private server?: ReturnType<typeof Bun.serve>;

  constructor(config: GatewayConfig) {
    this.config = config;
    this.sessionManager = new SessionManager();

    // Subscribe to outgoing messages
    eventBus.subscribe("message.sent", async (event) => {
      const message = event.payload as Message;
      await this.sendMessage(message.sessionId, message.content);
    });

    // Subscribe to streaming responses from agent
    eventBus.subscribe("agent.response", async (event: any) => {
      const { data } = event.payload;
      await this.sendStreamChunk(data);
    });

    logger.info("Gateway initialized", { config });
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    this.server = Bun.serve<WebSocketData>({
      hostname: this.config.host,
      port: this.config.port,

      /**
       * WebSocket handlers
       */
      websocket: {
        open: (ws) => this.handleOpen(ws),
        message: (ws, message) => this.handleMessage(ws, message),
        close: (ws) => this.handleClose(ws),
        drain: (ws) => {
          logger.debug("WebSocket drain", { sessionId: ws.data.sessionId });
        },
      },

      /**
       * HTTP handler for upgrades and endpoints
       */
      fetch: async (req, server) => {
        const url = new URL(req.url);

        // WebSocket upgrade
        if (url.pathname === "/ws") {
          const userId = url.searchParams.get("userId") || generateId("user");
          const sessionId =
            url.searchParams.get("sessionId") || generateId("ws");

          const upgraded = server.upgrade(req, {
            data: {
              sessionId,
              userId,
              connectedAt: Date.now(),
            },
          });

          if (upgraded) {
            logger.info("WebSocket upgrade successful", { sessionId, userId });
            return undefined; // Bun handles the upgrade
          }

          return new Response("WebSocket upgrade failed", { status: 400 });
        }

        // Health check
        if (url.pathname === "/health") {
          return Response.json({
            status: "healthy",
            uptime: process.uptime(),
            sessions: {
              total: this.sessionManager.getCount(),
              active: this.sessionManager.getActiveCount(),
            },
            connections: this.connections.size,
          });
        }

        // HTTP POST endpoint for testing
        if (url.pathname === "/message" && req.method === "POST") {
          try {
            const body = (await req.json()) as {
              sessionId?: string;
              userId?: string;
              content: string;
            };

            const userId = body.userId || generateId("user");
            const sessionId = body.sessionId || generateId("http");

            await this.handleIncomingMessage({
              sessionId,
              userId,
              channel: "http",
              contentType: "text",
              content: body.content,
              timestamp: Date.now(),
            });

            return Response.json({
              success: true,
              sessionId,
            });
          } catch (error) {
            logger.error("HTTP message handler error", { error });
            return Response.json({ error: "Invalid request" }, { status: 400 });
          }
        }

        return new Response("Not Found", { status: 404 });
      },
    });

    logger.info("Gateway server started", {
      host: this.config.host,
      port: this.config.port,
      url: `http://${this.config.host}:${this.config.port}`,
      wsUrl: `ws://${this.config.host}:${this.config.port}/ws`,
    });
  }

  /**
   * Handle WebSocket connection opened
   */
  private async handleOpen(ws: ServerWebSocket<WebSocketData>): Promise<void> {
    const { sessionId, userId } = ws.data;

    // Create or retrieve session
    await this.sessionManager.getOrCreate(sessionId, userId, "websocket");

    // Store connection
    this.connections.set(sessionId, ws);

    logger.info("WebSocket connection opened", {
      sessionId,
      userId,
      totalConnections: this.connections.size,
    });

    // Send welcome message
    ws.send(
      JSON.stringify({
        type: "connected",
        sessionId,
        timestamp: Date.now(),
      }),
    );
  }

  /**
   * Handle incoming WebSocket message
   */
  private async handleMessage(
    ws: ServerWebSocket<WebSocketData>,
    rawMessage: string | Buffer,
  ): Promise<void> {
    try {
      const { sessionId, userId } = ws.data;

      const messageStr =
        typeof rawMessage === "string" ? rawMessage : rawMessage.toString();

      const data = JSON.parse(messageStr) as {
        type: string;
        content: string;
      };

      logger.debug("WebSocket message received", {
        sessionId,
        type: data.type,
      });

      // Handle different message types
      if (data.type === "ping") {
        ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
        return;
      }

      if (data.type === "message") {
        await this.handleIncomingMessage({
          sessionId,
          userId,
          channel: "websocket",
          contentType: "text",
          content: data.content,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      logger.error("Error handling WebSocket message", { error });
      ws.send(
        JSON.stringify({
          type: "error",
          error: "Invalid message format",
        }),
      );
    }
  }

  /**
   * Handle WebSocket connection closed
   */
  private async handleClose(ws: ServerWebSocket<WebSocketData>): Promise<void> {
    const { sessionId } = ws.data;

    this.connections.delete(sessionId);

    logger.info("WebSocket connection closed", {
      sessionId,
      totalConnections: this.connections.size,
    });

    // Update session state (but don't end it - allow reconnection)
    try {
      await this.sessionManager.updateState(sessionId, "paused");
    } catch (error) {
      logger.warn("Failed to update session state on close", { error });
    }
  }

  /**
   * Handle incoming message from any channel
   */
  private async handleIncomingMessage(
    incoming: IncomingMessage,
  ): Promise<void> {
    const messageId = generateId("msg");

    logger.info("Incoming message", {
      sessionId: incoming.sessionId,
      channel: incoming.channel,
      contentLength: incoming.content.length,
    });

    // Create full message object
    const message = {
      id: messageId,
      ...incoming,
      direction: "incoming" as const,
    };

    // Publish to event bus for agent processing
    await eventBus.publish({
      type: "message.received",
      payload: message,
      timestamp: Date.now(),
      correlationId: messageId,
    });
  }

  /**
   * Send message to a specific session
   */
  async sendMessage(sessionId: string, content: string): Promise<void> {
    const ws = this.connections.get(sessionId);

    if (!ws) {
      logger.warn("No active connection for session", { sessionId });
      return;
    }

    ws.send(
      JSON.stringify({
        type: "message",
        content,
        timestamp: Date.now(),
      }),
    );

    logger.debug("Message sent", { sessionId });
  }

  /**
   * Send stream chunk to a session
   */
  async sendStreamChunk(chunk: StreamChunk): Promise<void> {
    const ws = this.connections.get(chunk.sessionId);

    if (!ws) {
      logger.warn("No active connection for stream", {
        sessionId: chunk.sessionId,
      });
      return;
    }

    ws.send(JSON.stringify(chunk));
  }

  /**
   * Broadcast message to all connections
   */
  broadcast(message: unknown): void {
    const data = JSON.stringify(message);

    for (const ws of this.connections.values()) {
      ws.send(data);
    }

    logger.debug("Broadcast sent", { connectionCount: this.connections.size });
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    if (this.server) {
      this.server.stop();
      this.server = undefined;
    }

    // Close all connections
    for (const ws of this.connections.values()) {
      ws.close();
    }

    this.connections.clear();
    this.sessionManager.destroy();

    logger.info("Gateway server stopped");
  }

  /**
   * Get server stats
   */
  getStats() {
    return {
      connections: this.connections.size,
      sessions: {
        total: this.sessionManager.getCount(),
        active: this.sessionManager.getActiveCount(),
      },
    };
  }
}
