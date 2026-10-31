import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useAppStore } from "../src/stores/store.js";

describe("P1 Store: State Consistency & Optimistic Rollback on Persistence Failure", () => {
  let store: ReturnType<typeof useAppStore>;

  beforeEach(() => {
    store = useAppStore();
    store.state.isAuthenticated = true;
    store.state.user = {
      id: "test-user-id",
      email: "test@example.com",
      status: "active",
      emailVerified: true,
      emailStatusNotice: "",
      displayName: "Test User",
      avatarUrl: null,
      locale: "en-US",
      timezone: "UTC",
      createdAt: new Date().toISOString(),
    };
    store.state.errorMessage = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rolls back state.skills and sets errorMessage when addSkill fails", async () => {
    const initialSkillCount = store.state.skills.length;
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("Network connection dropped"),
    );

    await expect(
      store.addSkill({
        name: "Faulty Skill",
        description: "Should roll back",
        category: "Test",
        content: "Test instruction",
        enabled: true,
      }),
    ).rejects.toThrow("Network connection dropped");

    expect(store.state.skills.length).toBe(initialSkillCount);
    expect(
      store.state.skills.find((s) => s.name === "Faulty Skill"),
    ).toBeUndefined();
    expect(store.state.errorMessage).toContain("Network connection dropped");
  });

  it("rolls back state.skills when deleteSkill encounters a server error", async () => {
    const skillToDelete = store.state.skills[0]!;
    const initialSkills = [...store.state.skills];

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => ({ message: "Database lock contention" }),
    } as any);

    await expect(store.deleteSkill(skillToDelete.id)).rejects.toThrow();

    expect(store.state.skills.length).toBe(initialSkills.length);
    expect(store.state.skills.some((s) => s.id === skillToDelete.id)).toBe(
      true,
    );
    expect(store.state.errorMessage).toBeTruthy();
  });

  it("rolls back state.rules when updateRule fails", async () => {
    const rule = store.state.rules[0]!;
    const originalName = rule.name;

    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("Validation failed on rule format"),
    );

    await expect(
      store.updateRule(rule.id, { name: "Altered Name Never Persisted" }),
    ).rejects.toThrow("Validation failed on rule format");

    expect(store.state.rules.find((r) => r.id === rule.id)?.name).toBe(
      originalName,
    );
    expect(store.state.errorMessage).toContain(
      "Validation failed on rule format",
    );
  });

  it("rolls back state.agents when updateAgent fails", async () => {
    const agent = store.state.agents[0]!;
    const originalPersonality = agent.personality;

    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("Server unreachable"),
    );

    await expect(
      store.updateAgent(agent.id, { personality: "Changed Personality" }),
    ).rejects.toThrow("Server unreachable");

    expect(store.state.agents.find((a) => a.id === agent.id)?.personality).toBe(
      originalPersonality,
    );
    expect(store.state.errorMessage).toContain("Server unreachable");
  });

  it("rolls back state.tools when toggleTool fails", async () => {
    // Ensure at least one tool exists in state
    if (store.state.tools.length === 0) {
      store.state.tools.push({
        id: "tool_test",
        name: "Test Tool",
        description: "Test description",
        category: "System",
        permissionLevel: "read-only",
        requiresConfirmation: false,
        enabled: true,
        status: "ready",
      });
    }
    const tool = store.state.tools[0]!;
    const originalEnabled = tool.enabled;

    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("Tool permission denied"),
    );

    await expect(store.toggleTool(tool.id)).rejects.toThrow(
      "Tool permission denied",
    );

    expect(store.state.tools.find((t) => t.id === tool.id)?.enabled).toBe(
      originalEnabled,
    );
    expect(store.state.errorMessage).toContain("Tool permission denied");
  });

  it("rolls back state.memories when addMemory fails", async () => {
    const initialMemoryCount = store.state.memories.length;

    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("SQLite disk full"),
    );

    await expect(
      store.addMemory("Ephemeral fact that should fail", "fact"),
    ).rejects.toThrow("SQLite disk full");

    expect(store.state.memories.length).toBe(initialMemoryCount);
    expect(
      store.state.memories.find((m) =>
        m.content.includes("Ephemeral fact that should fail"),
      ),
    ).toBeUndefined();
    expect(store.state.errorMessage).toContain("SQLite disk full");
  });
});
