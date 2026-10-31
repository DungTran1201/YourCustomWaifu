# F08 — Tools and Permissions

## 1. Functional Scope & Purpose
F08 governs tool capabilities available to the companion, schema validation, permission levels (`read-only`, `user-action`, `system`), user confirmation gates, and closed-loop model tool calling.

## 2. Current Implementation & Confirmed Defect Status
- **Builtin Registry:** In `tool-executor.ts:22`:
  - `tool_stage_expression`: Triggers facial expressions and animations on Avatar Stage.
  - `tool_memory_recall`: Queries long-term memories with limit and query parameters.
  - `tool_system_diagnostics`: Inspects OS, Node version, memory usage.
- **Validation & Limits:** `validateParameters()` checks argument types, required fields, and enums. 5-second execution timeout and 64KB maximum result size enforced.
- **Confirmation Gate:** Tools with `requiresConfirmation: true` reject unconfirmed requests with `confirmation_required`.
- **Defect P1 (Remediated):** Formerly, tools were only mentioned in text in system instructions without an execution feedback loop. Remediated by implementing a structured tool calling loop in `server.ts` that detects tool invocations, invokes `ToolExecutor`, and performs bounded conversational follow-up.

## 3. Requirements & Acceptance Criteria
- AC-01: Unknown or disabled tools must be rejected with appropriate error codes (`unknown_tool`, `tool_disabled`).
- AC-02: Arguments must match JSON parameter schema definitions.
- AC-03: Sensitive tools must enforce explicit confirmation before execution.
- AC-04: Tool execution timeouts must reject after 5000ms.
- AC-05: Model tool-call loop must be bounded to prevent runaway recursion.
