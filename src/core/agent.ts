import { GoogleGenAI } from "@google/genai";
import "dotenv/config";
import { Tool } from "./tools";
import { Memory } from "./memory";
import chalk from "chalk";
import { z } from "zod";

interface AgentConfig {
  maxSteps?: number;
  verbose?: boolean;
}

export class Agent {
  private client: GoogleGenAI;
  private tools: Map<string, Tool<any>>;
  private memory: Memory;
  private maxSteps: number;
  private verbose: boolean;
  private modelName: string = "gemini-2.0-flash";

  constructor(
    tools: Tool<any>[],
    systemPrompt: string,
    config: AgentConfig = {},
  ) {
    this.client = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
    this.tools = new Map(tools.map((t) => [t.name, t]));
    this.memory = new Memory(systemPrompt);
    this.maxSteps = config.maxSteps || 20;
    this.verbose = config.verbose !== false;
  }

  private log(message: string, color: (s: string) => string = chalk.white) {
    if (this.verbose) console.log(color(message));
  }

  // Updated to return raw JSON schema objects preferred by the new SDK
  private getToolsConfig() {
    return {
      functionDeclarations: Array.from(this.tools.values()).map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: this.zodToJSONSchema(tool.schema),
      })),
    };
  }

  private zodToJSONSchema(schema: z.ZodType<any>): any {
    if (schema instanceof z.ZodObject) {
      const properties: Record<string, any> = {};
      const required: string[] = [];

      for (const key in schema.shape) {
        const field = schema.shape[key];
        properties[key] = this.getGeminiType(field);
        if (!field.isOptional()) required.push(key);
      }
      return { type: "object", properties, required };
    }
    return { type: "string" };
  }

  private getGeminiType(schema: z.ZodType): any {
    if (schema instanceof z.ZodString) return { type: "string" };
    if (schema instanceof z.ZodNumber) return { type: "number" };
    if (schema instanceof z.ZodBoolean) return { type: "boolean" };
    if (schema instanceof z.ZodOptional)
      return this.getGeminiType(schema.unwrap());
    return { type: "string" };
  }

  async run(goal: string) {
    this.log(`🎯 Goal: ${goal}`, chalk.green.bold);

    // In the new API, we manage history manually or use the chat helper
    let history = [{ role: "user", parts: [{ text: goal }] }];
    let currentStep = 0;

    while (currentStep < this.maxSteps) {
      currentStep++;

      const result = await this.client.models.generateContent({
        model: this.modelName,
        contents: history,
        config: {
          tools: [this.getToolsConfig()],
        },
      });

      const candidate = result.candidates?.[0];
      if (!candidate) break;

      // Add model's response to history
      history.push(candidate.content);

      const text = result.text;
      if (text) this.log(`🤖 Thought: ${text}`, chalk.cyan);

      // Check for function calls in the new format
      const calls = candidate.content.parts?.filter((p) => p.functionCall);

      if (!calls || calls.length === 0) {
        this.log(`🏁 Finished.`, chalk.green);
        return text;
      }

      const toolResults: any[] = [];

      for (const part of calls) {
        const call = part.functionCall!;
        this.log(`🛠️ Executing: ${call.name}`, chalk.magenta);

        const tool = this.tools.get(call.name);
        try {
          const output = tool
            ? await tool.execute(call.args)
            : `Error: Tool ${call.name} not found`;

          this.log(`✅ Result: ${String(output).slice(0, 100)}...`, chalk.gray);

          toolResults.push({
            functionResponse: {
              name: call.name,
              response: { output },
            },
          });
        } catch (error: any) {
          toolResults.push({
            functionResponse: {
              name: call.name,
              response: { error: error.message },
            },
          });
        }
      }

      // Add tool responses back to history for the next loop
      history.push({ role: "user", parts: toolResults });
    }
  }
}
