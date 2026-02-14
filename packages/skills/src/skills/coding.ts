import { Skill } from "../types.js";
import { filesystemTools } from "@jarvis/tools";

export const CodingSkill: Skill = {
  name: "coding",
  description:
    "Advanced capabilities for reading, writing, and managing codebase files.",
  instruction: `As an expert developer, use these tools to interact with the project:
  1. Always read a file before modifying it to ensure context.
  2. Use 'list_directory' to explore the project structure first.
  3. When creating files, ensure parent directories exist or use tools that handle it.
  4. Write clean, documented code.`,
  tools: filesystemTools,
};
