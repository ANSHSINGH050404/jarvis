interface Message {
  role: "user" | "model" | "system";
  content: string;
}

export class Memory {
  messages: Message[] = [];

  constructor(systemPrompt?: string) {
    if (systemPrompt) {
      this.messages.push({ role: "system", content: systemPrompt });
    }
  }

  add(role: "user" | "model", content: string) {
    this.messages.push({ role, content });
  }

  getMessages(): Message[] {
    return this.messages;
  }

  clear() {
    // Keep system message if it exists
    const system = this.messages.find((m) => m.role === "system");
    this.messages = system ? [system] : [];
  }
}
