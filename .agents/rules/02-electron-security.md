# Rule: Electron security baseline

- `contextIsolation` must remain enabled; do not set `nodeIntegration: true` in renderer windows.
- Enable sandboxing where compatible with the actual framework and dependencies.
- Expose narrow, typed capabilities through preload/contextBridge; never expose the entire `ipcRenderer`, `fs`, `process`, shell or arbitrary IPC channels.
- Validate IPC sender/frame, channel allowlist, payload schema and authorization for privileged operations.
- Restrict navigation and new-window creation; deny unexpected external navigation and open approved external URLs through a controlled main-process path.
- Use a restrictive Content Security Policy suitable for development/production. Do not add `unsafe-eval` or broad remote origins without documented justification.
- Treat imported VRM paths and any metadata as untrusted input. Use the native file dialog or a narrow file capability and validate size/type before loading.
- Never log credentials, passwords, session cookies, bearer tokens, model keys, or private prompt content by default.
- Do not invent Electron hardening flags. Verify settings against the current Electron version and document exceptions.
