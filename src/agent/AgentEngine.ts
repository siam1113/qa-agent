import { AgentActionSuggestion, TestCase, TestStep } from "../types";
import { LlmClient } from "../llm/LlmClient";

export class AgentEngine {
  constructor(private readonly llm: LlmClient = new LlmClient()) {}

  async generateTestCases(userStory: string): Promise<TestCase[]> {
    const llmCases = await this.llm.generateTestCases(userStory);
    if (llmCases?.length) return llmCases;

    if (/login/i.test(userStory)) {
      return [
        {
          id: "tc-login-happy-path",
          name: "Login with valid email and password",
          expectedOutcome: "User is navigated to dashboard and sees welcome message",
          steps: [
            this.step("s1", "Open login page", "open_page", undefined, undefined, undefined, "/login"),
            this.step("s2", "Type email", "type", "input[name='email']", "user@example.com"),
            this.step("s3", "Type password", "type", "input[name='password']", "P@ssword123"),
            this.step("s4", "Click sign in button", "click", "button[type='submit']"),
            this.step("s5", "Verify welcome header", "extract_text", "h1", undefined, "Welcome")
          ]
        }
      ];
    }

    return [
      {
        id: "tc-generic-flow",
        name: "Generic story flow",
        expectedOutcome: "Expected outcome reached",
        steps: [this.step("s1", "Open base page", "open_page", undefined, undefined, undefined, "/")]
      }
    ];
  }

  suggestAction(step: TestStep): AgentActionSuggestion {
    const alternatives = step.selector ? this.generateSelectorAlternatives(step.selector) : [];
    return {
      action: step.action,
      selector: step.selector,
      value: step.value,
      url: step.url,
      alternatives,
      reason: `Action derived from step ${step.id}: ${step.description}`
    };
  }

  async chooseBestLocator(
    step: TestStep,
    selectors: string[],
    dom?: string,
    attempt?: number,
    lastFailureReason?: string,
    pageUrl?: string,
    pageTitle?: string
  ): Promise<string | null> {
    return this.llm.chooseLocator(step.description, selectors, dom, attempt, lastFailureReason, pageUrl, pageTitle);
  }

  private generateSelectorAlternatives(selector: string): string[] {
    const alternatives = new Set<string>();
    alternatives.add(selector);
    if (selector.includes("[name='")) {
      const name = selector.match(/name='([^']+)'/)?.[1];
      if (name) {
        alternatives.add(`#${name}`);
        alternatives.add(`[data-testid='${name}']`);
        alternatives.add(`[aria-label='${name}']`);
      }
    }
    if (selector.startsWith("button")) {
      alternatives.add("text=Sign in");
      alternatives.add("text=Login");
    }
    return [...alternatives];
  }

  private step(
    id: string,
    description: string,
    action: TestStep["action"],
    selector?: string,
    value?: string,
    expected?: string,
    url?: string
  ): TestStep {
    return { id, description, action, selector, value, expected, url };
  }
}
