# Rule: Repository and destructive-change safety

- Inspect `git status --short`, current branch, HEAD, package manifests and relevant file history before large changes.
- Never run `git reset --hard`, `git clean -xfd`, force push, or mass deletion as a default cleanup step.
- Never overwrite an existing root `AGENTS.md`, `.agents/`, auth service, database, migrations, secrets configuration or user data without inspecting it and creating a recoverable plan.
- Before removing legacy code, classify files as KEEP / REFACTOR / REMOVE / ARCHIVE with reasons and known dependency links.
- Prefer reversible moves or a dedicated branch/commit over permanent deletion when the user asks for a rebuild.
- Do not place generated databases, private keys, access tokens, local `.env` files or user VRM assets in Git.
- If a current checkout differs from documented assumptions, trust inspected code and report the discrepancy.
