import { ExecutionPhase, ExecutionReport, StepAttempt, TestCase, TestCaseExecutionResult } from "../types";

export class HarnessState {
  constructor(private readonly echoToConsole = false) {}

  userStory = "";
  testCases: TestCase[] = [];
  stepHistory: StepAttempt[] = [];
  domSnapshots: Record<string, string[]> = {};
  executionLogs: string[] = [];
  results: TestCaseExecutionResult[] = [];
  phase: ExecutionPhase = "idle";

  private readonly transitions: Record<ExecutionPhase, ExecutionPhase[]> = {
    idle: ["planning"],
    planning: ["executing", "failed"],
    executing: ["verifying", "retrying", "failed"],
    retrying: ["executing", "failed"],
    verifying: ["capturing_artifacts", "retrying", "failed"],
    capturing_artifacts: ["executing", "completed", "failed"],
    completed: [],
    failed: []
  };

  log(message: string): void {
    const entry = `${new Date().toISOString()} ${message}`;
    this.executionLogs.push(entry);
    if (this.echoToConsole) {
      console.log(entry);
    }
  }

  addStepAttempt(attempt: StepAttempt): void {
    this.stepHistory.push(attempt);
  }

  transitionTo(next: ExecutionPhase, context: string): void {
    const allowed = this.transitions[this.phase] ?? [];
    if (!allowed.includes(next)) {
      throw new Error(`Invalid harness state transition: ${this.phase} -> ${next} (${context})`);
    }
    this.log(`State transition ${this.phase} -> ${next} (${context})`);
    this.phase = next;
  }

  saveDomSnapshot(testCaseId: string, dom: string): void {
    this.domSnapshots[testCaseId] ??= [];
    this.domSnapshots[testCaseId].push(dom);
  }

  buildReport(startedAt: string): ExecutionReport {
    const passed = this.results.filter((r) => r.status === "passed").length;
    return {
      userStory: this.userStory,
      startedAt,
      finishedAt: new Date().toISOString(),
      summary: {
        total: this.results.length,
        passed,
        failed: this.results.length - passed
      },
      results: this.results,
      logs: this.executionLogs
    };
  }
}
