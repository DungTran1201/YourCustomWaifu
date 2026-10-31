# F05 — Agent and Persona

## 1. Functional Scope & Purpose
F05 defines companion identity, conversational personality, system instructions, and associations with specific models, skills, rules, and tools. Users can configure multiple personas (e.g. Aiko) and select the active companion.

## 2. Current Implementation
- **Data Model:** `AgentProfile` interface in `@vrm/platform-contracts`.
- **Default Persona:** "Aiko" — personal desktop AI companion (warm, perceptive, supportive).
- **Association:** In SQLite, `agent_skills` and `agent_tools` join tables link capabilities to specific agents. `rules.applicable_agent_id` scopes rules.
- **Active Selection:** `POST /api/v1/agents/:id/active` updates the active agent in `companion-repository.ts`.

## 3. Requirements & Acceptance Criteria
- AC-01: An active agent must always be designated.
- AC-02: Persona attributes (name, personality, conversationalStyle, systemInstructions) must be formatted into the system prompt root.
- AC-03: Switching active agent must immediately alter system prompt context for subsequent chat turns.
- AC-04: Failed agent updates must roll back store state cleanly.
