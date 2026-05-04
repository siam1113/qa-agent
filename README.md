# AI Test Execution Harness

A modular, AI-native QA harness that turns a user story into executable browser validation artifacts.

This project is designed around **strict separation of concerns**:
- Agent reasoning (`src/agent`)
- Deterministic orchestration (`src/harness`)
- Deterministic validation (`src/verifier`)

---

## What this agent does

At runtime, the harness:
1. Accepts a user story (for example: "User can login with email and password").
2. Generates and executes test steps through a browser tooling layer.
3. Verifies expected outcomes with deterministic checks.
4. Applies self-healing retries when a step fails.
5. Produces a final execution report and generated test code.

This makes it useful both for:
- **Exploratory AI-assisted QA execution**, and
- **Bootstrap test authoring** (generated Playwright/Cypress test files).

---

## Repository layout

- `src/index.ts` – main entrypoint and dependency wiring
- `src/agent` – AI-side planning, step suggestion, and test-case reasoning
- `src/harness` – execution control flow, retries, timing, and orchestration
- `src/state` – runtime state tracking and report assembly
- `src/tools` – browser tool abstractions and interactions
- `src/verifier` – deterministic assertions and pass/fail checks
- `src/healing` – self-healing strategy for failed steps
- `src/storage` – artifact persistence to disk
- `src/reporting` – JSON and human-oriented reporting support
- `src/codegen` – generated Playwright/Cypress test output

---

## Prerequisites

- Node.js 18+ (20+ recommended)
- npm 9+
- A running target app (default base URL is `http://localhost:3000`)

Install dependencies:

```bash
npm install
```

Build TypeScript:

```bash
npm run build
```

---

## Quick start

Run with defaults:

```bash
node dist/index.js
```

Equivalent to:
- User story: `"User can login with email and password"`
- Framework: `playwright`

Run with explicit inputs:

```bash
node dist/index.js "User can checkout with credit card" playwright
node dist/index.js "Admin can suspend a user" cypress
```

Development mode (without separate build step):

```bash
npm run dev -- "User can login with email and password" playwright
```

---

## Command interface

The entrypoint currently reads positional CLI arguments:

```text
node dist/index.js <userStory?> <framework?>
```

### `userStory` (optional)
- Type: `string`
- Default: `"User can login with email and password"`
- Purpose: High-level behavior to validate.

### `framework` (optional)
- Allowed values: `playwright | cypress`
- Default: `playwright`
- Purpose: Determines generated test code format and output file name.

---

## Runtime behavior and outputs

On startup, the harness creates `./output` if it does not exist. During/after execution, it writes artifacts including:

- `output/reports/final-report.json`
- `output/generated/generated.spec.ts` (when framework is `playwright`)
- `output/generated/generated.cy.ts` (when framework is `cypress`)

The terminal prints:

```text
Harness execution complete. Output stored in ./output
```

---

## Core execution flow

The high-level flow in `src/index.ts` is:

1. Parse CLI inputs (`userStory`, `framework`).
2. Initialize output directory.
3. Construct runtime dependencies:
   - `HarnessState`
   - `FileStorage`
   - `AgentEngine`
   - `BrowserTools`
   - `DeterministicVerifier`
   - `SelfHealingEngine`
4. Create `TestExecutionHarness` with config:
   - `maxRetriesPerStep: 3`
   - `stepTimeoutMs: 5000`
   - `baseUrl: http://localhost:3000`
5. Run harness with `await harness.run(userStory)`.
6. Serialize report + generated code to `output/`.

This dependency-injection style keeps each module independently replaceable.

---

## Configuration details

The current runtime configuration is defined directly in `src/index.ts`.

### Defaults
- `maxRetriesPerStep = 3`
- `stepTimeoutMs = 5000`
- `baseUrl = "http://localhost:3000"`

### How to customize

You can adjust these values in the `TestExecutionHarness` constructor call in `src/index.ts`.

Recommended future improvement: move these to environment variables or a config file for easier CI/environment tuning.

### LLM-backed generation (optional)

The harness now supports LLM-powered test-case creation and test-code generation.

- Set `OPENAI_API_KEY` to enable LLM calls.
- Optionally set `OPENAI_MODEL` (default: `gpt-4.1-mini`).

If `OPENAI_API_KEY` is not present, the harness falls back to deterministic built-in templates.

---

## How to add new capabilities

### 1) Add/modify agent reasoning
Edit modules under `src/agent` to change how stories become test cases and action plans.

### 2) Add deterministic checks
Extend `src/verifier` to add reusable, explicit assertions that avoid ambiguous pass/fail signals.

### 3) Improve self-healing
Update `src/healing` retry-selection logic to better recover from flaky selectors, timing issues, or transient app states.

### 4) Expand browser tooling
Add new interaction primitives in `src/tools` while maintaining strict interfaces used by harness/verifier layers.

### 5) Adjust generated test style
Change `src/codegen/TestCodeGenerator` to alter naming conventions, fixture usage, or assertion style in emitted code.

---

## Suggested local workflow

1. Start your application under test on `http://localhost:3000`.
2. Run harness for one user story.
3. Inspect `output/reports/final-report.json`.
4. Review generated tests under `output/generated/`.
5. If needed, refine agent/verifier/healing logic and rerun.

This "story -> run -> inspect -> refine" loop is the fastest way to evolve quality and reliability.

---

## Troubleshooting

### No useful report output
- Confirm the app is reachable at `http://localhost:3000`.
- Verify your story is specific enough to drive actionable steps.

### Build errors
- Run `npm install` again.
- Confirm Node/TypeScript versions are compatible.

### Generated framework file not what you expected
- Check the second CLI argument (`playwright` vs `cypress`).

### Intermittent failures
- Increase `stepTimeoutMs`.
- Improve verifier determinism.
- Enhance self-healing strategy for known flaky paths.

---

## Example end-to-end session

```bash
npm install
npm run build
node dist/index.js "User can login with email and password" playwright
cat output/reports/final-report.json
```

Then inspect:
- `output/generated/generated.spec.ts`

---

## Notes for CI usage

For CI, you typically want to:
- Build once (`npm run build`)
- Run one or more story executions
- Collect `output/` as artifacts
- Fail pipeline if deterministic verification reports failures

Because this harness is modular, it is straightforward to layer into broader QA pipelines later.
