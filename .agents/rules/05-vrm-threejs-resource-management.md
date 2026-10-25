# Rule: VRM/Three.js resource lifecycle

- Inspect the actual Three.js and `@pixiv/three-vrm` versions before choosing APIs.
- Own the renderer, scene, camera, clock/loop, VRM instance, animation mixer and listeners in an explicit lifecycle boundary.
- Stop animation/render loops when appropriate; avoid duplicate requestAnimationFrame loops after reload or window recreation.
- When replacing or unloading a model, dispose owned geometries, materials, textures, mixers, VRM resources and renderer resources as required by the selected libraries. Do not dispose shared resources still in use.
- Use loading progress, cancellation where possible, parse/validation failure and retry states.
- Treat imported files as untrusted. Enforce file size/type policies and prevent arbitrary remote fetches or path traversal.
- Keep baseline motion lightweight: idle/breathing/blink and explicitly supported expression changes. Do not fabricate a generative motion model.
- Validate transparent rendering, alpha handling, resizing, DPI changes and long-running memory behavior on the target desktop OS.
