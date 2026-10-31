# Repository Audit — YourCustomWaifu Desktop Companion

**Audit Date:** 2026-10-27  
**Auditor:** Operation Dev Orchestrator  
**Repository:** [https://github.com/DungTran1201/YourCustomWaifu](https://github.com/DungTran1201/YourCustomWaifu)  
**Branch:** `main` (clean working tree, verified via `git status --short`)  

---

## 1. Executive Summary

YourCustomWaifu is an advanced desktop-first personal AI companion combining:
1. **Workspace Window**: Vue 3 + TypeScript client managing chat, agent personas, skills, rules, tools, memories, provider connections, and desktop application settings.
2. **Avatar Stage Window**: Independent transparent frameless Electron window rendering 3D VRM avatars with real-time LookAt gaze tracking, physics, and autonomic blinking.
3. **Embedded Backend Server**: Secure Node.js HTTP server running SQLite (`DatabaseSync`), scrypt password hashing, AES-256-GCM encrypted provider secrets vault, and model provider routing.

This audit establishes the baseline evidence before executing documentation-driven refactoring and defect remediation.

---

## 2. Architecture & Entry Points

### 2.1 Workspace & Desktop App Entry Points
- **Root Package:** `package.json` (pnpm workspace with `@vrm/desktop`, `@vrm/platform-contracts`, `@vrm/shared`).
- **Desktop Electron Main Process:** `apps/desktop/electron/main/index.ts`
  - Manages dual window lifecycles (`mainWindow` and `stageWindow`).
  - Implements tray menu, global shortcuts (`Ctrl+Shift+W`, `Ctrl+Shift+A`, `Ctrl+Shift+B`), and window bounds preservation.
  - Spawns embedded backend HTTP server on loopback `127.0.0.1:3000` (with dynamic fallback on conflict).
- **Electron Preload Bridge:** `apps/desktop/electron/preload/index.ts`
  - Exposes `window.desktopAPI` via Electron `contextBridge`.
  - Implements strict validation of IPC sender window identity.
- **Renderer Frontend:** `apps/desktop/src/main.ts` and `apps/desktop/src/App.vue`
  - Vue 3 Composition API with reactive store (`apps/desktop/src/stores/store.ts`).
  - Dynamic tabs: Chat, Agents, Skills, Rules, Tools, Connections, Memory, Avatar, Profile, Security, Secrets, Settings, Diagnostics.
- **Avatar Stage Renderer:** `apps/desktop/src/stage.ts` and `apps/desktop/stage.html`
  - Three.js + `@pixiv/three-vrm` rendering pipeline.
  - Implements 7-stage avatar preparation pipeline: validation, orientation normalization, A-pose stabilization, bounding-box auto-scaling, look-at gaze binding, expression discovery, and scene attachment.
  - Autonomous blinking controller (`VRMBlinkController`) with state machine (`Open` -> `Closing` -> `Closed` -> `Opening`).

---

## 3. Baseline Audit Classifications

| Module | Classification | Status Rationale & Evidence |
| :--- | :--- | :--- |
| **F01 Account & Security** | `VERIFIED` | Full scrypt hashing, rate limiting, session tokens, CSRF tokens, unit/integration tested (19 tests passing in `auth.spec.ts`). |
| **F02 Provider Connections** | `PARTIALLY_IMPLEMENTED` | Secure envelope encryption exists, but P0 fixed fallback in `crypto.ts` and P1 Gemini key in URL query parameter confirmed. |
| **F03 Model Catalog & Params** | `VERIFIED` | Catalogs for Gemini (`gemini-2.5-flash`, `gemini-2.5-pro`), OpenAI (`gpt-4o`, `gpt-4o-mini`), and Anthropic (`claude-3-5-sonnet`) supported. |
| **F04 Skills & Rules** | `PARTIALLY_IMPLEMENTED` | SQLite CRUD and system prompt composition verified; store mutations had error suppression without rollback. |
| **F05 Agent & Persona** | `VERIFIED` | Active agent selection, system instructions, personality, and associated skills/rules/tools correctly composited into prompt. |
| **F06 Chat & Conversation** | `PARTIALLY_IMPLEMENTED` | End-to-end LLM chat request/response works, but lacks request timeout/cancellation deadlines and provider error normalization. |
| **F07 Memory & Privacy** | `VERIFIED` | Private local memory vault with categorization, SQLite search, and selective prompt inclusion verified (`companion-memory.spec.ts`). |
| **F08 Tools & Permissions** | `PARTIALLY_IMPLEMENTED` | ToolExecutor with validation and schema works; model chat path lacks closed-loop tool invocation orchestration. |
| **F09 Files & Attachments** | `PARTIALLY_IMPLEMENTED` | VRM file import/loading verified; general chat document attachments not yet exposed to chat interface. |
| **F10 Avatar & Stage** | `VERIFIED` | Multi-window independent lifecycle, Three.js VRM rendering, LookAt gaze tracking, and autonomic blinking fully verified with visual tests. |
| **F11 App Settings & Diag** | `VERIFIED` | Diagnostics API, settings persistence, theme switching, and safe logging verified. |
| **F12 Integration & Eval** | `VERIFIED` | Deterministic offline AI evaluation suite in `ai-evaluation-suite.spec.ts` verifies 12-message history bounds and prompt composition. |

---

## 4. Confirmed Defects & Remediation Targets

1. **P0: Insecure Key Fallback in `crypto.ts`**
   - *File:* `apps/desktop/electron/server/crypto.ts:74-79`
   - *Issue:* Static dev seed `"default-vrm-kms-master-key-dev-seed-32bytes!"` used when `KMS_MASTER_KEY` unset.
   - *Remediation:* Implement OS-backed secure storage (`safeStorage` on Electron) with random key generation, fail-safe behavior when unavailable, and legacy ciphertext migration.
2. **P1: API Key Transmission in URL Query Parameter**
   - *File:* `apps/desktop/electron/server/provider-adapters.ts:60,119`
   - *Issue:* Gemini adapter sends `?key=` in URL query string.
   - *Remediation:* Use Google's standard `x-goog-api-key` HTTP header; strip secrets from URLs.
3. **P1: Shared Contract & IPC Incompleteness**
   - *File:* `packages/platform-contracts/src/index.ts`, `apps/desktop/electron/preload/index.ts`, `apps/desktop/electron/main/index.ts`
   - *Issue:* `STAGE_GET_BLINK_DIAGNOSTIC` defined in contracts but omitted in preload and main handlers.
   - *Remediation:* Wire `getBlinkDiagnostic` across preload, main IPC handler, and platform fallback.
4. **P1: Store Optimistic Updates Error Suppression**
   - *File:* `apps/desktop/src/stores/store.ts`
   - *Issue:* Catch blocks on skill, rule, agent, tool, and memory mutations suppress errors without rolling back state.
   - *Remediation:* Implement state rollback on failure and surface actionable error notifications.
5. **P1: Provider Timeout, Cancellation & Error Normalization**
   - *File:* `apps/desktop/electron/server/server.ts:778-815`
   - *Issue:* Chat completions lack finite request deadlines and client disconnect handling.
   - *Remediation:* Add `AbortController` timeout (30s default), client close abortion, and normalized HTTP status codes (504 timeout, 429 rate limit, 401 auth error).
6. **P1: Model Tool Calling Loop**
   - *File:* `apps/desktop/electron/server/server.ts:720-763`
   - *Issue:* Tools are described in prompt but model tool invocations are not parsed or executed in a follow-up loop.
   - *Remediation:* Implement structured tool call parsing, execution via `ToolExecutor`, authorization checks, and bounded synthesis loop.
