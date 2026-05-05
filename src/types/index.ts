export type ActionType = "open_page" | "click" | "type" | "extract_text" | "get_dom" | "take_screenshot";

export type FailureType = "selector_issue" | "timing_issue" | "logic_issue" | "unknown";

export type ExecutionPhase =
  | "idle"
  | "planning"
  | "executing"
  | "retrying"
  | "verifying"
  | "capturing_artifacts"
  | "completed"
  | "failed";

export type FailureCategory =
  | "selector_missing"
  | "selector_ambiguous"
  | "timing_timeout"
  | "assertion_mismatch"
  | "navigation_error"
  | "tooling_error"
  | "unknown";

export interface FailureClassification {
  type: FailureType;
  category: FailureCategory;
  confidence: number;
  retryable: boolean;
  reason: string;
}

export interface DomDiffSummary {
  similarity: number;
  addedNodes: number;
  removedNodes: number;
  changedTokens: number;
}

export interface TestStep {
  id: string;
  description: string;
  action: ActionType;
  selector?: string;
  value?: string;
  expected?: string;
  url?: string;
}

export interface TestCase {
  id: string;
  name: string;
  steps: TestStep[];
  expectedOutcome: string;
}

export interface AgentActionSuggestion {
  action: ActionType;
  selector?: string;
  value?: string;
  url?: string;
  alternatives?: string[];
  reason: string;
}

export interface StepAttempt {
  stepId: string;
  attempt: number;
  success: boolean;
  failureType?: FailureType;
  failureCategory?: FailureCategory;
  failureConfidence?: number;
  retryable?: boolean;
  message: string;
  selectorUsed?: string;
  timestamp: string;
  phase: ExecutionPhase;
  domDiff?: DomDiffSummary;
}

export interface StepExecutionResult {
  success: boolean;
  message: string;
  dom?: string;
  screenshotPath?: string;
  extractedText?: string;
  pageUrl?: string;
  pageTitle?: string;
}

export interface TestCaseExecutionResult {
  testCaseId: string;
  testCaseName: string;
  status: "passed" | "failed";
  stepAttempts: StepAttempt[];
  passedStepIds: string[];
  failedStepId?: string;
}

export interface HarnessConfig {
  maxRetriesPerStep: number;
  stepTimeoutMs: number;
  baseUrl?: string;
  outputDir: string;
  framework: "playwright" | "cypress";
}

export interface ExecutionReport {
  userStory: string;
  startedAt: string;
  finishedAt: string;
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
  results: TestCaseExecutionResult[];
  logs: string[];
}
