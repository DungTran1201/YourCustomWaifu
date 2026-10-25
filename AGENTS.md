# YourCustomWaifu — Agent Operating Contract

## Product identity
YourCustomWaifu is a desktop-first personal AI companion with two independent windows:
- **Workspace**: conversations, Agent personalization, memory, Skills, Rules, Tools, model connections, avatar settings, account and application settings.
- **Avatar Stage**: a separate transparent/frameless window that loads a user-selected VRM, renders basic animation and may remain visible above ordinary desktop apps after Workspace closes.

The windows share application-level state and runtime where appropriate, but their visibility and lifecycle are independent.

## Start every task this way
1. Read this file, `.agents/README.md`, and applicable rules under `.agents/rules/`.
2. Inspect the current repository, branch, working tree, package scripts, architecture, tests and actual feature state. Do not assume previous reports or generated files reflect the checkout.
3. Select the relevant skills from `.agents/skills/*/SKILL.md`. Load only those needed for the current task and follow their `When to use` guidance.
4. For non-trivial work, write a short implementation plan and identify acceptance tests before editing code.
5. Preserve user work. Never reset, clean, delete, or overwrite unrelated files or uncommitted changes.

## Operation Dev role
Operate as an orchestrator across product analysis, desktop architecture, Vue UI, Electron runtime, VRM rendering, authentication/security, testing and release engineering. Use specialist agent profiles under `.agents/agents/` as review lenses. Spawn subagents only if the host tool genuinely supports them; otherwise perform each review sequentially and report that accurately.

## Product scope
In scope: desktop Workspace, Chat, Agents, Memory, Skills, Rules, Tools, supported AI provider Connections, Avatar Settings, independent VRM Stage, account/auth flows already supported by the repository, system tray, keyboard shortcuts, persistence, diagnostics needed by users, packaging and updates where already planned.

Explicitly out of scope unless the user explicitly changes scope: project management, Git/repository UI, terminal, code editor, local CLI integrations, developer build dashboards, project-specific chat contexts, anime/character artwork inside Chatspace, or a large generative-motion research system.

## Architecture invariants
- Workspace close/hide must not automatically close Stage or stop the shared runtime.
- Hiding Stage must not sign out the user, remove the selected VRM, or terminate the shared runtime.
- Only an explicit application Quit action should shut down the whole app.
- Stage visibility, Workspace visibility, animation pause state, click-through state, and application lifecycle are distinct state variables.
- Exactly one Stage window should exist unless the product explicitly supports multiple stages.
- Renderer processes must not directly access another renderer or unrestricted Node/Electron APIs.
- Keep existing, working registration/login/account behavior unless a migration is specifically justified and tested.
- No secrets, passwords, access tokens, or provider credentials in logs, screenshots, fixtures, or source control.

## Implementation standard
- Follow the repository's actual stack and conventions. Do not impose a framework solely because a skill recommends it.
- Prefer typed contracts, small cohesive modules, predictable state, explicit error states and testable side effects.
- Never add a button that only changes UI state while pretending a native operation happened.
- Validate inputs at trust boundaries, especially IPC, authentication, file import and persisted window bounds.
- Keep dependencies small; verify maintenance state, compatibility and license before adopting one.
- Do not report a command, build, test, runtime behavior or benchmark as successful unless actually executed and observed.

## Required verification
Run the relevant typecheck, lint, unit tests, integration/E2E tests and build commands available in the repository. If a native behavior cannot be automated in the current environment, provide a precise manual test checklist and mark it unverified.

## Required completion report
Summarize: audit findings, files changed, design/architecture decisions, commands and test results, unverified areas, limitations, migration/rollback notes if destructive changes were made, and exact commands to run the app.
