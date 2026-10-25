# Desktop Window Lifecycle Specification

## 1. State Matrix
The application models the following independent state variables:

| State Variable | Type | Source of Truth | Notes |
|---|---|---|---|
| `workspaceVisible` | `boolean` | `mainWindow.isVisible()` | Managed by Main process |
| `stageVisible` | `boolean` | `stageStatus.stageVisible` | Managed by Main process & broadcast via IPC |
| `stageReady` | `boolean` | `stageStatus.stageReady` | True once WebGL canvas is initialized |
| `avatarLoaded` | `boolean` | `stageStatus.avatarLoaded` | True when a valid VRM model is active |
| `animationPaused` | `boolean` | `avatarConfig.animationPaused` | Controls Three.js animation clock/mixer |
| `clickThrough` | `boolean` | `stageWindow.isIgnoringMouseEvents()` | Toggled via hotkey or toolbar |
| `alwaysOnTop` | `boolean` | `avatarConfig.alwaysOnTop` | Kept above standard desktop applications |
| `isQuitting` | `boolean` | Main process flag | Only set true on explicit Quit action |

## 2. Workspace Lifecycle
- **Creation**: Instantiated at startup or on demand via `createWorkspaceWindow()`.
- **Close Interception**: When the user clicks the `X` button on the Workspace title bar:
  ```ts
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
  ```
  This prevents window destruction and keeps the companion runtime active.
- **Restoration**: Right-clicking the System Tray and selecting **Open Workspace**, or clicking the tray icon directly, unhides and focuses the existing window.

## 3. Avatar Stage Lifecycle
- **Creation**: Instantiated via `createStageWindow()`.
- **Frameless & Transparent**:
  - `frame: false`
  - `transparent: true`
  - `backgroundColor: "#00000000"`
  - `hasShadow: false`
- **Bounds Validation**:
  - Restored bounds are validated against `screen.getAllDisplays()` via `validateWindowBounds()`.
  - If target coordinates are outside visible screens (e.g., disconnected external monitor), the window is safely positioned at the bottom-right of the primary work area.
- **Position & Size Persistence**:
  - `stageWindow.on('resize')` updates `stageWidth` and `stageHeight`.
  - `stageWindow.on('move')` updates `stageX` and `stageY`.
  - Saved to `waifu-stage-config.json` in user data directory.

## 4. System Tray & Global Shortcuts
- **Tray Menu**:
  - Open Workspace
  - Show / Hide Avatar Stage
  - Pause / Resume Animation
  - Avatar Settings
  - Application Settings
  - Quit YourCustomWaifu
- **Global Shortcuts**:
  - `CommandOrControl+Shift+A`: Toggle Avatar Stage visibility.
  - `CommandOrControl+Shift+M`: Toggle Click-Through mode. Allows users to regain interaction if the floating toolbar is unclickable.

## 5. Explicit Quit Procedure
1. Set `isQuitting = true`.
2. Unregister all global shortcuts via `globalShortcut.unregisterAll()`.
3. Destroy the system tray instance.
4. Close all open browser windows.
5. Exit Node.js runtime cleanly via `app.quit()`.
