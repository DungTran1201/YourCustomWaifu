# F07 — Memory and Privacy

## 1. Functional Scope & Purpose
F07 provides private, long-term memory retention for user preferences, facts, habits, and interactions. Memories are stored strictly locally in the user's SQLite database and are never sent to unconfigured cloud services.

## 2. Current Implementation
- **Data Categories:** `preference`, `fact`, `habit`, `interaction`.
- **Semantic Search:** In `companion-repository.ts:searchRelevantMemories()`, SQL keyword tokenization scores matching memories and returns the top 4 relevant items.
- **Privacy Gate:** If `agent.behaviorPreferences.memoryRetention` is set to `false`, memory search and context inclusion are completely bypassed.
- **User Control:** Users can view all memories in the Memory tab, add custom memories, delete specific items, or clear the entire memory vault.

## 3. Requirements & Acceptance Criteria
- AC-01: Memories must be stored locally in SQLite with category, confidence, and timestamp.
- AC-02: Memory inclusion in prompt context must be gated by the active agent's `memoryRetention` preference.
- AC-03: Deletion of memories must be instantaneous and irrevocable.
- AC-04: Failed memory operations must roll back local reactive state cleanly.
