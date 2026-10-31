# F04 — Skills and Rules

## 1. Functional Scope & Purpose
F04 enables customization of companion behavior through modular Skills (capabilities, routines, workflows) and Rules (behavioral constraints, priority ordering). Enabled skills and rules are dynamically synthesized into the AI model's system prompt.

## 2. Current Implementation & Confirmed Defect Status
- **Persistence:** SQLite tables `skills`, `agent_skills`, and `rules` in `companion-repository.ts`.
- **System Prompt Composition:** In `server.ts:684-702`, enabled rules are sorted by priority and formatted under `Operational Rules to obey:`. Enabled skills linked to the active agent are formatted under `Active Skills:`.
- **Defect P1 (Remediated):** Formerly, Vue store functions (`addSkill`, `updateSkill`, `deleteSkill`, `addRule`, `updateRule`, `deleteRule`) performed optimistic updates with empty catch blocks. Remediated with snapshot-based state rollback on network or server error and explicit error message propagation.

## 3. Requirements & Acceptance Criteria
- AC-01: Skills and Rules must support full CRUD operations.
- AC-02: Only enabled skills and rules matching the active agent (or scoped globally) must be included in LLM context.
- AC-03: Rule priority ordering must be respected deterministically in prompt assembly.
- AC-04: Failed write operations must roll back optimistic UI mutations and notify the user.
