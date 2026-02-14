import { Skill } from "../types.js";
import { httpTools } from "@jarvis/tools";

export const ResearchSkill: Skill = {
  name: "research",
  description: "Ability to fetch information from the web.",
  instruction: `Use the 'research' capabilities to access external information:
  - Use 'http_request' to perform GET requests.
  - Summarize fetched content appropriately.
  - If a request fails, report the error concisely.`,
  tools: httpTools,
};
