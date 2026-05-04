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
    const bodies = tests
      .map((t) => `test('${t.name}', async ({ page }) => {\n${this.renderStepsPlaywright(t.steps)}\n});`)
      .join("\n\n");
    return `import { test, expect } from '@playwright/test';\n\n${bodies}\n`;
  }

  private cypress(tests: TestCase[]): string {
    const bodies = tests
      .map((t) => `it('${t.name}', () => {\n${this.renderStepsCypress(t.steps)}\n});`)
      .join("\n\n");
    return `describe('Generated AI Harness Suite', () => {\n${bodies}\n});\n`;
  }

  private renderStepsPlaywright(steps: TestStep[]): string {
    return steps
      .map((s) => {
        switch (s.action) {
          case "open_page": return `  await page.goto('${s.url ?? "/"}');`;
          case "click": return `  await page.click('${s.selector}');`;
          case "type": return `  await page.fill('${s.selector}', '${s.value ?? ""}');`;
          case "extract_text": return `  await expect(page.locator('${s.selector}')).toContainText('${s.expected ?? ""}');`;
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
          case "click": return `  cy.get('${s.selector}').click();`;
          case "type": return `  cy.get('${s.selector}').clear().type('${s.value ?? ""}');`;
          case "extract_text": return `  cy.get('${s.selector}').should('contain', '${s.expected ?? ""}');`;
          default: return "";
        }
      })
      .join("\n");
  }
}
