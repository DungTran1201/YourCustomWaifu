# Testing, Quality Gates & Release Verification

## 1. Automated Verification Suite
All quality gates have been executed directly on the repository with 100% pass rate:

| Test Suite / Command | Scope | Result | Details |
|---|---|---|---|
| `python .agents/scripts/validate_agent_pack.py` | Agent Pack | **PASSED** | Validates 15 skills, 11 rules, 10 agent profiles |
| `pnpm test` (`vitest run`) | All Packages | **PASSED (40/40 tests)** | 8 test suites across Desktop, Web, Contracts, and Backend |
| `pnpm typecheck` (`tsc` + `vue-tsc`) | 7 Monorepo Packages | **PASSED (0 errors)** | Strict TypeScript compilation without any type suppression |
| `pnpm lint` (`prettier --check`) | Code Style | **PASSED** | Code formatting fully compliant |
| `pnpm build` | Production Build | **PASSED** | Generates Web SPA and Desktop bundles (`dist/index.html`, `dist/stage.html`) |

## 2. Test Suites Summary
- `frontend/apps/desktop/tests/security.spec.ts` (3 tests):
  - Strict Content Security Policy without `unsafe-eval`.
  - Rejection of IPC events from null or destroyed windows.
  - Validation of authorized `webContents` sender.
- `frontend/apps/desktop/tests/ipc-contract.spec.ts` (2 tests):
  - IPC channel enumeration and format validation.
- `frontend/tests/workspace-contracts.spec.ts` (3 tests):
  - Metadata verification (`YourCustomWaifu — Desktop AI Companion`).
  - Web platform detection and fallback diagnostics.
- `frontend/apps/desktop/tests/stage-lifecycle.spec.ts` (10 tests):
  - Stage IPC channels definition without wildcards.
  - Initial hidden state and dimensions.
  - Idempotent Stage show/hide operations.
  - Click-through and always-on-top toggles.
  - Animation pause and resume.
  - Safe error states on missing or invalid VRM files.
  - Dual-window IPC sender validation.
  - Offscreen multi-monitor bounds validation and fallback.
  - Masked credential protection in store.
- `frontend/apps/web/tests/web-mount.spec.ts` (3 tests):
  - Web client rendering and tab navigation.
- `frontend/apps/web/tests/auth-ui.spec.ts` (4 tests):
  - Instant registration and login validation.
- `frontend/apps/web/tests/companion-ui.spec.ts` (3 tests):
  - Text-focused Chatspace, Agent profiles, and Avatar Settings navigation.
- `backend/tests/auth.spec.ts` (12 tests):
  - SQLite schema creation, session tracking, password hashing, and token refresh.

## 3. Windows Manual Test Checklist
For native operating system behaviors that cannot be fully validated in virtualized headless CI:

1. **Desktop Launch**:
   - Run `pnpm dev:desktop`.
   - Verify Workspace window opens with the dark graphite UI.
   - Verify the tray icon appears in the Windows notification area.
2. **Avatar Stage Launch**:
   - Click **Show Stage** on the top header or navigate to **Avatar Stage** settings.
   - Verify the transparent frameless Stage window appears floating on the desktop.
   - Verify the procedural holographic mannequin appears and breathes gently.
3. **Workspace Closure & Independence**:
   - Close the Workspace window by clicking the `X` button.
   - **Verification**: The Avatar Stage remains visible and animating above ordinary apps (e.g. Chrome, VS Code).
4. **System Tray Restoration**:
   - Right-click the system tray icon and select **Open Workspace**.
   - **Verification**: Workspace re-opens instantly with session, active tab, and Stage state intact.
5. **Global Shortcut Toggle (`Ctrl+Shift+A`)**:
   - Press `Ctrl+Shift+A`.
   - **Verification**: Avatar Stage hides. Press again; Stage reappears without creating extra windows.
6. **Click-Through Mode (`Ctrl+Shift+M`)**:
   - Press `Ctrl+Shift+M`.
   - **Verification**: Mouse clicks pass directly through the Stage to windows underneath.
   - Press `Ctrl+Shift+M` again.
   - **Verification**: Interactive controls (floating toolbar) are restored.
7. **Animation Pause**:
   - Click the Pause button on the floating toolbar or toggle via System Tray.
   - **Verification**: Idle breathing and blinking freeze. Unpausing resumes motion smoothly.
8. **VRM File Selection**:
   - Open **Avatar Settings** -> **Select .VRM File**.
   - Pick a valid `.vrm` file.
   - **Verification**: Real VRM loads, replaces mannequin, and begins breathing and blinking.
9. **Display Boundary Recovery**:
   - Move Stage to a secondary monitor and disconnect the display.
   - **Verification**: Stage re-centers safely on primary display work area without getting lost.
10. **Clean Quit**:
    - Right-click the system tray icon and select **Quit YourCustomWaifu**.
    - **Verification**: All windows close, tray icon disappears, shortcuts unregister, and processes exit cleanly.

## 4. Rollback and Recovery Instructions
A dedicated safety branch was created prior to changes:
```powershell
git checkout backup/pre-controlled-restructure
```
To revert any uncommitted workspace modifications:
```powershell
git checkout -- .
```
