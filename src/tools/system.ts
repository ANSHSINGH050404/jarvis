import { z } from "zod";
import { Tool } from "../core/tools";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const ShellTool = new Tool({
  name: "run_shell_command",
  description:
    "Execute a shell command. Use this to run system utilities, list files, or interact with the OS. Be careful with destructive commands.",
  schema: z.object({
    command: z.string().describe("The command to execute"),
  }),
  execute: async ({ command }) => {
    try {
      // Basic safety check for demo purposes
      if (command.includes("rm -rf /") || command.includes("del C:\\Windows")) {
        throw new Error("Command blocked for safety.");
      }

      const { stdout, stderr } = await execAsync(command);
      return (
        stdout || stderr || "Command executed successfully with no output."
      );
    } catch (error: any) {
      return `Error executing command: ${error.message}`;
    }
  },
});
