---
name: electron-vue-ipc-contracts
description: Typed IPC contracts between Electron and Vue. Use for tasks matching this capability in the YourCustomWaifu desktop app.
---

# Typed IPC and cross-window contracts

Use when adding native bridge methods or synchronizing Workspace, Stage and Main/runtime.

## API design
- Expose named methods via preload, not arbitrary channel forwarding.
- Define request/response/event types in a shared contract module that can safely be imported by Main, Preload and renderers.
- Use runtime schema validation at the boundary; TypeScript types do not validate data at runtime.
- Define who owns truth for each field: backend, Main/runtime, or renderer-local UI.
- Make commands return a result or emit a structured error. Avoid silent failures.
- Use request IDs/correlation only where async responses can overlap and association matters.
- Ensure subscriptions return an unsubscribe function and are disposed on component/window close.
- Restrict channels to an allowlist; validate origin/frame/sender where supported by the pinned Electron version.

## Example conceptual shape
`window.companion.stage.show()` is preferred to `window.electron.ipcRenderer.send(channel, payload)`.
The exact API shape must match repository conventions and runtime validation. Never expose an unrestricted generic IPC method.

## State synchronization
Main/runtime is the canonical authority for native Stage visibility and click-through. A renderer may optimistically indicate progress, but must reconcile with the authoritative response/event.

## Testing
Test valid payloads, malformed payloads, rejected sender, missing preload, closed target window, duplicate subscription and late response after a renderer is destroyed.
