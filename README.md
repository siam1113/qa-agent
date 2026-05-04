# AI Test Execution Harness

Production-style modular AI-native QA harness with strict separation between:
- Agent reasoning (`src/agent`)
- Deterministic harness control (`src/harness`)
- Deterministic verification (`src/verifier`)

## Structure

- `src/agent`: Test-case and action suggestion logic
- `src/harness`: Orchestration and retries
- `src/state`: Runtime state and report assembly
- `src/tools`: Browser tools with strict interfaces
- `src/verifier`: Deterministic assertions
- `src/healing`: Self-healing retry selector strategy
- `src/storage`: Artifact persistence
- `src/reporting`: Report formatting
- `src/codegen`: Playwright/Cypress test generation

## Run

```bash
npm install
npm run build
node dist/index.js "User can login with email and password" playwright
```

Artifacts are stored in `output/`.
