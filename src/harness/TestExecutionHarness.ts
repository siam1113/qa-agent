import { AgentEngine } from "../agent/AgentEngine";
import { SelfHealingEngine } from "../healing/SelfHealingEngine";
import { HarnessState } from "../state/HarnessState";
import { FileStorage } from "../storage/FileStorage";
import { BrowserTools } from "../tools/BrowserTools";
import { DeterministicVerifier } from "../verifier/DeterministicVerifier";
import { HarnessConfig, StepAttempt, TestCaseExecutionResult, TestStep } from "../types";

export class TestExecutionHarness {
  constructor(
    private readonly config: HarnessConfig,
    private readonly agent: AgentEngine,
    private readonly tools: BrowserTools,
    private readonly verifier: DeterministicVerifier,
    private readonly healing: SelfHealingEngine,
    private readonly state: HarnessState,
    private readonly storage: FileStorage
  ) {}

  async run(userStory: string): Promise<void> {
    const startedAt = new Date().toISOString();
    this.state.log(`Harness started for story: ${userStory}`);
    this.state.log(`Harness configuration: baseUrl=${this.config.baseUrl ?? "http://localhost:3000"} maxRetriesPerStep=${this.config.maxRetriesPerStep} outputDir=${this.config.outputDir}`);
    this.state.userStory = userStory;
    this.state.log("Requesting test-case generation from agent");
    this.state.testCases = await this.agent.generateTestCases(userStory);
    this.state.log(`Generated ${this.state.testCases.length} test case(s)`);

    await this.tools.init();
    try {
      for (const testCase of this.state.testCases) {
        this.state.log(`[${testCase.id}] Starting test case: ${testCase.name}`);
        const result: TestCaseExecutionResult = {
          testCaseId: testCase.id,
          testCaseName: testCase.name,
          status: "passed",
          stepAttempts: [],
          passedStepIds: []
        };

        for (const step of testCase.steps) {
          this.state.log(`[${testCase.id}/${step.id}] Starting step: ${step.description}`);
          const stepSuccess = await this.executeStepWithRetries(testCase.id, step, result);
          if (!stepSuccess) {
            result.status = "failed";
            result.failedStepId = step.id;
            this.state.log(`[${testCase.id}] Failed on step: ${step.id}`);
            break;
          }
          result.passedStepIds.push(step.id);
        }

        this.state.log(`[${testCase.id}] Completed with status=${result.status}`);
        this.state.results.push(result);
      }
    } finally {
      await this.tools.close();
      this.state.log("Browser session closed");
    }

    const report = this.state.buildReport(startedAt);
    this.storage.write("reports/execution-report.json", JSON.stringify(report, null, 2));
    this.storage.write("artifacts/generated-test-cases.json", JSON.stringify(this.state.testCases, null, 2));
    this.state.log("Execution artifacts persisted to storage");
  }

  private async executeStepWithRetries(testCaseId: string, step: TestStep, testResult: TestCaseExecutionResult): Promise<boolean> {
    this.state.log(`[${testCaseId}/${step.id}] Building action suggestion and selector alternatives`);
    const suggestion = this.agent.suggestAction(step);
    const candidateSelectors = this.healing.buildAlternativeSelectors(step.selector, suggestion.alternatives);
    this.state.log(`[${testCaseId}/${step.id}] Candidate selectors: ${candidateSelectors.join(" | ") || "<none>"}`);

    for (let attempt = 1; attempt <= this.config.maxRetriesPerStep; attempt++) {
      let selector = step.selector;
      if (step.selector && candidateSelectors.length > 0) {
        selector = candidateSelectors[Math.min(attempt - 1, candidateSelectors.length - 1)];
      }

      this.state.log(`[${testCaseId}/${step.id}] Attempt ${attempt} executing action=${step.action} selector=${selector ?? "<none>"}`);
      let executed;
      try {
        executed = await this.executeTool(step, selector);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        this.state.log(`[${testCaseId}/${step.id}] Tool execution threw error on attempt ${attempt}: ${reason}`);
        executed = { success: false, message: reason };
      }
      this.state.log(`[${testCaseId}/${step.id}] Tool execution result: success=${executed.success} message=${executed.message}`);
      const verified = await this.verifier.verify({ ...step, selector }, executed);
      this.state.log(`[${testCaseId}/${step.id}] Verifier result on attempt ${attempt}: ok=${verified.ok} reason=${verified.reason}`);

      const stepAttempt: StepAttempt = {
        stepId: step.id,
        attempt,
        success: verified.ok,
        message: verified.reason,
        selectorUsed: selector,
        failureType: verified.ok ? undefined : this.healing.classifyFailure(verified.reason),
        timestamp: new Date().toISOString()
      };

      this.state.addStepAttempt(stepAttempt);
      testResult.stepAttempts.push(stepAttempt);
      this.state.log(`[${testCaseId}/${step.id}] attempt=${attempt} success=${verified.ok} reason=${verified.reason}`);

      if (verified.ok) {
        this.state.log(`[${testCaseId}/${step.id}] Verification passed; capturing DOM and screenshot`);
        const domResult = await this.tools.get_dom();
        if (domResult.dom) {
          this.state.saveDomSnapshot(testCaseId, domResult.dom);
          this.storage.write(`snapshots/${testCaseId}-${step.id}-attempt${attempt}.html`, domResult.dom);
          this.state.log(`[${testCaseId}/${step.id}] DOM snapshot persisted for attempt ${attempt}`);
        }
        await this.tools.take_screenshot(`${this.config.outputDir}/screenshots/${testCaseId}-${step.id}.png`);
        this.state.log(`[${testCaseId}/${step.id}] Screenshot captured for successful attempt ${attempt}`);
        return true;
      }

      this.state.log(`[${testCaseId}/${step.id}] Verification failed on attempt ${attempt}; waiting before retry`);
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    this.state.log(`[${testCaseId}/${step.id}] Exhausted all ${this.config.maxRetriesPerStep} attempt(s) without success`);
    return false;
  }

  private async executeTool(step: TestStep, selectorOverride?: string) {
    switch (step.action) {
      case "open_page":
        return this.tools.open_page(this.fullUrl(step.url ?? "/"));
      case "click":
        return this.tools.click(selectorOverride ?? step.selector ?? "");
      case "type":
        return this.tools.type(selectorOverride ?? step.selector ?? "", step.value ?? "");
      case "extract_text":
        return this.tools.extract_text(selectorOverride ?? step.selector ?? "");
      case "get_dom":
        return this.tools.get_dom();
      case "take_screenshot":
        return this.tools.take_screenshot(`${this.config.outputDir}/screenshots/manual-step.png`);
      default:
        return { success: false, message: "Unsupported action" };
    }
  }

  private fullUrl(path: string): string {
    if (path.startsWith("http")) return path;
    return `${this.config.baseUrl ?? "http://localhost:3000"}${path}`;
  }
}
