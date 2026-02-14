/**
 * Structured logging utility with severity levels and formatting
 *
 * Design rationale:
 * - Consistent log format across all components
 * - Easy to upgrade to external log aggregation (DataDog, etc.)
 * - Color-coded console output for development
 * - Structured metadata for debugging
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  component?: string;
  metadata?: Record<string, unknown>;
}

const LOG_COLORS = {
  debug: "\x1b[36m", // Cyan
  info: "\x1b[32m", // Green
  warn: "\x1b[33m", // Yellow
  error: "\x1b[31m", // Red
  reset: "\x1b[0m",
} as const;

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class Logger {
  private component: string;
  private minLevel: LogLevel;

  constructor(component: string, minLevel: LogLevel = "info") {
    this.component = component;
    this.minLevel = minLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.minLevel];
  }

  private formatLog(entry: LogEntry): string {
    const color = LOG_COLORS[entry.level];
    const reset = LOG_COLORS.reset;
    const timestamp = entry.timestamp;
    const level = entry.level.toUpperCase().padEnd(5);
    const component = entry.component || "SYSTEM";

    let output = `${color}[${timestamp}] ${level}${reset} [${component}] ${entry.message}`;

    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      output += `\n${color}  └─${reset} ${JSON.stringify(entry.metadata, null, 2)}`;
    }

    return output;
  }

  private log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>,
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      component: this.component,
      metadata,
    };

    const formatted = this.formatLog(entry);

    // Output to appropriate console method
    switch (level) {
      case "error":
        console.error(formatted);
        break;
      case "warn":
        console.warn(formatted);
        break;
      default:
        console.log(formatted);
    }
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log("debug", message, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.log("info", message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log("warn", message, metadata);
  }

  error(message: string, metadata?: Record<string, unknown>): void {
    this.log("error", message, metadata);
  }

  /**
   * Create a child logger with a sub-component name
   */
  child(subComponent: string): Logger {
    return new Logger(`${this.component}:${subComponent}`, this.minLevel);
  }

  /**
   * Set minimum log level dynamically
   */
  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }
}

/**
 * Create a logger instance for a component
 */
export function createLogger(component: string, level?: LogLevel): Logger {
  const logLevel = level || (process.env.LOG_LEVEL as LogLevel) || "info";
  return new Logger(component, logLevel);
}
