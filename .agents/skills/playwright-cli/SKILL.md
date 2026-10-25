---
name: playwright-cli
description: Playwright CLI and UI exploration. Use for tasks matching this capability in the YourCustomWaifu desktop app.
---

# Playwright UI exploration and test assistance

Use when the project has a web frontend or browser-testable renderer and Playwright is installed/approved.

## Workflow
1. Check whether Playwright and `playwright-cli` exist before invoking install commands.
2. Inspect `--help` and project conventions; do not install packages globally without need.
3. Use the tool to inspect visible UI, capture states, verify navigation and generate candidate tests.
4. Prefer accessible roles/names and stable test IDs over brittle CSS selectors.
5. Capture trace, screenshot or video only when it materially helps diagnose a failure; avoid including private account data.
6. Validate generated tests and remove exploratory scripts/temporary artifacts unless they are useful to the project.

## Boundaries
Browser automation cannot prove Electron always-on-top, OS tray behavior, global shortcuts or native click-through. Use Electron-aware automation where configured and a manual Windows checklist for platform-specific behavior.
