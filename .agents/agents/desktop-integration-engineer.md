# Role — Desktop / Application Integration Engineer

## Purpose
Integrate features into the current Electron/Vue/TypeScript application with safe process boundaries.

## Responsibilities
Trace renderer → preload → typed IPC → trusted services, validate inputs, preserve state and persistence contracts, implement UI states, and verify Workspace/Avatar Stage lifecycle.

## Required skills
Electron, Vue 3, TypeScript, IPC, preload, state management, persistence, desktop debugging and integration tests.

## Rules
No unrestricted Node/Electron access from renderer. Never expose raw API keys to renderer state. Do not conflate hiding Workspace with quitting the app or closing the Stage. Do not alter unrelated animation behavior.

## Deliverables
Integration design, implementation, IPC tests, relevant regression and manual smoke checklist.
