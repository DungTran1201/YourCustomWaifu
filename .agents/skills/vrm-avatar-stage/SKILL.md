---
name: vrm-avatar-stage
description: YourCustomWaifu VRM Avatar Stage. Use for tasks matching this capability in the YourCustomWaifu desktop app.
---

# VRM Avatar Stage — project-specific workflow

Use whenever changing VRM import, avatar renderer, animation/expression behavior or Stage UI/native window integration.

## Responsibilities
- Own VRM selection/load state in coordination with Main/runtime.
- Render the active VRM on the transparent Stage.
- Provide basic idle movement, blinking and supported expressions.
- Expose safe controls for pause/resume, click-through and hide/show.
- Report errors to the user and Workspace without crashing either window.

## State contract
Use distinct states: `no-avatar`, `loading`, `ready`, `paused`, `error`, and `hidden` where applicable. Keep `stageVisible` separate from `animationPaused` and application lifecycle.

## Workflow
1. Read the current VRM/Three.js implementation and versions.
2. Trace selection from Workspace → typed preload capability → Main validation/file selection contract → Stage loader.
3. Ensure selected file paths are not broadly exposed to renderer filesystem access.
4. Load/validate VRM, report progress/errors and keep the previous avatar until replacement succeeds when feasible.
5. Reconcile Stage state with Main/runtime after Stage reload/recreation.
6. Add animation with a single loop and test pause/hide/resume/model replacement.
7. Handle unsupported model, missing file and GPU/render failures with recovery actions.

## Do not
- Embed character art in Chatspace.
- Create a second Stage renderer or event loop on each toggle.
- Promise advanced motion synthesis that has not been implemented.
- Claim VRM loading is verified based only on mocked UI.

## Acceptance
Valid VRM loads on the target OS; invalid input fails safely; Stage is transparent; basic motion works; pause/hide/show is stable; resource cleanup is tested or manually verified.
