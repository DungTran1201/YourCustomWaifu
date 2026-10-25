# Codebase Audit: YourCustomWaifu Desktop Foundation

- Date: 2026-10-25
- Branch: `chore/web-electron-foundation-reset`
- Commit HEAD: `c46a11aaf0f4a8277de6cc315e06402dfa453679`
- Safety Backup: Branch `backup/pre-controlled-restructure`

## 1. Repository State & Runtime Environment
- Runtime: Node.js v24.18.0, pnpm v12.14.0
- Monorepo structure: pnpm workspaces (`frontend/apps/*`, `frontend/packages/*`, `backend`)
- Target stack: Electron 34+, Vue 3 Composition API (`<script setup lang="ts">`), TypeScript 5.7+ (strict mode), Three.js 0.173+, `@pixiv/three-vrm` 2.1+, SQLite DatabaseSync (WAL mode)

## 2. Architecture Discovered
- **Electron Main Process (`frontend/apps/desktop/src/main/`)**:
  - `index.ts`: Owns application lifecycle, native `BrowserWindow` creation, single-instance lock, system tray, global shortcuts (`Ctrl+Shift+A`, `Ctrl+Shift+M`), encrypted session storage (`safeStorage`), and typed IPC handlers.
  - `security.ts`: Hardened CSP headers (`default-src 'self'`, `script-src 'self'`), sender validation (`validateIpcSender`), window navigation prevention, and `shell.openExternal`.
  - `bounds.ts`: Display boundary validation (`validateWindowBounds`) preventing offscreen positioning when external displays are disconnected.
- **Preload Bridge (`frontend/apps/desktop/src/preload/`)**:
  - `index.ts`: Strictly scoped contextBridge exposing `window.desktopAPI` with typed sub-APIs (`stage`, `workspace`, `auth`).
  - `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- **Workspace Renderer (`frontend/apps/desktop/src/renderer/index.html` & `frontend/packages/ui`)**:
  - Desktop companion workspace with clean dark theme (graphite/black).
  - Chatspace text-focused without anime artwork or avatar banners in timeline.
  - Companion personalization: Agents, Skills, Rules, Tools, Model Connections, Memory, Avatar Settings, Security, Account, Diagnostics.
- **Avatar Stage Renderer (`frontend/apps/desktop/src/renderer/stage.html` & `stage-main.ts`)**:
  - Independent transparent frameless window (`frame: false`, `transparent: true`).
  - WebGL Three.js canvas with alpha rendering.
  - Procedural holographic mannequin fallback for instant visual feedback.
  - Three.js `@pixiv/three-vrm` loader with subtle idle motions (spine breathing, head sway, blinking).
  - Floating controls: scaling, Always-on-Top, Click-Through, Pause/Resume, Hide Stage, Open Workspace.
  - Resource disposal (`disposeHierarchy`) releasing geometries, materials, and textures on unload.
- **Shared Contracts & State (`frontend/packages/platform-contracts`, `app-core`, `shared`)**:
  - Typed IPC channels (`IPC_CHANNELS`) without wildcards.
  - Universal reactive store (`store.ts`) and platform detection (`platform.ts`) with browser fallback (`createWebFallbackAPI()`).
- **Backend & Identity Server (`backend/src/`)**:
  - Node native HTTP server + SQLite (`vrm.db`) with WAL mode.
  - Session tracking, password hashing (`scrypt`), rate limiting, and desktop token refresh (`/api/v1/auth/desktop-refresh`).

## 3. Feature Truth Table

| Feature | Implemented | Evidence / Test | Missing Work / Gaps |
|---|---|---|---|
| Independent 2-Window Architecture | Yes | `stage-lifecycle.spec.ts`, `main/index.ts` | Fully implemented |
| Workspace close does not close Stage | Yes | `mainWindow.on('close')` hides window; Stage survives | Verified in lifecycle tests |
| Single Stage Instance Guarantee | Yes | `createStageWindow()` reuses existing instance | Verified in `stage-lifecycle.spec.ts` |
| System Tray & Menu Actions | Yes | `createSystemTray()`, `updateTrayMenu()` in `main/index.ts` | Native tray manual test |
| Global Shortcuts (`Ctrl+Shift+A`, `Ctrl+Shift+M`) | Yes | `registerGlobalShortcuts()` in `main/index.ts` | Native OS test |
| VRM 3D Rendering & Idle Motion | Yes | `stage-main.ts` with Three.js & `@pixiv/three-vrm` | Native rendering manual test |
| Procedural Fallback Mannequin | Yes | `setupFallbackMannequin()` in `stage-main.ts` | Complete |
| Safe Resource Disposal | Yes | `disposeHierarchy()` in `stage-main.ts` | Complete |
| Click-Through Mode & Recovery | Yes | `stageWindow.setIgnoreMouseEvents()`, hotkey & tray | Verified in unit tests & native checklist |
| Always On Top Mode | Yes | `stageWindow.setAlwaysOnTop()`, toolbar & setting | Complete |
| Safe Multi-Monitor Bounds Validation | Yes | `bounds.ts`, `validateWindowBounds` | Verified in `stage-lifecycle.spec.ts` |
| Preserved Auth & SQLite Session | Yes | `backend/tests/auth.spec.ts`, `safeStorage` | 12 tests passed |
| Strict Electron Security Baseline | Yes | `security.spec.ts`, `contextIsolation`, strict CSP | 3 tests passed |
| Clean Text-Focused Chatspace | Yes | `ChatView.vue` (no anime banners in timeline) | Complete |
| Masked Credential Storage | Yes | Key hint masking in store and test assertion | Verified in `stage-lifecycle.spec.ts` |

## 4. File Disposition Inventory

| Path / Subtree | Disposition | Evidence / Justification | Risk / Rollback |
|---|---|---|---|
| `frontend/apps/desktop/` | **KEEP** | Core Electron desktop shell, main process, preload, stage window | Low / Active |
| `frontend/apps/web/` | **KEEP** | Browser companion SPA client with web fallbacks | Low / Active |
| `frontend/packages/platform-contracts/` | **KEEP** | Canonical typed contracts between Electron and Vue | Low / Active |
| `frontend/packages/app-core/` | **KEEP** | State management, platform detection, and companion stores | Low / Active |
| `frontend/packages/shared/` | **KEEP** | Application metadata, defaults, and shared constants | Low / Active |
| `frontend/packages/ui/` | **KEEP** | Dark design tokens and view components | Low / Active |
| `backend/` | **KEEP** | Authentication and relational database service | Low / Active |
| `.agents/` | **KEEP** | Operational engineering kit (15 skills, 11 rules, 10 agents) | Low / Validated |
| Old motion research / ARDY / DiP / PyTorch | **REMOVED** | Purged in architectural reset; no dependencies remain | Zero risk |

## 5. Risks and Safeguards
- **Native OS window behavior**: While unit tests validate IPC contracts and lifecycle states, actual window transparency and click-through rely on the Windows Desktop Window Manager (DWM). A manual verification checklist is maintained.
- **Display unplugging**: Validated by `bounds.ts` unit tests ensuring windows never get stranded offscreen.
