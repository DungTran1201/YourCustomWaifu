# .agents — YourCustomWaifu Agent Engineering Kit

This pack is tailored to the YourCustomWaifu desktop application. It is **original project guidance inspired by**, not a verbatim mirror of, the external repositories listed in `SOURCES-AND-LICENSES.md`.

## Contents
- `agents/`: specialist role profiles for Operation Dev reviews.
- `rules/`: always-relevant product, architecture, security and quality constraints.
- `skills/`: task-triggered procedures; each skill has a `SKILL.md` with metadata, triggers, workflow, anti-patterns and a completion checklist.
- `hooks/`: optional, manually wired safety/quality scripts. They are not automatically activated because agent-host hook formats differ.
- `templates/`: ADR, implementation plan, audit and test report templates.
- `SOURCES-AND-LICENSES.md`: upstream references and licensing notes.
- `scripts/validate_agent_pack.py`: basic pack structure validation.

## Suggested loading flow
1. Read root `AGENTS.md` and this file.
2. Read the global rules (product scope, architecture, Electron security, lifecycle, data/auth, quality gates).
3. Select skill(s) based on the task, rather than loading every skill into every prompt.
4. Use specialist role profiles as review checklists or as subagents if supported by the host.
5. Execute verification commands and record truthful results.

## Compatibility
The file and folder layout is intentionally portable. A host may expect `.claude/skills/`, `.codex/skills/`, `.github/agents/`, or another location. Check the coding agent's supported convention before linking/copying these files; do not assume `.agents/` is auto-discovered by every tool.

Each skill follows the common `SKILL.md` pattern with YAML frontmatter (`name`, `description`). Adapt names/paths if the chosen runner has stricter requirements.

## Optional checks
From the repository root, run:

```powershell
python .agents/scripts/validate_agent_pack.py
```

For an actual app change, also run the real project commands from its package manifests; pack validation is not app validation.
