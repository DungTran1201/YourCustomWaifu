# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.3.0] - 2026-10-27

### Added — Operation Dev Feature Completion & Evidence-Based Remediation
- **P0 Master Key Lifecycle & OS Secure Storage**:
  - Eliminated static dev fallback key in `apps/desktop/electron/server/crypto.ts`.
  - Implemented dynamic 256-bit AES master key protected via Electron `safeStorage` (Windows DPAPI / macOS Keychain / Linux Secret Service).
  - Added fail-safe error handling (`SecureStorageUnavailableError`) when secure storage is unavailable without an explicit `KMS_MASTER_KEY` environment variable.
  - Implemented transparent legacy migration for secrets previously encrypted under the development seed.
- **P1 Provider Security & Zero URL Secret Leakage**:
  - Re-architected `GeminiAdapter` to transmit API credentials strictly via standard `x-goog-api-key` HTTP header.
  - Completely stripped `?key=` query parameters from all model discovery and chat generation URLs.
- **P1 Shared Contract & IPC Invariant Wiring**:
  - Wired `STAGE_GET_BLINK_DIAGNOSTIC` across platform contracts, preload contextBridge, Electron main IPC handlers, and web fallbacks.
- **P1 Store Consistency & Optimistic Rollback**:
  - Replaced error-suppressing catch blocks with snapshot-based rollbacks across all Agent, Skill, Rule, Tool, and Memory mutations in `store.ts`.
  - Added actionable error notifications and state restoration upon network or backend failure.
- **P1 Provider Timeout, Cancellation & Error Normalization**:
  - Implemented 30-second default request deadlines via `AbortController` and client disconnect cancellation (`req.on("close")`).
  - Normalized provider errors into structured HTTP status codes (504 timeout, 429 rate limit, 401 provider auth error).
- **P1 Closed-Loop Model Tool Execution Loop**:
  - Implemented structured tool-call detection, argument validation via `ToolExecutor`, permission/confirmation enforcement, and bounded conversational synthesis follow-up.
- **Auditing, Architecture Diagrams & Test Suites**:
  - Authored comprehensive audit artifacts in `docs/audit/` and modular functional specifications in `docs/modules/` (F01–F12).
  - Authored Mermaid sequence and architecture diagrams in `diagrams/`.
  - Added automated regression test suites (`crypto-security.spec.ts`, `store-rollback.spec.ts`, `provider-security-tool-loop.spec.ts`), expanding test coverage to 26 test suites and 218 passing tests.

## [0.2.0] - 2026-10-25

### Changed — Operation Dev Desktop-Only Hard Reset
- **Restructured Monorepo to Electron Desktop-Only Architecture**:
  - Consolidated application under canonical `apps/desktop/` containing Electron Main, Preload, Workspace Renderer, Avatar Stage Renderer, embedded SQLite auth service, and comprehensive test suites.
  - Migrated shared type contracts and application constants into `packages/platform-contracts/` and `packages/shared/`.
  - Permanently removed legacy root directories `frontend/`, `backend/`, and `infra/`.
  - Embedded local identity and authentication service powered by `node:sqlite` directly into Electron Main runtime, eliminating separate server processes.
  - Validated independent Workspace and Avatar Stage lifecycles, bounds preservation, `safeStorage` session token encryption, and Three.js VRM rendering.

## [0.1.0] - 2026-10-22

### Changed — Comprehensive Repository Reset
- **Purged Legacy Experimental Code**:
  - Removed `exp/` experimental workspace entirely (ARDY, MotionStreamer, DiP, MotionBricks, PyTorch, CUDA runtime, and checkpoints).
  - Backed up all uncommitted blueprints (`VRM-StreamLite-Blueprint.md`) and research artifacts to external location `C:\Users\PC\Project\VRMMotionGeneration_pre_reset_backup_20261022` and `E:\VRMMotionGeneration_pre_reset_backup_20261022`.
  - Retired kinematics, humanoid skeleton retargeting, and model training pipelines.
- **Transformed Architecture to Web + Electron Foundation**:
  - Established unified pnpm workspace monorepo.
  - Implemented `@vrm/platform-contracts`: pure TypeScript definitions for IPC, diagnostics, and capabilities.
  - Implemented `@vrm/shared`: application metadata, constants, and formatting utilities.
  - Implemented `@vrm/app-core`: runtime platform detection, fallback capability adapter, and reactive Vue store.
  - Implemented `@vrm/ui`: shared Vue 3 components, views (Overview, Settings, Diagnostics), design tokens (`tokens.css`), and responsive layouts (`ShellLayout`).
  - Implemented `@vrm/web`: browser client application built with Vite 6.
  - Implemented `@vrm/desktop`: hardened Electron 34+ desktop shell with contextBridge, OS sandbox, disabled nodeIntegration, and strict CSP.
- **Redesigned Agent Harness (`.agents/` and `AGENTS.md`)**:
  - Authored new `AGENTS.md` operating contract for Operation Dev.
  - Added 10 specialized agent personas in `.agents/agents/`.
  - Added 9 mandatory engineering rules in `.agents/rules/`.
  - Added 11 actionable, runbook-backed skills in `.agents/skills/`.
  - Added 4 multi-step workflows in `.agents/workflows/`.
  - Added standard engineering templates and policies.
  - Documented skill provenance, licensing, and attribution in `.agents/skill-sources.md`.
- **Adopted `schemas/`**:
  - Created machine-readable JSON Schema definitions (`desktop-ipc.schema.json`, `system-diagnostics.schema.json`, `app-settings.schema.json`).
- **Added Automated Quality Gates & CI**:
  - Configured GitHub Actions workflow (`.github/workflows/ci.yml`).
  - Added Vitest unit, contract, and component test suites.
