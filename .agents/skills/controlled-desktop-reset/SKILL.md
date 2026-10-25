---
name: controlled-desktop-reset
description: Safe reset from web/research scaffold to desktop app. Use for tasks matching this capability in the YourCustomWaifu desktop app.
---

# Controlled desktop reset procedure

Use only when the task explicitly requests a major structural rebuild or legacy removal.

## Phase 0: protect work
1. Inspect branch, HEAD, working tree, untracked/ignored files and Git remotes.
2. Locate auth/account APIs, migrations, user data, env templates, VRM assets, reusable UI, tests and release config.
3. Verify user changes that have not been committed/pushed. Do not discard them.
4. Make a KEEP / REFACTOR / REMOVE / ARCHIVE matrix with dependency evidence.

## Phase 1: define target boundaries
- Preserve or migrate authentication only after tracing dependencies and testing.
- Separate desktop Main, Preload, Workspace renderer, Stage renderer and shared contracts/runtime according to the real stack.
- Keep experimental motion-research code outside the runtime path; remove only after proving it is not a dependency and preserving required history/data.
- Do not retain project/Git/CLI interface features unless explicitly re-requested.

## Phase 2: staged migration
1. Add a minimal compilable shell and smoke test.
2. Move or retire one bounded subsystem at a time.
3. Run tests/build after each milestone.
4. Update package scripts, docs, env example and CI together.
5. Review diff for secrets, accidental mass deletion and stale imports.

## Phase 3: clean finish
- Remove truly dead code only after import/reference checks and tests.
- Update architecture docs and setup steps.
- Provide migration/rollback details and list retained legacy areas.

## Forbidden shortcuts
- `git reset --hard`, `git clean -xfd`, force-push, or recursive deletion without explicit narrow confirmation.
- Deleting databases/migrations, auth logic, user avatars or environment templates simply because they look legacy.
- Replacing live APIs with mocks to make UI appear complete.
