# F11 — Application Settings and Diagnostics

## 1. Functional Scope & Purpose
F11 provides application configuration persistence (themes, window bounds, overrides), platform diagnostics, system tray management, and safe logging.

## 2. Current Implementation
- **Configuration Persistence:** `userData/waifu-stage-config.json` stores `avatarConfig`, `workspaceBounds`, and per-avatar model presentation overrides (`avatarOverrides`).
- **Diagnostics API:** `GET_DIAGNOSTICS` IPC channel returns platform (`electron` vs `web`), version, environment, capabilities, OS architecture, and runtime details.
- **Safe Logging:** Telemetry and debug logs strip any potential credential substrings.

## 3. Requirements & Acceptance Criteria
- AC-01: Window bounds must be sanitized against current screen dimensions to prevent off-screen rendering.
- AC-02: Diagnostics must accurately reflect platform capabilities.
- AC-03: Configuration reset must restore defaults safely without destroying the database.
