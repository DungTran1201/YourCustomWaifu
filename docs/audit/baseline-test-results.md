# Baseline Test Results & Execution Evidence — YourCustomWaifu

**Execution Date:** 2026-10-27  
**Environment:** Windows, Node.js 22, pnpm 9, Vitest 4.1.12, Electron 45  
**Executions Conducted:** `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`

---

## 1. Summary of Executed Commands

| Command | Exit Code | Result Summary | Pre-existing Defects |
| :--- | :--- | :--- | :--- |
| `pnpm test` | 0 | 23 test files passed, 203 tests passed | None failing |
| `pnpm typecheck` | 0 | 0 TypeScript / vue-tsc errors | Clean |
| `pnpm lint` | 0 | All matched files use Prettier code style | Clean |
| `pnpm build` | 0 | Main, preload, and renderer bundles built cleanly | Clean |

---

## 2. Test File Breakdown

```
 ✓ apps/desktop/tests/provider-chat-runtime.spec.ts (12 tests) 448ms
 ✓ apps/desktop/tests/companion-storage.spec.ts (8 tests) 665ms
 ✓ apps/desktop/tests/ai-evaluation-suite.spec.ts (4 tests) 661ms
 ✓ apps/desktop/tests/companion-e2e-flow.spec.ts (1 test) 710ms
 ✓ apps/desktop/tests/tool-executor.spec.ts (12 tests) 971ms
 ✓ apps/desktop/tests/companion-memory.spec.ts (9 tests) 1489ms
 ✓ apps/desktop/tests/companion-ui.spec.ts (3 tests) 521ms
 ✓ apps/desktop/tests/security.spec.ts (4 tests) 169ms
 ✓ apps/desktop/tests/fetch-resilience.spec.ts (8 tests) 367ms
 ✓ apps/desktop/tests/auth-ui.spec.ts (6 tests) 792ms
 ✓ apps/desktop/tests/tools-ui.spec.ts (3 tests) 177ms
 ✓ apps/desktop/tests/guest-preview.spec.ts (17 tests) 473ms
 ✓ apps/desktop/tests/entry-navigation.spec.ts (6 tests) 281ms
 ✓ apps/desktop/tests/server-startup.spec.ts (4 tests) 126ms
 ✓ apps/desktop/tests/companion-configuration.spec.ts (6 tests) 36ms
 ✓ apps/desktop/tests/responsive-layout.spec.ts (33 tests) 1836ms
 ✓ apps/desktop/tests/auth.spec.ts (19 tests) 3390ms
 ✓ apps/desktop/tests/vrm-parsing.spec.ts (2 tests) 15ms
 ✓ apps/desktop/tests/vrm-blink.spec.ts (14 tests) 27ms
 ✓ apps/desktop/tests/vrm-pose.spec.ts (9 tests) 35ms
 ✓ apps/desktop/tests/stage-lifecycle.spec.ts (18 tests) 12ms
 ✓ apps/desktop/tests/workspace-contracts.spec.ts (3 tests) 3ms
 ✓ apps/desktop/tests/ipc-contract.spec.ts (2 tests) 2ms

Total: 23 Test Files Passed, 203 Tests Passed, Duration: 15.91s
```

---

## 3. Findings from Baseline Execution

1. Existing test suite covers auth, storage, VRM parsing, and companion memory thoroughly.
2. Areas lacking automated regression test coverage identified for remediation:
   - Dynamic key management / safeStorage lifecycle and legacy key migration (`crypto.ts`).
   - Assertion that Gemini requests do not place API keys in URL query string.
   - Closed-loop model tool calling execution loop in `server.ts`.
   - Store optimistic rollback behavior upon API write errors.
   - Request timeout and cancellation propagation.

---

## 4. Post-Remediation Execution Evidence

| Command | Exit Code | Result Summary | Status |
| :--- | :--- | :--- | :--- |
| `pnpm test` | 0 | **26 test files passed, 218 tests passed** (+15 new regression tests) | **VERIFIED** |
| `pnpm typecheck` | 0 | 0 errors across main, preload, server, and renderer | **VERIFIED** |
| `pnpm lint` | 0 | 100% Prettier compliance | **VERIFIED** |
| `pnpm build` | 0 | Clean production build of main, preload, and renderer bundles | **VERIFIED** |

