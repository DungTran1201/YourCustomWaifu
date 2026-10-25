---
name: electron
description: Electron desktop application foundations. Use for tasks matching this capability in the YourCustomWaifu desktop app.
---

# Electron foundations workflow

Use this skill for Electron architecture changes, app startup, preload, native capabilities, packaging, or process boundaries.

## Workflow
1. Inspect Electron version, builder/toolchain, existing main/preload/renderers and current security preferences.
2. Keep privileged OS and filesystem operations in Main or narrowly scoped services; renderer UI should call typed capabilities only.
3. Use `BrowserWindow` for independent full-window surfaces such as Workspace and Stage unless the existing architecture justifies another view abstraction.
4. Keep dev and packaged resource paths explicit; do not assume `process.cwd()` equals the app root in production.
5. Handle app readiness, single-instance behavior, window creation failures, app activation, tray lifecycle and orderly shutdown.
6. For packaged builds, test the paths/assets and native dependencies from the packaged artifact, not only Vite dev mode.

## Security checklist
- `contextIsolation: true`.
- `nodeIntegration: false`.
- Sandbox enabled where compatible and tested.
- Narrow `contextBridge` methods and typed request/response contracts.
- Sender/payload validation for IPC.
- Restrictive CSP and controlled navigation.
- No secrets in renderer bundles or logs.

## Avoid
- Exposing full `ipcRenderer` or Node APIs.
- Creating native windows from renderer code.
- Treating a successful dev server as proof the packaged app works.
- Upgrading Electron or builder toolchains as unrelated cleanup.

## Completion checklist
- Startup and close behaviors verified.
- Security preferences inspected in actual created windows.
- Dev and production resource paths tested or clearly marked unverified.
- Relevant unit/build/packaging checks reported.

## References
See `.agents/SOURCES-AND-LICENSES.md` for upstream Electron skill and official documentation links.
