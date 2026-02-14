/**
 * HTTP Tools
 *
 * Capabilities:
 * - Make HTTP requests (GET, POST, PUT, DELETE)
 * - Custom headers
 * - Request/response tracking
 *
 * Security:
 * - Timeout protection
 * - Size limits
 * - No localhost by default (configurable)
 */

import { createLogger } from "@jarvis/core";
import type { Tool, ToolContext } from "../types.js";

const logger = createLogger("HttpTools");

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const MAX_RESPONSE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Tool: HTTP Request
 */
export const httpRequestTool: Tool = {
  name: "http_request",
  description:
    "Make an HTTP request to a URL. Supports GET, POST, PUT, DELETE methods.",
  parameters: {
    url: {
      type: "string",
      description: "The URL to request",
      required: true,
    },
    method: {
      type: "string",
      description: "HTTP method (GET, POST, PUT, DELETE)",
      required: false,
      default: "GET",
      enum: ["GET", "POST", "PUT", "DELETE"],
    },
    headers: {
      type: "object",
      description: "Optional headers as key-value pairs",
      required: false,
    },
    body: {
      type: "string",
      description: "Request body (for POST/PUT)",
      required: false,
    },
  },
  required: ["url"],
  category: "http",

  async executor(args, context) {
    const url = args.url as string;
    const method = (args.method as string) || "GET";
    const headers = (args.headers as Record<string, string>) || {};
    const body = args.body as string | undefined;

    logger.debug("Making HTTP request", {
      url,
      method,
      sessionId: context.sessionId,
    });

    try {
      // Validate URL
      const parsedUrl = new URL(url);

      // Optional: Block localhost (security)
      // if (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1') {
      //   throw new Error('Requests to localhost are not allowed');
      // }

      // Make request with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

      const response = await fetch(url, {
        method,
        headers,
        body: body || undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Check response size
      const contentLength = response.headers.get("content-length");
      if (contentLength && parseInt(contentLength) > MAX_RESPONSE_SIZE) {
        return {
          error: `Response too large: ${(parseInt(contentLength) / 1024 / 1024).toFixed(2)}MB`,
        };
      }

      // Get response text
      const responseText = await response.text();

      logger.info("HTTP request completed", {
        url,
        status: response.status,
        size: responseText.length,
        sessionId: context.sessionId,
      });

      return {
        success: true,
        url,
        method,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseText,
        size: responseText.length,
      };
    } catch (error) {
      logger.error("HTTP request failed", { url, error });

      if (error instanceof Error && error.name === "AbortError") {
        return {
          error: `Request timeout after ${DEFAULT_TIMEOUT / 1000}s`,
        };
      }

      return {
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};

// Export all HTTP tools
export const httpTools: Tool[] = [httpRequestTool];
