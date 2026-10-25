---
name: threejs-animation
description: Three.js animation and idle motion. Use for tasks matching this capability in the YourCustomWaifu desktop app.
---

# Three.js animation workflow

Use for idle movement, expression changes, animation mixers, requestAnimationFrame loops or performance fixes in Avatar Stage.

## Workflow
1. Confirm the actual VRM version and animation APIs; do not assume API parity across `@pixiv/three-vrm` versions.
2. Keep one owned render/animation loop per Stage renderer.
3. Use a time delta and cap unusually large frame deltas after background throttling/resume.
4. Separate idle pose updates, animation mixer updates, VRM expression updates and renderer drawing into understandable functions.
5. Pause expensive updates when hidden or paused according to the product's resource policy, and resume without creating a second loop.
6. Keep default motion subtle and inexpensive: idle breathing/sway, blink and expression changes only when supported.
7. Provide deterministic fallback if an animation asset is missing.
8. Avoid running motion-generation models; this app uses lightweight basic animation unless the product scope changes.

## Test
Repeated pause/resume, hide/show, model replacement and renderer recreation must not multiply loops or leak listeners.
