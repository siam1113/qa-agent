import { DomDiffSummary, FailureClassification, FailureType } from "../types";

export class SelfHealingEngine {
  classifyFailure(message: string): FailureType {
    return this.classifyFailureDetailed(message).type;
  }

  classifyFailureDetailed(message: string): FailureClassification {
    const lower = message.toLowerCase();
    if (lower.includes("timeout") || lower.includes("waiting")) {
      return { type: "timing_issue", category: "timing_timeout", confidence: 0.92, retryable: true, reason: "Detected timeout/waiting symptom" };
    }
    if (lower.includes("strict mode violation") || lower.includes("multiple") || lower.includes("ambiguous")) {
      return { type: "selector_issue", category: "selector_ambiguous", confidence: 0.86, retryable: true, reason: "Selector matches multiple elements" };
    }
    if (lower.includes("selector") || lower.includes("not found")) {
      return { type: "selector_issue", category: "selector_missing", confidence: 0.88, retryable: true, reason: "Target selector cannot be resolved" };
    }
    if (lower.includes("expected") || lower.includes("assert")) {
      return { type: "logic_issue", category: "assertion_mismatch", confidence: 0.9, retryable: false, reason: "Assertion mismatch detected" };
    }
    if (lower.includes("navigation") || lower.includes("net::") || lower.includes("http")) {
      return { type: "unknown", category: "navigation_error", confidence: 0.65, retryable: true, reason: "Likely navigation/network failure" };
    }
    if (lower.includes("unsupported action") || lower.includes("tool")) {
      return { type: "unknown", category: "tooling_error", confidence: 0.7, retryable: false, reason: "Tooling integration failure" };
    }
    return { type: "unknown", category: "unknown", confidence: 0.2, retryable: false, reason: "No known failure signature matched" };
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

  diffDomSnapshots(previous: string | undefined, current: string): DomDiffSummary | undefined {
    if (!previous) return undefined;
    const tokenize = (value: string) => value.replace(/\s+/g, " ").trim().split(/\b/).filter(Boolean);
    const prevTokens = tokenize(previous);
    const currTokens = tokenize(current);
    const prevSet = new Set(prevTokens);
    const currSet = new Set(currTokens);
    const addedNodes = [...currSet].filter((token) => !prevSet.has(token)).length;
    const removedNodes = [...prevSet].filter((token) => !currSet.has(token)).length;
    const max = Math.max(prevSet.size, currSet.size, 1);
    const changedTokens = addedNodes + removedNodes;
    const similarity = Math.max(0, 1 - changedTokens / max);
    return { similarity: Number(similarity.toFixed(4)), addedNodes, removedNodes, changedTokens };
  }
}
