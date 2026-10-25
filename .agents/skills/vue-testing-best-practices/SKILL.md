---
name: vue-testing-best-practices
description: Vue component and store testing. Use for tasks matching this capability in the YourCustomWaifu desktop app.
---

# Vue testing workflow

Use for component tests, Pinia stores, composables, form validation and state transitions.

1. Inspect the existing test runner and conventions before adding a new one.
2. Test observable behavior rather than implementation details.
3. Mount components with required router/store/plugin providers and clean up after each test.
4. Test loading, empty, valid, invalid, disabled and failure states for important user-facing flows.
5. Mock the native bridge at the boundary; do not pretend mocked calls validate Electron native behavior.
6. For async behavior, wait for explicit UI state or use framework flushing utilities rather than fixed sleeps.
7. Test keyboard focus and accessible labels for core controls where feasible.
8. Add regression tests for bugs before fixing them when practical.

## Required high-value cases
- Authentication form validation and API errors.
- Stage show/hide controls reflect authoritative responses.
- Stage IPC unavailable/failure state is visible and recoverable.
- Agent/Skill/Rule edit cancellation doesn't accidentally persist.
