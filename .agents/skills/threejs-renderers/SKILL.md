---
name: threejs-renderers
description: Three.js renderer lifecycle and performance. Use for tasks matching this capability in the YourCustomWaifu desktop app.
---

# Three.js renderer lifecycle

Use when creating a transparent Stage renderer, resizing, handling DPI, optimizing idle performance or diagnosing GPU/resource issues.

## Workflow
1. Create renderer options that match the target transparent native window and color-management settings.
2. Ensure renderer canvas/background alpha matches the native window transparency configuration.
3. Handle resize events and device pixel ratio changes without recreating the entire scene unnecessarily.
4. Set a sensible pixel-ratio cap appropriate to the app's performance goals.
5. Stop animation scheduling and remove resize/visibility listeners during cleanup.
6. Dispose renderer and scene-owned resources during actual teardown; hiding the Stage need not destroy the entire renderer unless a clear memory policy says so.
7. Measure frame rate or memory only using a repeatable method; never invent benchmark numbers.

## Acceptance
Transparent background verified on target OS, resize works, pause/hide behavior is stable, and resource cleanup is exercised by tests or a documented manual procedure.
