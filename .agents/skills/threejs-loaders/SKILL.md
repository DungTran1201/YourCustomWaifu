---
name: threejs-loaders
description: Three.js loading pipeline. Use for tasks matching this capability in the YourCustomWaifu desktop app.
---

# Three.js asset loading

Use for VRM/glTF model loading, progress, errors, cancellation, asset replacement or loading performance.

## Workflow
1. Inspect installed `three` and `@pixiv/three-vrm` versions and the current loader integration.
2. Prefer local user-selected files for this product; do not fetch arbitrary remote URLs unless explicitly supported and validated.
3. Model the lifecycle as `idle → loading → ready` or `error`, with retry/cancel where practical.
4. Show progress if the loader provides meaningful progress; distinguish file read, parse and GPU upload if observable.
5. Validate extension/size and handle malformed model files without crashing the renderer.
6. Use the VRM-specific loader/parser supported by the installed library. Do not assume every glTF model is a VRM.
7. On replacement, detach the previous model, stop its actions and dispose resources owned by it without disposing shared assets.
8. Test packaged asset paths and local files in paths containing spaces and Unicode characters.

## Anti-patterns
- Loading a full local path through an unrestricted renderer filesystem API.
- Treating the `.vrm` extension alone as proof the file is valid.
- Hiding parse errors and leaving a permanent spinner.
- Recreating the renderer or event loop for each avatar change.

Use upstream Three.js loader guidance and the official three-vrm project as references; versions may change loader APIs.
