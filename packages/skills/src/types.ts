import { Tool } from "@jarvis/tools";

/**
 * A Skill represents a domain-specific capability of the agent.
 * It bundles tools, instructions, and configuration.
 */
export interface Skill {
  /**
   * Unique identifier for the skill (e.g., 'coding', 'research')
   */
  name: string;

  /**
   * Human-readable description
   */
  description: string;

  /**
   * Instructions to append to the system prompt when this skill is active
   */
  instruction?: string;

  /**
   * Tools provided by this skill
   */
  tools?: Tool[];
}

/**
 * Manager for registering and retrieving skills
 */
export interface SkillManager {
  register(skill: Skill): void;
  get(name: string): Skill | undefined;
  getAll(): Skill[];
}
