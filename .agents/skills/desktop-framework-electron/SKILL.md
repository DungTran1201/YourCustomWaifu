---
name: desktop-framework-electron
description: Electron native APIs, IPC and packaging security. Use for tasks matching this capability in the YourCustomWaifu desktop app.
---

# Electron framework and secure native APIs

Use for IPC channels, file dialogs, global shortcuts, system tray, transparent windows, app packaging and OS integrations.

## Procedure
1. Inspect current Electron docs for the pinned runtime version before relying on version-sensitive APIs.
2. Define an allowlisted, typed API in preload using `contextBridge.exposeInMainWorld`.
3. Validate message schema and sender frame in Main. Do not expose a generic `send(channel, payload)` API to untrusted renderer code.
4. For file selection, prefer a Main-process dialog and return only the minimum metadata needed; use an explicit asset-access strategy for loading the selected file.
5. For external links, validate URL scheme/host and open through a controlled method.
6. For global shortcuts, handle registration failure and unregister on shutdown.
7. For tray, make each callback idempotent and make Quit semantics explicit.
8. Test the packaged artifact and Windows path handling, especially spaces and non-ASCII characters.

## Transparency and click-through
- Configure transparent and frameless window options according to the target platform and renderer stack.
- Test alpha rendering on the real OS; transparency requires both native window configuration and a renderer with an appropriate transparent background.
- Implement click-through toggle in Main and provide a guaranteed recovery route (tray/shortcut).
- Do not assume click-through behavior is identical across Windows, macOS and Linux.

## Completion checklist
Security settings, sender checks, type checks, external navigation policy, file import behavior and packaged smoke test are documented.
