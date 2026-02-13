import { z } from "zod";

export interface ToolConfig<T extends z.ZodType> {
  name: string;
  description: string;
  schema: T;
  execute: (args: z.infer<T>) => Promise<string>;
}

export class Tool<T extends z.ZodType = any> {
  name: string;
  description: string;
  schema: T;
  execute: (args: z.infer<T>) => Promise<string>;

  constructor(config: ToolConfig<T>) {
    this.name = config.name;
    this.description = config.description;
    this.schema = config.schema;
    this.execute = config.execute;
  }
}
