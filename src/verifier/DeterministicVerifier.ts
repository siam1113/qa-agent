import { BrowserTools } from "../tools/BrowserTools";
import { StepExecutionResult, TestStep } from "../types";

export class DeterministicVerifier {
  constructor(private readonly tools: BrowserTools) {}

  async verify(step: TestStep, result: StepExecutionResult): Promise<{ ok: boolean; reason: string }> {
    if (!result.success) {
      return { ok: false, reason: result.message };
    }

    if (step.selector && ["click", "type", "extract_text"].includes(step.action)) {
      const exists = await this.tools.elementExists(step.selector);
      if (!exists) return { ok: false, reason: `Element missing after action: ${step.selector}` };
    }

    if (step.action === "extract_text" && step.expected) {
      const actual = result.extractedText ?? "";
      if (!actual.includes(step.expected)) {
        return { ok: false, reason: `Expected text '${step.expected}' not found. Actual: '${actual}'` };
      }
    }

    return { ok: true, reason: "Deterministic checks passed" };
  }
}
