---
name: desktop-window-lifecycle
description: YourCustomWaifu desktop window lifecycle. Use for tasks matching this capability in the YourCustomWaifu desktop app.
---

# Desktop window lifecycle contract

Use for any change involving app startup/quit, close buttons, Stage visibility, tray, global shortcut, single-instance lock or persistent window geometry.

## Canonical state
At minimum model independently:
- app lifecycle: `starting | running | quitting | stopped`
- Workspace: `uncreated | visible | hidden | closed`
- Stage: `uncreated | visible | hidden | closed | error`
- animation: `running | paused`
- pointer mode: `interactive | click-through`
- runtime: `starting | ready | busy | degraded | stopped`

Adapt the names to actual code while preserving the distinctions.

## Operations should be idempotent
- `openWorkspace`: focus existing or create one.
- `closeWorkspace`: follow product policy; do not quit application.
- `showStage`: show existing or create once.
- `hideStage`: hide only Stage.
- `toggleClickThrough`: update native property and synchronized state.
- `quitApplication`: set quitting guard, stop tasks safely, remove shortcuts/listeners, close windows and release runtime resources.

## System tray
Tray menu labels should reflect actual state. All Stage controls must remain functional while Workspace is absent. Do not remove the tray when the last normal window closes if Stage is supposed to remain available.

## Geometry
Persist only sane bounds. Before restoring, intersect bounds with current display work areas and fall back to the primary display when no visible intersection exists.

## Required tests
Close Workspace while Stage is visible; reopen Workspace; repeated show/hide; hide with click-through; tray show; shortcut conflict; disconnect a monitor; explicit quit; recreate Stage after failure.
