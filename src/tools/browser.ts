import { z } from "zod";
import { Tool } from "../core/tools";
import { chromium } from "playwright";
import type { Browser, Page } from "playwright";

let browser: Browser | null = null;
let page: Page | null = null;

export const BrowserTool = new Tool({
  name: "browser_action",
  description: "Control a web browser to navigate and extract content.",
  schema: z.object({
    action: z
      .enum(["navigate", "click", "type", "extract", "screenshot"])
      .describe("The action to perform"),
    url: z
      .string()
      .optional()
      .describe("URL to navigate to (required for 'navigate')"),
    selector: z
      .string()
      .optional()
      .describe("CSS selector for element interaction"),
    text: z.string().optional().describe("Text to type (required for 'type')"),
  }),
  execute: async ({ action, url, selector, text }) => {
    if (!browser) {
      browser = await chromium.launch({ headless: false }); // Headful for demo
      page = await browser.newPage();
    }

    if (!page) throw new Error("Browser page not initialized");

    try {
      switch (action) {
        case "navigate":
          if (!url) throw new Error("URL is required for navigation");
          await page.goto(url);
          return `Navigated to ${url}`;

        case "click":
          if (!selector) throw new Error("Selector is required for click");
          await page.click(selector);
          return `Clicked on ${selector}`;

        case "type":
          if (!selector || !text)
            throw new Error("Selector and text required for type");
          await page.fill(selector, text);
          return `Typed "${text}" into ${selector}`;

        case "extract":
          const content = await page.content();
          return content.slice(0, 5000); // Truncate for token limits

        case "screenshot":
          const path = `screenshot_${Date.now()}.png`;
          await page.screenshot({ path });
          return `Screenshot saved to ${path}`;

        default:
          return "Unknown action";
      }
    } catch (error: any) {
      return `Browser error: ${error.message}`;
    }
  },
});
