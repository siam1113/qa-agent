import { ActionType, TestCase } from "../types";

interface OpenAIResponse {
  output?: Array<{
    content?: Array<{ type?: string; text?: string }>;
  }>;
}

export class LlmClient {
  private readonly apiKey = process.env.OPENAI_API_KEY;
  private readonly model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

  get enabled(): boolean {
    return Boolean(this.apiKey);
  }

  async generateTestCases(userStory: string): Promise<TestCase[] | null> {
    const schemaHint = `Return strict JSON only: {"testCases":[{"id":"string","name":"string","expectedOutcome":"string","steps":[{"id":"string","description":"string","action":"open_page|click|type|extract_text|get_dom|take_screenshot","selector":"string?","value":"string?","expected":"string?","url":"string?"}]}]}`;
    const prompt = `${schemaHint}\nUser story: ${userStory}`;
    const text = await this.responses(prompt, "You generate concise browser test cases.");
    if (!text) return null;
    return this.safeParseTestCases(text);
  }

  async generateCode(framework: "playwright" | "cypress", tests: TestCase[]): Promise<string | null> {
    const prompt = `Generate a ${framework} test file from this JSON test list. Return code only.\n${JSON.stringify(tests)}`;
    return this.responses(prompt, "You are a senior QA automation engineer.");
  }

  private async responses(input: string, instructions: string): Promise<string | null> {
    if (!this.apiKey) return null;
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ model: this.model, instructions, input })
    });
    if (!response.ok) return null;
    const json = (await response.json()) as OpenAIResponse;
    const parts = json.output?.flatMap((o) => o.content ?? []) ?? [];
    return parts.filter((p) => p.type === "output_text").map((p) => p.text ?? "").join("").trim() || null;
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
