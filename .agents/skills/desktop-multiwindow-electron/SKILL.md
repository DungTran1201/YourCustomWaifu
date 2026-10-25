---
name: desktop-multiwindow-electron
description: Electron multi-window coordination. Use for tasks matching this capability in the YourCustomWaifu desktop app.
---

# Multi-window coordination

Use for Workspace/Avatar Stage creation, state sync, show/hide, window persistence, tray actions or monitor handling.

## Decision guide
- Use separate native windows for Workspace and Stage because Stage must outlive Workspace.
- Maintain a typed window registry keyed by stable names; remove entries when windows close.
- Put canonical lifecycle state and native window operations in Main/runtime, not in renderer component state alone.
- Send infrequent state changes through Main-process IPC. Consider a `MessagePort` only if genuinely needed for high-frequency streams and if the security contract remains explicit.
- Never let one renderer reach into another renderer's `window`, DOM, or internal store.

## Lifecycle procedure
1. Define independent states: app lifecycle, Workspace visibility, Stage visibility, animation paused, click-through and runtime health.
2. Implement idempotent `showStage`, `hideStage`, `toggleStage`, `showWorkspace` and `quitApp` operations.
3. A repeated `showStage` must focus/show the existing instance rather than create a duplicate.
4. Closing Workspace hides or closes only Workspace according to product policy; Stage/runtime continue.
5. Stage hiding must not unload the VRM unless a documented resource-saving policy deliberately unloads it.
6. Persist state only when useful; validate bounds against current display work areas before restoring.
7. Test disconnected monitors, minimized/hidden windows, tray actions and restart behavior.

## Red flags
- `window-all-closed` directly quitting when Stage is intentionally persistent.
- A single boolean called `isOpen` representing multiple lifecycle states.
- Duplicate IPC listeners after reopening Workspace.
- Saved coordinates restoring a window off-screen.
- Tray state not reflecting actual window visibility.

## Acceptance checklist
- One Stage maximum.
- Close Workspace → Stage continues.
- Hide Stage → runtime continues.
- Tray and shortcut agree on visibility state.
- Explicit Quit tears down windows and listeners cleanly.
