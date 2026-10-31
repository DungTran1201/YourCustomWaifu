# F12 — Integration, Evaluation and Release

## 1. Functional Scope & Purpose
F12 encompasses cross-module integration tests, offline deterministic AI evaluation, continuous quality gates, and desktop packaging verification.

## 2. Current Implementation
- **Offline AI Evaluation Harness:** `apps/desktop/tests/ai-evaluation-suite.spec.ts`
  - Evaluates multi-layer prompt assembly, persona adherence, rule prioritization, tool schemas, and memory inclusion without incurring live LLM costs.
  - Verifies 12-message history window bounds.
  - Validates provider error recovery and structured degradation.
- **End-to-End Flow:** `apps/desktop/tests/companion-e2e-flow.spec.ts` verifies registration, persona customization, chat turn, memory recall, and user data cascade deletion.
- **Packaging Pipeline:** Electron Builder configuration in `apps/desktop/package.json` targeting Windows NSIS and Portable distributions.

## 3. Requirements & Acceptance Criteria
- AC-01: Offline evaluation suite must execute deterministically without external network dependency.
- AC-02: CI workflow must run `test`, `typecheck`, `lint`, and `build` across packages.
- AC-03: Production builds must bundle preload and main process cleanly without external type reference leaks.
