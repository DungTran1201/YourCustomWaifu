---
name: vue-pinia-best-practices
description: Predictable shared state with Pinia. Use for tasks matching this capability in the YourCustomWaifu desktop app.
---

# Pinia state design

Use when multiple Workspace components or Workspace and Stage need shared application state. In an Electron multi-window app, Pinia instances in separate renderers are not automatically shared; Main/runtime remains canonical for native lifecycle and cross-window state.

## Steps
1. Identify the source of truth: backend for persisted account data, Main/runtime for native window lifecycle, renderer store for local UI state.
2. Define narrow typed store state and actions; avoid storing derived values that can be computed.
3. Keep secrets out of the store and never persist authentication material casually to localStorage.
4. When destructuring reactive state, use the project's established Pinia pattern (for example `storeToRefs` where appropriate).
5. Add explicit loading/error states and prevent overlapping requests when required.
6. For Stage events, send a typed action to preload/Main and update store state from the authoritative response/event.
7. Ensure event subscriptions are removed when components or windows are disposed.

## Anti-patterns
- Assuming separate renderer stores synchronize automatically.
- Duplicating the same `stageVisible` truth in tray, main, Workspace and Stage without reconciliation.
- Persisting a store wholesale without a documented schema/version strategy.

## Check
Test state restoration, stale responses, double requests and window recreation.
