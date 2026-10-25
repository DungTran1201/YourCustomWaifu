# File & Website Residue Audit

- Date: 2026-10-25
- Repository: `https://github.com/DungTran1201/YourCustomWaifu`
- Target Product: Desktop-only Electron AI Companion (Workspace + Avatar Stage)

## 1. Classification Methodology
- `KEEP`: Strictly required by the Electron desktop application, shared contracts, or project governance.
- `REFACTOR`: Reusable presentation/store components adapted for the Electron renderer environment.
- `REMOVE`: Obsolete website-only components, standalone browser apps, and web deployment workflows.
- `ARCHIVE`: Historical records or reference material kept outside the active runtime.

## 2. Component Disposition Matrix

| Path / Component | Disposition | Category | Rationale & Dependency Trace |
|---|---|---|---|
| `frontend/apps/web/` | **REMOVE** | Standalone Browser SPA | Obsolete web client. The product is an Electron desktop app only. UI tests are migrated to `desktop/tests`. |
| `frontend/apps/desktop/` | **KEEP** | Core Desktop Shell | Electron Main process, Preload bridge, Workspace renderer, and Avatar Stage renderer. |
| `frontend/packages/platform-contracts/` | **KEEP** | Typed Interfaces | Canonical IPC contracts (`DesktopAPI`, `StageStatus`, `AvatarConfig`, `AgentProfile`). |
| `frontend/packages/app-core/` | **KEEP** | State Management | Pinia/reactive companion store, AI configuration, and fallback utilities for testing. |
| `frontend/packages/shared/` | **KEEP** | Shared Constants | App metadata (`YourCustomWaifu`), default settings, and window dimension constants. |
| `frontend/packages/ui/` | **KEEP** | Desktop Design System | Dark graphite tokens and views (Chat, Agents, Skills, Rules, Tools, Memory, Avatar Settings). |
| `backend/` | **KEEP** | Identity & Auth Service | SQLite database with WAL mode, scrypt hashing, and desktop refresh token endpoints. |
| `infra/packaging/windows/` | **KEEP** | Packaging Specification | Native desktop installer and distribution specifications. |
| `.github/workflows/ci.yml` | **REFACTOR** | Continuous Integration | Removed `pnpm build:web` step; retained lint, typecheck, test, and `build:desktop`. |
| `package.json` | **REFACTOR** | Monorepo Scripts | Removed `dev:web` and `build:web`; defaulted `dev` and `build` to desktop pipeline. |

## 3. Technology Distinction Note
In compliance with Section 6 of the reset instructions:
- `index.html`, Vite, Vue 3 Composition API, and CSS design tokens in `frontend/apps/desktop/` and `frontend/packages/ui/` are **legitimate Electron renderer technologies**. They are **not** website residue.
- `createWebFallbackAPI()` in `frontend/packages/app-core/src/platform.ts` is retained as a defensive fallback and headless testing mock (Vitest JSDOM environment).

## 4. Website Residue Scan Summary
- Search Pattern: `frontend/apps/web|website|web-client|landing page|PWA|service worker|Vercel|Netlify|GitHub Pages|apps/web`
- Findings:
  - `frontend/apps/web/`: Removed completely.
  - CI workflow (`ci.yml`): Cleaned of web-build steps.
  - `package.json`: Cleaned of web filter commands.
  - Old architecture docs / diagrams: Classified as historical reference in `docs/` and superseded by `docs/desktop/`.
