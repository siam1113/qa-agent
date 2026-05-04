import { FailureType } from "../types";

export class SelfHealingEngine {
  classifyFailure(message: string): FailureType {
    const lower = message.toLowerCase();
    if (lower.includes("timeout") || lower.includes("waiting")) return "timing_issue";
    if (lower.includes("selector") || lower.includes("not found")) return "selector_issue";
    if (lower.includes("expected") || lower.includes("assert")) return "logic_issue";
    return "unknown";
  }

  buildAlternativeSelectors(primary: string | undefined, agentAlternatives: string[] = []): string[] {
    const all = new Set<string>(agentAlternatives);
    if (primary) {
      all.add(primary);
      if (primary.startsWith("#")) {
        const id = primary.slice(1);
        all.add(`[data-testid='${id}']`);
        all.add(`[aria-label='${id}']`);
      }
    }
    return [...all];
  }
}
