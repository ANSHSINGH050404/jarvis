import { Skill, SkillManager } from "./types.js";
import { createLogger, type Tool } from "@jarvis/core";

// Note: Tool interface might need to be imported from @jarvis/tools if core doesn't export fully typed Tool with executor.
// Actually, Skill interface uses Tool from @jarvis/tools.
// Let's import Tool from @jarvis/tools in types.ts.
// But registry needs type.
import { Tool as ToolType } from "@jarvis/tools";

const logger = createLogger("SkillRegistry");

export class SkillRegistry implements SkillManager {
  private skills: Map<string, Skill> = new Map();

  register(skill: Skill): void {
    if (this.skills.has(skill.name)) {
      logger.warn(`Skill '${skill.name}' already registered. Overwriting.`);
    } else {
      logger.info(`Registering skill '${skill.name}'`);
    }
    this.skills.set(skill.name, skill);
  }

  get(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  getAll(): Skill[] {
    return Array.from(this.skills.values());
  }

  /**
   * Builds combined instructions from all registered skills
   */
  getSystemInstructions(): string {
    const instructions = this.getAll()
      .filter((skill) => !!skill.instruction) // Only skills with instructions
      .map((skill) => {
        let text = `## Skill: ${skill.name}\n${skill.description}`;
        if (skill.instruction) {
          text += `\nInstructions:\n${skill.instruction}`;
        }
        return text;
      });

    return instructions.length > 0
      ? `\n\n# Active Skills\nThe following specialized skills are enabled:\n\n${instructions.join("\n\n")}`
      : "";
  }

  /**
   * Retrieves all tools from all skills
   */
  getAllTools(): ToolType[] {
    // Collect tools from all skills
    return this.getAll().flatMap((skill) => skill.tools || []);
  }
}
