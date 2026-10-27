import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { CompanionRepository } from "../electron/server/companion-repository.js";
import { AuthService } from "../electron/server/auth-service.js";
import { initSchema } from "../electron/server/database.js";
import {
  type ModelProviderAdapter,
  ModelProviderRouter,
} from "../electron/server/provider-adapters.js";
import { createServer } from "../electron/server/server.js";
import type http from "node:http";

class FakeTestAdapter implements ModelProviderAdapter {
  public provider = "openai" as const;
  public lastRequestedSystemPrompt: string | null = null;
  public lastRequestedMessages: any[] = [];

  async testConnection(_key: string) {
    return { success: true, availableModels: ["gpt-4o"] };
  }

  async generateChatResponse(
    _apiKey: string,
    request: { model: string; messages: any[]; systemPrompt: string },
  ) {
    this.lastRequestedSystemPrompt = request.systemPrompt;
    this.lastRequestedMessages = request.messages;
    return {
      content: "Hello! I remember your preferences.",
      model: request.model,
      usage: { promptTokens: 30, completionTokens: 8 },
    };
  }
}

describe("Phase 05: Private Persistent Memory & Retrieval", () => {
  let db: DatabaseSync;
  let companionRepo: CompanionRepository;
  let authService: AuthService;
  let testUserIdA: string;
  let testUserIdB: string;

  beforeEach(async () => {
    db = new DatabaseSync(":memory:");
    initSchema(db);
    companionRepo = new CompanionRepository(db);
    authService = new AuthService(db);

    const userA = await authService.register(
      "user_a@example.com",
      "CorrectPassword123!@#",
      "User A",
    );
    testUserIdA = userA.user.id;

    const userB = await authService.register(
      "user_b@example.com",
      "CorrectPassword123!@#",
      "User B",
    );
    testUserIdB = userB.user.id;
  });

  afterEach(() => {
    db.close();
  });

  it("ensures new users start with clean memory storage without fake initial fixtures", () => {
    const memsA = companionRepo.listMemories(testUserIdA);
    const memsB = companionRepo.listMemories(testUserIdB);
    expect(memsA).toEqual([]);
    expect(memsB).toEqual([]);
  });

  it("supports user-scoped Memory CRUD and category persistence", () => {
    const created = companionRepo.createMemory(testUserIdA, {
      category: "preference",
      content: "Prefers concise technical answers in bullet points",
      confidence: 0.95,
    });

    expect(created.id).toMatch(/^mem_/);
    expect(created.category).toBe("preference");
    expect(created.content).toBe(
      "Prefers concise technical answers in bullet points",
    );
    expect(created.confidence).toBe(0.95);
    expect(created.createdAt).toBeDefined();

    // Read by ID
    const fetched = companionRepo.getMemoryById(testUserIdA, created.id);
    expect(fetched).toEqual(created);

    // Update
    const updated = companionRepo.updateMemory(testUserIdA, created.id, {
      content: "Prefers concise technical answers with code examples",
      confidence: 1.0,
      category: "habit",
    });
    expect(updated.content).toBe(
      "Prefers concise technical answers with code examples",
    );
    expect(updated.category).toBe("habit");
    expect(updated.confidence).toBe(1.0);

    // Delete
    companionRepo.deleteMemory(testUserIdA, created.id);
    expect(companionRepo.getMemoryById(testUserIdA, created.id)).toBeNull();
    expect(companionRepo.listMemories(testUserIdA)).toHaveLength(0);
  });

  it("strictly isolates memories between users (User A cannot see or modify User B's memory)", () => {
    const memA = companionRepo.createMemory(testUserIdA, {
      category: "fact",
      content: "User A favorite language is TypeScript",
    });

    const memB = companionRepo.createMemory(testUserIdB, {
      category: "fact",
      content: "User B favorite language is Python",
    });

    // User A should only see memA
    const listA = companionRepo.listMemories(testUserIdA);
    expect(listA).toHaveLength(1);
    expect(listA[0]!.id).toBe(memA.id);
    expect(listA[0]!.content).toContain("TypeScript");

    // User B should only see memB
    const listB = companionRepo.listMemories(testUserIdB);
    expect(listB).toHaveLength(1);
    expect(listB[0]!.id).toBe(memB.id);
    expect(listB[0]!.content).toContain("Python");

    // Cross-user read should return null
    expect(companionRepo.getMemoryById(testUserIdA, memB.id)).toBeNull();
    expect(companionRepo.getMemoryById(testUserIdB, memA.id)).toBeNull();

    // Cross-user delete should fail
    expect(() => companionRepo.deleteMemory(testUserIdA, memB.id)).toThrow();
  });

  it("handles agent scoping: agent-scoped memories are isolated from other agents", () => {
    const agent1 = companionRepo.createAgent(testUserIdA, {
      name: "Agent 1",
      personality: "Helpful",
      conversationalStyle: "Direct",
      systemInstructions: "Help user",
    });

    const agent2 = companionRepo.createAgent(testUserIdA, {
      name: "Agent 2",
      personality: "Playful",
      conversationalStyle: "Casual",
      systemInstructions: "Play with user",
    });

    // Create 1 global memory, 1 agent1 memory, 1 agent2 memory
    companionRepo.createMemory(testUserIdA, {
      category: "fact",
      content: "Global fact: User likes tea",
    });

    companionRepo.createMemory(testUserIdA, {
      category: "preference",
      content: "Agent 1 fact: Call me Commander",
      agentId: agent1.id,
    });

    companionRepo.createMemory(testUserIdA, {
      category: "preference",
      content: "Agent 2 fact: Call me Senpai",
      agentId: agent2.id,
    });

    // Query for Agent 1: should return global fact and Agent 1 fact, but NOT Agent 2 fact
    const agent1Mems = companionRepo.listMemories(testUserIdA, {
      agentId: agent1.id,
    });
    expect(agent1Mems).toHaveLength(2);
    expect(agent1Mems.some((m) => m.content.includes("Commander"))).toBe(true);
    expect(agent1Mems.some((m) => m.content.includes("tea"))).toBe(true);
    expect(agent1Mems.some((m) => m.content.includes("Senpai"))).toBe(false);

    // Query for Agent 2: should return global fact and Agent 2 fact, but NOT Agent 1 fact
    const agent2Mems = companionRepo.listMemories(testUserIdA, {
      agentId: agent2.id,
    });
    expect(agent2Mems).toHaveLength(2);
    expect(agent2Mems.some((m) => m.content.includes("Senpai"))).toBe(true);
    expect(agent2Mems.some((m) => m.content.includes("tea"))).toBe(true);
    expect(agent2Mems.some((m) => m.content.includes("Commander"))).toBe(false);
  });

  it("performs deterministic lexical relevance ranking and updates last_recalled_at", () => {
    companionRepo.createMemory(testUserIdA, {
      category: "preference",
      content: "Prefers dark mode and high contrast themes",
    });
    companionRepo.createMemory(testUserIdA, {
      category: "fact",
      content: "Loves mechanical keyboards with tactile switches",
    });
    companionRepo.createMemory(testUserIdA, {
      category: "habit",
      content: "Drinks coffee every morning at eight",
    });

    // Search query specifically matching keyboards
    const results = companionRepo.searchRelevantMemories(
      testUserIdA,
      "mechanical keyboards tactile switches",
      undefined,
      3,
    );

    expect(results).toHaveLength(1);
    expect(results[0]!.content).toContain("mechanical keyboards");
    expect(results[0]!.lastRecalledAt).toBeDefined();

    // Verify persisted in database
    const refreshed = companionRepo.getMemoryById(testUserIdA, results[0]!.id);
    expect(refreshed?.lastRecalledAt).toBeDefined();
  });

  it("supports clearAllMemories with user scoping", () => {
    companionRepo.createMemory(testUserIdA, {
      category: "fact",
      content: "Fact 1",
    });
    companionRepo.createMemory(testUserIdA, {
      category: "fact",
      content: "Fact 2",
    });
    companionRepo.createMemory(testUserIdB, {
      category: "fact",
      content: "User B Fact",
    });

    companionRepo.clearAllMemories(testUserIdA);

    expect(companionRepo.listMemories(testUserIdA)).toHaveLength(0);
    // User B memories must remain intact
    expect(companionRepo.listMemories(testUserIdB)).toHaveLength(1);
  });

  describe("Chat Integration & Retention Enforcement", () => {
    let server: http.Server;
    let fakeAdapter: FakeTestAdapter;
    let serverUrl: string;
    let sessionToken: string;

    beforeEach(async () => {
      fakeAdapter = new FakeTestAdapter();
      const router = new ModelProviderRouter([fakeAdapter]);

      server = createServer({
        db,
        corsOrigins: ["http://localhost:5173"],
        providerRouter: router,
      });

      await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => resolve());
      });

      const addr = server.address() as any;
      serverUrl = `http://127.0.0.1:${addr.port}`;

      // Login to get token
      const loginRes = await fetch(`${serverUrl}/api/v1/auth/desktop-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "user_a@example.com",
          password: "CorrectPassword123!@#",
        }),
      });
      const data = await loginRes.json();
      sessionToken = data.refreshToken;

      // Update active agent to use openai provider
      const active = companionRepo.getActiveAgent(testUserIdA)!;
      companionRepo.updateAgent(testUserIdA, active.id, {
        preferredProvider: "openai",
        preferredModel: "gpt-4o",
      });

      // Store a secret in the vault for openai
      authService.saveSecret(
        testUserIdA,
        "openai",
        "sk-proj-testkey12345678901234567890",
      );
    });

    afterEach(async () => {
      if (server) {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });

    it("includes relevant memories in prompt context when memoryRetention is enabled", async () => {
      // Create relevant memory
      companionRepo.createMemory(testUserIdA, {
        category: "preference",
        content: "Always reply in Vietnamese language",
      });

      const res = await fetch(`${serverUrl}/api/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          message: "What language should you use to talk with me?",
        }),
      });

      expect(res.status).toBe(200);
      expect(fakeAdapter.lastRequestedSystemPrompt).toContain(
        "Relevant Context from user's local memory vault:",
      );
      expect(fakeAdapter.lastRequestedSystemPrompt).toContain(
        "Always reply in Vietnamese language",
      );
    });

    it("blocks memory injection into prompt context when memoryRetention is disabled", async () => {
      // Create relevant memory
      companionRepo.createMemory(testUserIdA, {
        category: "preference",
        content: "Always reply in Vietnamese language",
      });

      // Update active agent to have memoryRetention: false
      const activeAgent = companionRepo.getActiveAgent(testUserIdA)!;
      companionRepo.updateAgent(testUserIdA, activeAgent.id, {
        behaviorPreferences: {
          ...activeAgent.behaviorPreferences,
          memoryRetention: false,
        },
      });

      const res = await fetch(`${serverUrl}/api/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          message: "What language should you use to talk with me?",
        }),
      });

      expect(res.status).toBe(200);
      expect(fakeAdapter.lastRequestedSystemPrompt).not.toContain(
        "Relevant Context from user's local memory vault:",
      );
      expect(fakeAdapter.lastRequestedSystemPrompt).not.toContain(
        "Always reply in Vietnamese language",
      );
    });

    it("does not include deleted memories in subsequent provider requests", async () => {
      const mem = companionRepo.createMemory(testUserIdA, {
        category: "preference",
        content: "User loves dark theme aesthetics",
      });

      // Delete memory
      companionRepo.deleteMemory(testUserIdA, mem.id);

      const res = await fetch(`${serverUrl}/api/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          message: "What theme aesthetics do I like?",
        }),
      });

      expect(res.status).toBe(200);
      expect(fakeAdapter.lastRequestedSystemPrompt).not.toContain(
        "User loves dark theme aesthetics",
      );
    });
  });
});
