import { TestCase, TestStep } from "../types";
import { LlmClient } from "../llm/LlmClient";

export class TestCodeGenerator {
  constructor(private readonly llm: LlmClient = new LlmClient()) {}

  async generate(framework: "playwright" | "cypress", tests: TestCase[]): Promise<string> {
    const llmCode = await this.llm.generateCode(framework, tests);
    if (llmCode) return llmCode;
    return framework === "playwright" ? this.playwright(tests) : this.cypress(tests);
  }

  private playwright(tests: TestCase[]): string {
    const selectorBlock = this.selectorRegistry(tests, "playwright");
    const bodies = tests
      .map((t) => `test('${t.name}', async ({ page }) => {\n${this.renderStepsPlaywright(t.steps)}\n});`)
      .join("\n\n");
    return `import { test, expect } from '@playwright/test';\n\n${selectorBlock}\n${bodies}\n`;
  }

  private cypress(tests: TestCase[]): string {
    const selectorBlock = this.selectorRegistry(tests, "cypress");
    const bodies = tests
      .map((t) => `it('${t.name}', () => {\n${this.renderStepsCypress(t.steps)}\n});`)
      .join("\n\n");
    return `const selectors = ${selectorBlock};\n\ndescribe('Generated AI Harness Suite', () => {\n${bodies}\n});\n`;
  }

  private selectorRegistry(tests: TestCase[], framework: "playwright" | "cypress"): string {
    const selectors = new Map<string, string>();
    for (const test of tests) {
      for (const step of test.steps) {
        if (!step.selector) continue;
        if (!selectors.has(step.selector)) {
          selectors.set(step.selector, this.selectorKey(step.selector));
        }
      }
    }
    const entries = [...selectors.entries()].map(([raw, key]) => `  ${key}: '${raw.replace(/'/g, "\\'")}'`);
    if (framework === "playwright") {
      return `const selectors = {\n${entries.join(",\n")}\n};\n`;
    }
    return `{\n${entries.join(",\n")}\n}`;
  }

  private renderStepsPlaywright(steps: TestStep[]): string {
    return steps
      .map((s) => {
        switch (s.action) {
          case "open_page": return `  await page.goto('${s.url ?? "/"}');`;
          case "click": return `  await page.click(${this.selectorRef(s.selector)});`;
          case "type": return `  await page.fill(${this.selectorRef(s.selector)}, '${s.value ?? ""}');`;
          case "extract_text": return `  await expect(page.locator(${this.selectorRef(s.selector)})).toContainText('${s.expected ?? ""}');`;
          default: return "";
        }
      })
      .join("\n");
  }

  private renderStepsCypress(steps: TestStep[]): string {
    return steps
      .map((s) => {
        switch (s.action) {
          case "open_page": return `  cy.visit('${s.url ?? "/"}');`;
          case "click": return `  cy.get(${this.selectorRef(s.selector)}).click();`;
          case "type": return `  cy.get(${this.selectorRef(s.selector)}).clear().type('${s.value ?? ""}');`;
          case "extract_text": return `  cy.get(${this.selectorRef(s.selector)}).should('contain', '${s.expected ?? ""}');`;
          default: return "";
        }
      })
      .join("\n");
  }

  private selectorRef(selector: string | undefined): string {
    return selector ? `selectors.${this.selectorKey(selector)}` : "''";
  }

  private selectorKey(selector: string): string {
    const compact = selector.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    return compact ? `sel_${compact}` : "sel_unknown";
  }
}
