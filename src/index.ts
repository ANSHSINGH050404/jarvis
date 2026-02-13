import { Agent } from "./core/agent";
import { ShellTool } from "./tools/system";
import { BrowserTool } from "./tools/browser"; // Import BrowserTool
import chalk from "chalk";
import readline from "readline";

// Setup readline for interactive chat
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const tools = [ShellTool, BrowserTool]; // Add BrowserTool here
const systemPrompt =
  "You are Motlbot, a powerful and proactive agent. You can run system commands and handle workflows. Be explicit about your plans.";

const agent = new Agent(tools, systemPrompt, { verbose: true });

console.log(chalk.bold.blue("🚀 Motlbot v1.0 Initialized"));
console.log(chalk.gray("Type 'exit' to quit."));

const ask = () => {
  rl.question(chalk.bold.yellow("Task: "), async (input) => {
    if (input.toLowerCase() === "exit") {
      rl.close();
      process.exit(0);
    }

    try {
      await agent.run(input);
    } catch (error: any) {
      console.error(chalk.red("Execution failed:"), error.message);
    }

    ask();
  });
};

ask();
