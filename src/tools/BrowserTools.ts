import { chromium, Browser, Page } from "playwright";
import { StepExecutionResult } from "../types";

export class BrowserTools {
  private browser?: Browser;
  private page?: Page;

  constructor(private readonly log?: (message: string) => void) {}

  async init(): Promise<void> {
    this.log?.("[BrowserTools] Initializing browser session");
    this.browser = await chromium.launch({ headless: true });
    const context = await this.browser.newContext();
    this.page = await context.newPage();
    this.log?.("[BrowserTools] Browser session initialized");
  }

  async close(): Promise<void> {
    this.log?.("[BrowserTools] Closing browser session");
    await this.browser?.close();
    this.log?.("[BrowserTools] Browser session closed");
  }

  async open_page(url: string): Promise<StepExecutionResult> {
    const page = this.ensurePage();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    return { success: true, message: `Opened ${url}` };
  }

  async click(selector: string): Promise<StepExecutionResult> {
    const page = this.ensurePage();
    await page.click(selector, { timeout: 5_000 });
    return { success: true, message: `Clicked ${selector}` };
  }

  async type(selector: string, text: string): Promise<StepExecutionResult> {
    const page = this.ensurePage();
    await page.fill(selector, text, { timeout: 5_000 });
    return { success: true, message: `Typed into ${selector}` };
  }

  async extract_text(selector: string): Promise<StepExecutionResult> {
    const page = this.ensurePage();
    const value = (await page.textContent(selector, { timeout: 5_000 })) ?? "";
    return { success: true, message: `Extracted text from ${selector}`, extractedText: value.trim() };
  }

  async get_dom(): Promise<StepExecutionResult> {
    const page = this.ensurePage();
    await page.waitForLoadState("domcontentloaded");
    const [dom, pageUrl, pageTitle] = await Promise.all([
      page.content(),
      page.url(),
      page.title().catch(() => "")
    ]);
    return { success: true, message: "DOM captured", dom, pageUrl, pageTitle };
  }

  async take_screenshot(path: string): Promise<StepExecutionResult> {
    const page = this.ensurePage();
    await page.screenshot({ path, fullPage: true });
    return { success: true, message: `Screenshot saved: ${path}`, screenshotPath: path };
  }

  async elementExists(selector: string): Promise<boolean> {
    const page = this.ensurePage();
    return (await page.locator(selector).count()) > 0;
  }

  private ensurePage(): Page {
    if (!this.page) throw new Error("BrowserTools not initialized");
    return this.page;
  }
}
