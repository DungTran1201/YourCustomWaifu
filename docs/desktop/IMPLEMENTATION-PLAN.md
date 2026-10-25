# Implementation Plan: YourCustomWaifu Controlled Desktop Restructure

## 1. Outcome and Scope
- **User Outcome**: A desktop-first personal AI companion featuring two decoupled native windows: an extensible, text-focused Workspace and an independent, transparent Avatar Stage floating on the desktop with VRM 3D animation, alongside preserved authentication and account capabilities.
- **In Scope**:
  - Independent lifecycle management for Workspace and Avatar Stage.
  - Three.js + `@pixiv/three-vrm` 3D rendering with procedural fallback mannequin and resource cleanup.
  - Hardened Electron security (`contextIsolation`, `sandbox`, strict CSP, `safeStorage`).
  - Dark graphite design system with text-focused Chatspace, Agent profiles, Skills, Rules, Tools, Memory, Connections, and Avatar Settings.
  - Preserved backend SQLite auth and session persistence.
  - Quality gates: linting, strict TypeScript type checking, unit/lifecycle tests, and production build verification.
- **Out of Scope**:
  - Integrated code editor, terminal console, local CLI or Git/project management UI.
  - Heavy generative neural motion models or training pipelines.
  - Decorative anime art or large character banners inside Chatspace timeline.

## 2. Codebase Facts
- **Packages & Modules**:
  - `frontend/apps/desktop`: Native Electron application.
  - `frontend/apps/web`: Web companion SPA.
  - `frontend/packages/platform-contracts`: Pure TypeScript IPC interfaces.
  - `frontend/packages/app-core`: Reactive state and platform bridges.
  - `frontend/packages/shared`: Universal application metadata and constants.
  - `frontend/packages/ui`: Vue 3 views and design tokens.
  - `backend`: SQLite identity service.
- **Existing Behaviors Preserved**:
  - Instant registration and login without mandatory email verification.
  - Multi-session tracking and logout.
  - Offline-first configuration and local VRM loading via native dialog.

## 3. Architecture & State Ownership
- **Window Lifecycle**: Electron Main process is the source of truth for window existence, visibility, and OS tray/shortcut hooks.
- **Companion State**: Pinia/reactive store in `frontend/packages/app-core/src/store.ts` synchronizes with Main via typed IPC events.
- **Failure Recovery**:
  - Invalid VRM files trigger non-crashing error overlays on Stage with one-click settings navigation.
  - Disconnected displays automatically fallback to primary work area coordinates via `validateWindowBounds`.
  - Click-through mode can be restored at any time via `Ctrl+Shift+M` or the System Tray.

## 4. Implementation Steps
1. [x] **Audit and Safety Checkpoint**: Inspect git status, create safety backup branch `backup/pre-controlled-restructure`, and compile `CODEBASE-AUDIT.md`.
2. [x] **Platform Contracts**: Implement strictly typed `DesktopAPI`, `StageStatus`, `AvatarConfig`, `AgentProfile`, `SkillItem`, `RuleItem`, `ToolItem`, and `IPC_CHANNELS`.
3. [x] **Hardened Main Process**: Configure single-instance lock, `safeStorage` encryption, system tray, global hotkeys, and bounds validation.
4. [x] **Avatar Stage Renderer**: Build transparent WebGL canvas with `@pixiv/three-vrm`, idle animation loop, fallback mannequin, floating controls, and `disposeHierarchy`.
5. [x] **Workspace UI Views**: Implement clean dark theme views for Chat, Agents, Skills, Rules, Tools, Connections, Memory, Avatar Settings, and Security.
6. [x] **Test Harness & Quality Gates**: Add Vitest suites for security invariants, IPC allowlisting, stage lifecycle, bounds validation, and auth flows.
7. [x] **Comprehensive Documentation**: Maintain architecture, lifecycle, security, auth, stage, and testing specs under `docs/desktop/`.

## 5. Acceptance Criteria
- [x] Workspace close does not terminate Avatar Stage.
- [x] Only one Avatar Stage window exists at any time.
- [x] System Tray menu controls both windows independently.
- [x] `Ctrl+Shift+A` toggles Stage visibility; `Ctrl+Shift+M` toggles click-through.
- [x] VRM models load with procedural fallback and proper resource disposal.
- [x] Context isolation, sandboxing, and strict CSP are enforced.
- [x] All 40 unit and lifecycle tests pass.
- [x] All packages pass strict TypeScript typecheck and Prettier formatting.
