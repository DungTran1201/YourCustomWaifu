# F10 — Avatar Settings and Stage

## 1. Functional Scope & Purpose
F10 governs the Avatar Stage: an independent, transparent, frameless Electron desktop window that displays the user-selected 3D VRM companion avatar. It operates with its own lifecycle independent of the Workspace window.

## 2. Current Implementation
- **Window Architecture:** Frameless, transparent BrowserWindow with `alwaysOnTop` and `clickThrough` options.
- **Universal 7-Stage VRM Pipeline:** In `stage.ts:prepareVrmForStage()`:
  1. Structural validation & parsing (`VRMLoaderPlugin`).
  2. Orientation normalization (`auto`, `0deg`, `180deg`).
  3. A-Pose stabilization for arm bone resting angles.
  4. Bounding-box normalization and scale fitting.
  5. LookAt gaze target binding.
  6. Expression controller discovery (`VRMBlinkController`).
  7. Atomic scene attachment (previous avatar disposed ONLY after new avatar mounts successfully).
- **Gaze Tracking:** 30Hz screen cursor polling in Electron main process broadcasts normalized gaze coordinates to Stage window.
- **Autonomic Blinking:** Four-state state machine (`Open`, `Closing`, `Closed`, `Opening`) in `vrm-blink.ts` with asymmetric eye fallback and test blink IPC.

## 3. Requirements & Acceptance Criteria
- AC-01: Workspace close/minimize must not close Stage or stop gaze tracking.
- AC-02: Hiding Stage must not sign out the user or unload the selected VRM.
- AC-03: Switching avatars must safely dispose GPU textures and geometries without memory leaks.
- AC-04: Blinking diagnostics must be retrievable via IPC.
