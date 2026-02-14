/**
 * Filesystem Tools
 *
 * Capabilities:
 * - Read file contents
 * - Write file contents
 * - List directory contents
 * - Search for files
 *
 * Security:
 * - Path validation (no directory traversal)
 * - Working directory bounds
 * - Size limits
 */

import { createLogger } from "@jarvis/core";
import type { Tool, ToolContext } from "../types.js";
import { join, resolve, relative } from "path";

const logger = createLogger("FilesystemTools");

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES_LIST = 1000;

/**
 * Validate path is within working directory
 */
function validatePath(filePath: string, context: ToolContext): string {
  const workingDir = context.workingDirectory || process.cwd();
  const absolutePath = resolve(workingDir, filePath);
  const relativePath = relative(workingDir, absolutePath);

  // Check for directory traversal
  if (relativePath.startsWith("..") || absolutePath === workingDir) {
    throw new Error(`Path ${filePath} is outside working directory`);
  }

  return absolutePath;
}

/**
 * Tool: Read file contents
 */
export const readFileTool: Tool = {
  name: "read_file",
  description:
    "Read the contents of a file. Returns the file content as a string.",
  parameters: {
    path: {
      type: "string",
      description: "Path to the file to read (relative to working directory)",
      required: true,
    },
  },
  required: ["path"],
  category: "filesystem",

  async executor(args, context) {
    const path = args.path as string;

    logger.debug("Reading file", { path, sessionId: context.sessionId });

    try {
      const absolutePath = validatePath(path, context);

      // Check file exists
      const file = Bun.file(absolutePath);
      const exists = await file.exists();

      if (!exists) {
        return {
          error: `File not found: ${path}`,
        };
      }

      // Check size
      const size = file.size;
      if (size > MAX_FILE_SIZE) {
        return {
          error: `File too large: ${(size / 1024 / 1024).toFixed(2)}MB (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`,
        };
      }

      // Read content
      const content = await file.text();

      logger.info("File read successfully", {
        path,
        size,
        sessionId: context.sessionId,
      });

      return {
        success: true,
        path,
        content,
        size,
      };
    } catch (error) {
      logger.error("Failed to read file", { path, error });
      return {
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};

/**
 * Tool: Write file contents
 */
export const writeFileTool: Tool = {
  name: "write_file",
  description:
    "Write content to a file. Creates the file if it doesn't exist, overwrites if it does.",
  parameters: {
    path: {
      type: "string",
      description: "Path to the file to write (relative to working directory)",
      required: true,
    },
    content: {
      type: "string",
      description: "Content to write to the file",
      required: true,
    },
  },
  required: ["path", "content"],
  category: "filesystem",

  async executor(args, context) {
    const path = args.path as string;
    const content = args.content as string;

    logger.debug("Writing file", { path, sessionId: context.sessionId });

    try {
      const absolutePath = validatePath(path, context);

      // Write content
      await Bun.write(absolutePath, content);

      logger.info("File written successfully", {
        path,
        size: content.length,
        sessionId: context.sessionId,
      });

      return {
        success: true,
        path,
        size: content.length,
      };
    } catch (error) {
      logger.error("Failed to write file", { path, error });
      return {
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};

/**
 * Tool: List directory contents
 */
export const listDirectoryTool: Tool = {
  name: "list_directory",
  description: "List files and subdirectories in a directory.",
  parameters: {
    path: {
      type: "string",
      description:
        "Path to the directory to list (relative to working directory, defaults to '.')",
      required: false,
      default: ".",
    },
  },
  required: [],
  category: "filesystem",

  async executor(args, context) {
    const path = (args.path as string) || ".";

    logger.debug("Listing directory", { path, sessionId: context.sessionId });

    try {
      const absolutePath = validatePath(path, context);

      // Read directory
      const dir = await Bun.file(absolutePath).exists();
      if (!dir) {
        return {
          error: `Directory not found: ${path}`,
        };
      }

      const items: Array<{
        name: string;
        type: "file" | "directory";
        size?: number;
      }> = [];

      // Use glob to list items
      const glob = new Bun.Glob("*");
      let count = 0;

      for await (const file of glob.scan({ cwd: absolutePath })) {
        if (count++ >= MAX_FILES_LIST) {
          logger.warn("Too many files, truncating", { path });
          break;
        }

        const filePath = join(absolutePath, file);
        const stat = await Bun.file(filePath).exists();

        if (stat) {
          const bunFile = Bun.file(filePath);
          items.push({
            name: file,
            type: "file",
            size: bunFile.size,
          });
        }
      }

      logger.info("Directory listed", {
        path,
        count: items.length,
        sessionId: context.sessionId,
      });

      return {
        success: true,
        path,
        items,
        count: items.length,
      };
    } catch (error) {
      logger.error("Failed to list directory", { path, error });
      return {
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};

/**
 * Tool: Search for files
 */
export const searchFilesTool: Tool = {
  name: "search_files",
  description: "Search for files by pattern (glob) in a directory.",
  parameters: {
    pattern: {
      type: "string",
      description: "Glob pattern to search for (e.g., '*.ts', '**/*.json')",
      required: true,
    },
    path: {
      type: "string",
      description: "Directory to search in (defaults to '.')",
      required: false,
      default: ".",
    },
  },
  required: ["pattern"],
  category: "filesystem",

  async executor(args, context) {
    const pattern = args.pattern as string;
    const path = (args.path as string) || ".";

    logger.debug("Searching files", {
      pattern,
      path,
      sessionId: context.sessionId,
    });

    try {
      const absolutePath = validatePath(path, context);

      const results: string[] = [];
      const glob = new Bun.Glob(pattern);
      let count = 0;

      for await (const file of glob.scan({ cwd: absolutePath })) {
        if (count++ >= MAX_FILES_LIST) {
          logger.warn("Too many matches, truncating", { pattern });
          break;
        }
        results.push(file);
      }

      logger.info("File search complete", {
        pattern,
        count: results.length,
        sessionId: context.sessionId,
      });

      return {
        success: true,
        pattern,
        path,
        results,
        count: results.length,
      };
    } catch (error) {
      logger.error("Failed to search files", { pattern, error });
      return {
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};

// Export all filesystem tools
export const filesystemTools: Tool[] = [
  readFileTool,
  writeFileTool,
  listDirectoryTool,
  searchFilesTool,
];
