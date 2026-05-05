import { mkdirSync } from "fs";
import { resolve } from "path";
import { AgentEngine } from "./agent/AgentEngine";
import { TestCodeGenerator } from "./codegen/TestCodeGenerator";
import { TestExecutionHarness } from "./harness/TestExecutionHarness";
import { SelfHealingEngine } from "./healing/SelfHealingEngine";
import { ExecutionReporter } from "./reporting/ExecutionReporter";
import { HarnessState } from "./state/HarnessState";
import { FileStorage } from "./storage/FileStorage";
import { BrowserTools } from "./tools/BrowserTools";
import { DeterministicVerifier } from "./verifier/DeterministicVerifier";

async function main(): Promise<void> {
  const userStory = process.argv[2] ?? "User can login with email and password";
  const framework = (process.argv[3] as "playwright" | "cypress") ?? "playwright";

  const outputDir = resolve("output");
  mkdirSync(outputDir, { recursive: true });

  const state = new HarnessState(true);
  state.log(`Initializing harness for framework=${framework}`);
  const storage = new FileStorage(outputDir, (message) => state.log(message));
  const agent = new AgentEngine();
  const tools = new BrowserTools((message) => state.log(message));
  const verifier = new DeterministicVerifier(tools);
  const healing = new SelfHealingEngine();

  const harness = new TestExecutionHarness(
    {
      maxRetriesPerStep: 3,
      stepTimeoutMs: 5_000,
      baseUrl: "https://youtube.com",
      outputDir,
      framework
    },
    agent,
    tools,
    verifier,
    healing,
    state,
    storage
  );

  await harness.run(userStory);
  state.log("Harness run completed");

  const reporter = new ExecutionReporter();
  const codegen = new TestCodeGenerator();

  storage.write("reports/final-report.json", reporter.toJson(state.buildReport(new Date().toISOString())));
  storage.write(
    framework === "playwright" ? "generated/generated.spec.ts" : "generated/generated.cy.ts",
    await codegen.generate(framework, state.testCases)
  );
  state.log("Final report and generated test code saved");

  console.log("Harness execution complete. Output stored in ./output");
}

main().catch((err) => {
  console.error("Fatal harness error", err);
  process.exit(1);
});
