import { Agent } from "./src/core/agent";
import { ShellTool } from "./src/tools/system";
import { BrowserTool } from "./src/tools/browser";
import chalk from "chalk";
import dotenv from "dotenv";

dotenv.config();

const tools = [ShellTool, BrowserTool];
const systemPrompt = `You are Motlbot, an autonomous AI agent capable of executing complex workflows on this machine.
You have access to a shell. Use it wisely.
When asked to perform a task, think step-by-step, plan your actions, and execute them using the available tools.
Keep your responses concise and action-oriented.`;

const agent = new Agent(tools, systemPrompt, { verbose: true });

const goal =
  process.argv[2] || "Check the current directory and list all files.";

console.log(chalk.blue(chalk.bold("🚀 Starting Motlbot...")));
console.log(chalk.gray(`Goal: "${goal}"`));

agent.run(goal).catch((err) => {
  console.error(chalk.red("Fatal Error:"), err);
});
