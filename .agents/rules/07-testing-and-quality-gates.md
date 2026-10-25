# Rule: Quality gates and honest verification

- Determine the actual package manager and scripts from manifests; do not assume npm, pnpm, lint, test, or build scripts exist.
- For each non-trivial change, run applicable typecheck, lint, unit/component tests, integration tests and production build.
- For native lifecycle behavior, add automated tests where feasible and a repeatable manual test for behavior that automation cannot validate.
- Include negative cases: invalid IPC payload, missing VRM, bad auth, disconnected provider, Stage destroyed/recreated, display removed and shortcut conflict as applicable.
- Report the exact command and result. Clearly label skipped, blocked, unrun and manual checks.
- Do not claim an operation is implemented because a button exists; test the underlying behavior.
- Avoid flaky tests; use deterministic fixtures, mock only at appropriate boundaries and keep at least one real integration path for critical flows.
