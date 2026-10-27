import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { AuthService } from "../electron/server/auth-service.js";
import { CompanionRepository } from "../electron/server/companion-repository.js";
import { initSchema } from "../electron/server/database.js";
import {
  type ModelProviderAdapter,
  ModelProviderRouter,
} from "../electron/server/provider-adapters.js";
import { createServer } from "../electron/server/server.js";
import type http from "node:http";

class EndToEndMockAdapter implements ModelProviderAdapter {
  public provider = "openai" as const;
  public lastPrompt: string = "";
  public lastMessages: any[] = [];

  async testConnection(key: string) {
    if (key === "invalid_key") {
      return { success: false, errorMessage: "Invalid API key" };
    }
    return {
      success: true,
      availableModels: ["gpt-4o", "gpt-4o-mini"],
    };
  }

  async generateChatResponse(
    _key: string,
    req: { model: string; messages: any[]; systemPrompt: string },
  ) {
    this.lastPrompt = req.systemPrompt;
    this.lastMessages = req.messages;
    return {
      content: "I am your companion, configured and ready.",
      model: req.model,
      usage: { promptTokens: 42, completionTokens: 12, totalTokens: 54 },
    };
  }
}

describe("Phase 06: Full Companion Domain End-to-End Integration & Security Flow", () => {
  let db: DatabaseSync;
  let server: http.Server;
  let baseUrl: string;
  let mockAdapter: EndToEndMockAdapter;
  let router: ModelProviderRouter;
  let companionRepo: CompanionRepository;
  let authService: AuthService;

  beforeEach(async () => {
    db = new DatabaseSync(":memory:");
    initSchema(db);
    companionRepo = new CompanionRepository(db);
    authService = new AuthService(db);

    mockAdapter = new EndToEndMockAdapter();
    router = new ModelProviderRouter([mockAdapter]);
    server = createServer({ db, providerRouter: router });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address() as { port: number };
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    db.close();
  });

  async function api(path: string, options: any = {}) {
    const url = `${baseUrl}${path}`;
    const headers: any = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };
    if (options.token) {
      headers["Authorization"] = `Bearer ${options.token}`;
    }
    if (options.cookie) {
      headers["Cookie"] = options.cookie;
    }

    const res = await fetch(url, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, headers: res.headers, body: data };
  }

  it("executes the complete companion lifecycle from registration to chat, multi-user isolation, and account deletion cascade", async () => {
    // -------------------------------------------------------------
    // Step 1: User A Registration & Desktop Login
    // -------------------------------------------------------------
    const regRes = await api("/api/v1/auth/register", {
      method: "POST",
      body: {
        email: "alice@example.com",
        password: "LongSecurePassword123!@#",
        displayName: "Alice",
      },
    });
    expect(regRes.status).toBe(201);
    expect(regRes.body.user.email).toBe("alice@example.com");

    const loginRes = await api("/api/v1/auth/desktop-login", {
      method: "POST",
      body: {
        email: "alice@example.com",
        password: "LongSecurePassword123!@#",
        deviceName: "Alice-Workstation",
      },
    });
    expect(loginRes.status).toBe(200);
    const tokenA = loginRes.body.refreshToken;
    const userIdA = loginRes.body.user.id;
    expect(tokenA).toBeDefined();

    // -------------------------------------------------------------
    // Step 2: Load Profile & Initial Companion Seed Data
    // -------------------------------------------------------------
    const profileRes = await api("/api/v1/users/me", { token: tokenA });
    expect(profileRes.status).toBe(200);
    expect(profileRes.body.displayName).toBe("Alice");

    const agentsRes = await api("/api/v1/agents", { token: tokenA });
    expect(agentsRes.status).toBe(200);
    expect(agentsRes.body.agents.length).toBeGreaterThanOrEqual(1);
    const initialAgent = agentsRes.body.agents[0];
    expect(initialAgent.name).toBe("Aiko");

    // -------------------------------------------------------------
    // Step 3: Vault Security - Add OpenAI Secret (Zero Key Exposure)
    // -------------------------------------------------------------
    const secretRes = await api("/api/v1/users/me/secrets", {
      method: "POST",
      token: tokenA,
      body: {
        provider: "openai",
        apiKey: "sk-proj-alice-super-secret-key-1234567890",
      },
    });
    expect(secretRes.status).toBe(201);
    // HR-5: Must return safe hint only; full key NEVER returned to renderer
    expect(secretRes.body.keyHint).toContain("...7890");
    expect(JSON.stringify(secretRes.body)).not.toContain(
      "alice-super-secret-key",
    );

    // -------------------------------------------------------------
    // Step 4: Real Provider Connectivity Check
    // -------------------------------------------------------------
    const connTest = await api("/api/v1/providers/test", {
      method: "POST",
      token: tokenA,
      body: { provider: "openai" },
    });
    expect(connTest.status).toBe(200);
    expect(connTest.body.success).toBe(true);
    expect(connTest.body.availableModels).toContain("gpt-4o");

    // -------------------------------------------------------------
    // Step 5: Configure Agent Profile, Provider, and System Instructions
    // -------------------------------------------------------------
    const updateAgentRes = await api(`/api/v1/agents/${initialAgent.id}`, {
      method: "PATCH",
      token: tokenA,
      body: {
        name: "Lumina",
        personality: "Analytical and insightful",
        conversationalStyle: "Concise and structured",
        preferredProvider: "openai",
        preferredModel: "gpt-4o",
        systemInstructions: "Analyze technical queries with high precision.",
      },
    });
    expect(updateAgentRes.status).toBe(200);
    expect(updateAgentRes.body.name).toBe("Lumina");
    expect(updateAgentRes.body.preferredProvider).toBe("openai");

    // -------------------------------------------------------------
    // Step 6: Create and Attach Custom Skill, Rule, and Tool
    // -------------------------------------------------------------
    // Custom Skill
    const skillRes = await api("/api/v1/skills", {
      method: "POST",
      token: tokenA,
      body: {
        name: "Code Reviewer",
        category: "Development",
        content: "Check for security vulnerabilities and complexity.",
        enabled: true,
      },
    });
    expect(skillRes.status).toBe(201);
    const customSkillId = skillRes.body.id;

    // Attach skill to agent
    await api(`/api/v1/agents/${initialAgent.id}`, {
      method: "PATCH",
      token: tokenA,
      body: { associatedSkillIds: [customSkillId] },
    });

    // Custom Rule
    const ruleRes = await api("/api/v1/rules", {
      method: "POST",
      token: tokenA,
      body: {
        name: "Bullet Format Rule",
        content: "Format all actionable advice as markdown bullet points.",
        scope: "global",
        priority: 1,
        enabled: true,
      },
    });
    expect(ruleRes.status).toBe(201);

    // Disabled Rule (should NOT be included in runtime composition)
    const disabledRuleRes = await api("/api/v1/rules", {
      method: "POST",
      token: tokenA,
      body: {
        name: "Disabled Rule",
        content: "Speak exclusively in medieval Elizabethan English.",
        scope: "global",
        priority: 5,
        enabled: false,
      },
    });
    expect(disabledRuleRes.status).toBe(201);

    // -------------------------------------------------------------
    // Step 7: Create User Memory
    // -------------------------------------------------------------
    const memRes = await api("/api/v1/memories", {
      method: "POST",
      token: tokenA,
      body: {
        category: "preference",
        content: "Prefers TypeScript and Vue 3 Composition API.",
      },
    });
    expect(memRes.status).toBe(201);
    expect(memRes.body.content).toContain("TypeScript and Vue 3");

    // -------------------------------------------------------------
    // Step 8: Send Chat Completion & Inspect Runtime Request Composition
    // -------------------------------------------------------------
    const chatRes = await api("/api/v1/chat/completions", {
      method: "POST",
      token: tokenA,
      body: {
        message:
          "How should I structure my frontend code using TypeScript and Vue?",
      },
    });
    expect(chatRes.status).toBe(200);
    expect(chatRes.body.message.role).toBe("assistant");
    expect(chatRes.body.message.content).toBe(
      "I am your companion, configured and ready.",
    );

    // Verify Prompt Composition in mock adapter:
    // 1. Agent personality & instructions
    expect(mockAdapter.lastPrompt).toContain("Lumina");
    expect(mockAdapter.lastPrompt).toContain(
      "Analyze technical queries with high precision.",
    );
    // 2. Active Skill
    expect(mockAdapter.lastPrompt).toContain("Code Reviewer");
    expect(mockAdapter.lastPrompt).toContain(
      "Check for security vulnerabilities",
    );
    // 3. Enabled Rule
    expect(mockAdapter.lastPrompt).toContain("Bullet Format Rule");
    expect(mockAdapter.lastPrompt).toContain(
      "Format all actionable advice as markdown bullet points.",
    );
    // 4. Disabled Rule must NOT be present
    expect(mockAdapter.lastPrompt).not.toContain(
      "medieval Elizabethan English",
    );
    // 5. Retrieved Memory
    expect(mockAdapter.lastPrompt).toContain(
      "Relevant Context from user's local memory vault:",
    );
    expect(mockAdapter.lastPrompt).toContain("TypeScript and Vue 3");

    // -------------------------------------------------------------
    // Step 9: Multi-User Data Isolation (User B)
    // -------------------------------------------------------------
    const userBReg = await api("/api/v1/auth/register", {
      method: "POST",
      body: {
        email: "bob@example.com",
        password: "LongSecurePassword456!@#",
        displayName: "Bob",
      },
    });
    expect(userBReg.status).toBe(201);

    const userBLogin = await api("/api/v1/auth/desktop-login", {
      method: "POST",
      body: {
        email: "bob@example.com",
        password: "LongSecurePassword456!@#",
      },
    });
    const tokenB = userBLogin.body.refreshToken;
    const userIdB = userBLogin.body.user.id;

    // Bob cannot see Alice's memories
    const bobMems = await api("/api/v1/memories", { token: tokenB });
    expect(bobMems.body.memories).toHaveLength(0);

    // Bob cannot see Alice's custom rule
    const bobRules = await api("/api/v1/rules", { token: tokenB });
    const hasAliceRule = bobRules.body.rules.some(
      (r: any) => r.name === "Bullet Format Rule",
    );
    expect(hasAliceRule).toBe(false);

    // Bob cannot see Alice's secrets
    const bobSecrets = await api("/api/v1/users/me/secrets", { token: tokenB });
    expect(bobSecrets.body.secrets).toHaveLength(0);

    // Bob cannot see Alice's chat history
    const bobHistory = await api("/api/v1/chat/messages", { token: tokenB });
    expect(bobHistory.body.messages).toHaveLength(0);

    // -------------------------------------------------------------
    // Step 10: Account Deletion Cascades Owned Data Cleanly
    // -------------------------------------------------------------
    const deleteRes = await api("/api/v1/users/me/delete", {
      method: "POST",
      token: tokenA,
      body: {
        currentPassword: "LongSecurePassword123!@#",
        confirmationPhrase: "DELETE MY ACCOUNT",
      },
    });
    expect(deleteRes.status).toBe(200);

    // Alice's data in SQLite is completely purged
    expect(companionRepo.listAgents(userIdA)).toHaveLength(0);
    expect(companionRepo.listMemories(userIdA)).toHaveLength(0);
    expect(companionRepo.listRules(userIdA)).toHaveLength(0);
    expect(companionRepo.listSkills(userIdA)).toHaveLength(0);
    expect(companionRepo.listTools(userIdA)).toHaveLength(0);
    expect(companionRepo.listMessages(userIdA)).toHaveLength(0);
    expect(authService.getSecrets(userIdA)).toHaveLength(0);

    // Bob's data remains untouched
    expect(companionRepo.listAgents(userIdB).length).toBeGreaterThan(0);
  });
});
