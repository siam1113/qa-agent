import { ActionType, TestCase } from "../types";

interface OpenAIResponse {
  output_text?: string;
  output?: Array<{
    content?: Array<{ type?: string; text?: string; value?: string }>;
  }>;
}

export class LlmClient {
  private readonly apiKey = process.env.OPENAI_API_KEY;
  private readonly model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

  get enabled(): boolean {
    return Boolean(this.apiKey);
  }

  async generateTestCases(userStory: string): Promise<TestCase[] | null> {
    this.log("Generating test cases via OpenAI Responses API");
    const schemaHint = `Return strict JSON only: {"testCases":[{"id":"string","name":"string","expectedOutcome":"string","steps":[{"id":"string","description":"string","action":"open_page|click|type|extract_text|get_dom|take_screenshot","selector":"string?","value":"string?","expected":"string?","url":"string?"}]}]}`;
    const prompt = `${schemaHint}\nUser story: ${userStory}`;
    const text = await this.responses(prompt, "You generate concise browser test cases.");
    if (!text) {
      this.log("No LLM text returned for test-case generation");
      return null;
    }
    const parsed = this.safeParseTestCases(text);
    this.log(parsed?.length ? `Parsed ${parsed.length} LLM test case(s)` : "Failed to parse LLM test-case JSON; fallback will be used");
    return parsed;
  }

  async generateCode(framework: "playwright" | "cypress", tests: TestCase[]): Promise<string | null> {
    this.log(`Generating ${framework} test code via OpenAI Responses API for ${tests.length} test case(s)`);
    const prompt = `Generate a ${framework} test file from this JSON test list. Return code only.\n${JSON.stringify(tests)}`;
    const code = await this.responses(prompt, "You are a senior QA automation engineer.");
    this.log(code ? `Received LLM-generated ${framework} code (${code.length} chars)` : `No LLM code returned for ${framework}; deterministic fallback will be used`);
    return code;
  }

  async chooseLocator(stepDescription: string, selectors: string[], dom?: string, attempt?: number, lastFailureReason?: string, pageUrl?: string, pageTitle?: string): Promise<string | null> {
    this.log(`Choosing locator via OpenAI from ${selectors.length} candidate(s)`);
    const prompt = [
      "Pick the single best CSS selector for reliable browser automation.",
      "You may propose a selector not listed in candidates if DOM suggests a better one.",
      "Return strict JSON only: {\"selector\":\"string\"}",
      `Step description: ${stepDescription}`,
      `Retry attempt: ${attempt ?? 1}`,
      `Previous failure signal: ${lastFailureReason ?? "<none>"}`,
      `Active page URL: ${pageUrl ?? "<unknown>"}`,
      `Active page title: ${pageTitle ?? "<unknown>"}`,
      `Candidate selectors: ${JSON.stringify(selectors)}`,
      `Current DOM snapshot:\n${this.trimDomForPrompt(dom)}`
    ].join("\n");
    const text = await this.responses(prompt, "You are a QA automation locator-selection assistant.");
    if (!text) return null;
    try {
      const cleaned = text.replace(/^```json\s*/i, "").replace(/^```|```$/g, "").trim();
      const parsed = JSON.parse(cleaned) as { selector?: string };
      if (parsed.selector?.trim()) {
        this.log(`Locator selected by OpenAI: ${parsed.selector}`);
        return parsed.selector.trim();
      }
    } catch {
      // Fall through to deterministic fallback.
    }
    this.log("OpenAI locator selection was invalid; deterministic fallback will be used");
    return null;
  }

  private trimDomForPrompt(dom?: string): string {
    if (!dom?.trim()) return "<dom unavailable>";
    const maxChars = 40_000;
    if (dom.length <= maxChars) return dom;
    const head = dom.slice(0, 20_000);
    const tail = dom.slice(-20_000);
    return `${head}\n<!-- DOM truncated: middle removed -->\n${tail}`;
  }

  private async responses(input: string, instructions: string): Promise<string | null> {
    if (!this.apiKey) {
      this.log("OPENAI_API_KEY is not set; skipping OpenAI call");
      return null;
    }
    this.log(`Calling OpenAI model=${this.model}`);
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.model,
        instructions,
        input,
        text: { format: { type: "text" } }
      })
    });
    if (!response.ok) {
      this.log(`OpenAI call failed with status=${response.status}`);
      return null;
    }
    const json = (await response.json()) as OpenAIResponse;
    if (json.output_text?.trim()) {
      this.log(`OpenAI response used top-level output_text (${json.output_text.length} chars)`);
      return json.output_text.trim();
    }

    const parts = json.output?.flatMap((o) => o.content ?? []) ?? [];
    const extracted = parts
      .filter((p) => p.type === "output_text" || p.type === "text")
      .map((p) => p.text ?? p.value ?? "")
      .join("")
      .trim();

    if (extracted) {
      this.log(`OpenAI response used chunked text output (${extracted.length} chars)`);
      return extracted;
    }
    this.log("OpenAI response did not contain supported text output");
    return null;
  }

  private log(message: string): void {
    console.log(`[LlmClient] ${message}`);
  }

  private safeParseTestCases(raw: string): TestCase[] | null {
    try {
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```|```$/g, "").trim();
      const parsed = JSON.parse(cleaned) as { testCases?: TestCase[] };
      if (!parsed.testCases?.length) return null;
      return parsed.testCases.map((tc) => ({
        id: tc.id,
        name: tc.name,
        expectedOutcome: tc.expectedOutcome,
        steps: (tc.steps ?? []).map((s) => ({
          id: s.id,
          description: s.description,
          action: s.action as ActionType,
          selector: s.selector,
          value: s.value,
          expected: s.expected,
          url: s.url
        }))
      }));
    } catch {
      return null;
    }
  }
}
