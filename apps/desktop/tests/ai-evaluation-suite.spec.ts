import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import http from "node:http";
import { AuthService } from "../electron/server/auth-service.js";
import { CompanionRepository } from "../electron/server/companion-repository.js";
import { initSchema } from "../electron/server/database.js";
import { ToolExecutor } from "../electron/server/tool-executor.js";
import {
  type ModelProviderAdapter,
  type ChatCompletionRequest,
  type ChatCompletionResponse,
  ModelProviderRouter,
} from "../electron/server/provider-adapters.js";
import { createServer } from "../electron/server/server.js";

/**
 * Deterministic Mock Adapter for Offline AI Evaluation
 * Records prompts, message payloads, and simulates latency and token metrics.
 */
class EvalBenchmarkAdapter implements ModelProviderAdapter {
  public provider = "gemini" as const;
  public capturedRequests: Array<ChatCompletionRequest> = [];

  async testConnection(_key: string) {
    return {
      success: true,
      availableModels: ["gemini-2.5-flash", "gemini-2.5-pro"],
    };
  }

  async generateChatResponse(
    _key: string,
    req: ChatCompletionRequest,
  ): Promise<ChatCompletionResponse> {
    this.capturedRequests.push({ ...req });

    const lastMsg = req.messages[req.messages.length - 1]?.content || "";

    // Simulated responses based on evaluation scenario
    if (lastMsg.includes("ERROR_SIMULATION")) {
      throw new Error("Provider simulated 503 Overloaded");
    }

    let responseContent = "Companion evaluation response.";
    if (lastMsg.includes("hello") || lastMsg.includes("Aiko")) {
      responseContent =
        "Hello! I am Aiko, your desktop companion. How may I assist you today?";
    } else if (lastMsg.includes("coffee")) {
      responseContent =
        "I remember you prefer dark roast coffee in the morning!";
    }

    return {
      content: responseContent,
      model: req.model,
      usage: {
        promptTokens: (req.systemPrompt?.length || 0) / 4 + 15,
        completionTokens: responseContent.length / 4,
        totalTokens:
          (req.systemPrompt?.length || 0) / 4 + 15 + responseContent.length / 4,
      },
    };
  }
}

describe("F12: Deterministic Offline AI Evaluation Suite & Integration", () => {
  let db: DatabaseSync;
  let authService: AuthService;
  let repo: CompanionRepository;
  let executor: ToolExecutor;
  let adapter: EvalBenchmarkAdapter;
  let router: ModelProviderRouter;
  let server: http.Server;
  let port: number;
  let userId: string;
  let sessionToken: string;

  beforeEach(async () => {
    db = new DatabaseSync(":memory:");
    initSchema(db);
    authService = new AuthService(db);
    repo = new CompanionRepository(db);
    executor = new ToolExecutor(repo);

    adapter = new EvalBenchmarkAdapter();
    router = new ModelProviderRouter([adapter]);

    const regResult = await authService.register(
      "eval-user@example.com",
      "RobustEvaluationPassword123!",
      "Evaluation Suite User",
    );
    userId = regResult.user.id;
    sessionToken = regResult.sessionToken;

    // Save a valid encrypted secret key for the gemini provider
    authService.saveSecret(
      userId,
      "gemini",
      "AIzaSyTestEvaluationKeyMock12345",
    );

    server = createServer({
      db,
      providerRouter: router,
      toolExecutor: executor,
    });
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address() as any;
        port = addr.port;
        resolve();
      });
    });
  });

  afterEach(async () => {
    if (server)
      await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
  });

  describe("Scenario 1: Prompt Adherence & Multi-Layer Context Composition", () => {
    it("composes persona, instructions, active rules, active skills, tools, and relevant memories", async () => {
      // 1. Add preference memory
      repo.createMemory(userId, {
        category: "preference",
        content: "User loves dark roast coffee without sugar",
        confidence: 0.98,
      });

      // 2. Send chat message
      const res = await fetch(
        `http://127.0.0.1:${port}/api/v1/chat/completions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            message: "What do you know about my coffee preference?",
          }),
        },
      );

      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.message.role).toBe("assistant");
      expect(data.message.content).toContain("coffee");
      expect(data.usage.totalTokens).toBeGreaterThan(0);

      // Verify captured system prompt composition
      expect(adapter.capturedRequests.length).toBe(1);
      const captured = adapter.capturedRequests[0]!;
      expect(captured.systemPrompt).toContain("You are Aiko");
      expect(captured.systemPrompt).toContain("Operational Rules to obey");
      expect(captured.systemPrompt).toContain("Active Skills");
      expect(captured.systemPrompt).toContain(
        "Available Tools and Capabilities",
      );
      expect(captured.systemPrompt).toContain("User loves dark roast coffee");
    });
  });

  describe("Scenario 2: Context Window Truncation (12 Recent Messages)", () => {
    it("bounds conversation history to the last 12 messages to prevent context explosion", async () => {
      // Post 14 user messages
      for (let i = 1; i <= 14; i++) {
        await fetch(`http://127.0.0.1:${port}/api/v1/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            message: `Test turn number ${i}`,
          }),
        });
      }

      // Check last captured request
      const lastReq =
        adapter.capturedRequests[adapter.capturedRequests.length - 1]!;
      // History should not exceed 12 turns
      expect(lastReq.messages.length).toBeLessThanOrEqual(12);
    });
  });

  describe("Scenario 3: Model Error Recovery & Structured Degradation", () => {
    it("handles remote provider failure gracefully and returns 502 model_generation_failed", async () => {
      const res = await fetch(
        `http://127.0.0.1:${port}/api/v1/chat/completions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            message: "Trigger an ERROR_SIMULATION now",
          }),
        },
      );

      expect(res.status).toBe(502);
      const errData = (await res.json()) as any;
      expect(errData.error).toBe("model_generation_failed");
      expect(errData.message).toContain("Provider simulated 503 Overloaded");
    });
  });

  describe("Scenario 4: Stale References & Association Cleanup", () => {
    it("cleans up tool and skill links cleanly when agent is updated", async () => {
      const agents = repo.listAgents(userId);
      const aiko = agents.find((a) => a.name === "Aiko")!;

      // Update agent with empty associated tools and rules
      const updated = repo.updateAgent(userId, aiko.id, {
        associatedToolIds: [],
      });

      expect(updated.associatedToolIds).toHaveLength(0);

      // Verify prompt now excludes tools
      await fetch(`http://127.0.0.1:${port}/api/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          message: "Hello Aiko, checking tools",
        }),
      });

      const lastReq =
        adapter.capturedRequests[adapter.capturedRequests.length - 1]!;
      expect(lastReq.systemPrompt!).not.toContain(
        "Available Tools and Capabilities",
      );
    });
  });
});
