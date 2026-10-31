import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import http from "node:http";
import { initSchema } from "../electron/server/database.js";
import { AuthService } from "../electron/server/auth-service.js";
import { CompanionRepository } from "../electron/server/companion-repository.js";
import { ToolExecutor } from "../electron/server/tool-executor.js";
import { createServer } from "../electron/server/server.js";
import {
  GeminiAdapter,
  ModelProviderRouter,
  type ModelProviderAdapter,
  type ChatCompletionRequest,
  type ChatCompletionResponse,
} from "../electron/server/provider-adapters.js";

class MockToolCallingAdapter implements ModelProviderAdapter {
  public provider = "gemini" as const;
  public capturedRequests: Array<ChatCompletionRequest> = [];
  public callCount = 0;

  async testConnection(_key: string) {
    return { success: true, availableModels: ["gemini-2.5-flash"] };
  }

  async generateChatResponse(
    _key: string,
    req: ChatCompletionRequest,
  ): Promise<ChatCompletionResponse> {
    this.capturedRequests.push({ ...req });
    this.callCount++;

    // Turn 1: Model decides to call the avatar_expression tool
    if (this.callCount === 1) {
      return {
        content:
          'I will smile for you!\n```tool_call\n{"tool": "avatar_expression", "args": {"expression": "happy", "intensity": 0.9}}\n```',
        model: req.model,
        usage: { promptTokens: 40, completionTokens: 20, totalTokens: 60 },
      };
    }

    // Turn 2: Follow-up synthesis after receiving tool execution result
    return {
      content: "I've updated my expression to happy! How does that look?",
      model: req.model,
      usage: { promptTokens: 70, completionTokens: 15, totalTokens: 85 },
    };
  }
}

describe("P1 Provider Security, Closed-Loop Tool Execution & Timeouts", () => {
  describe("GeminiAdapter Header Authentication & URL Cleanliness", () => {
    it("transmits API key via x-goog-api-key header and strips ?key= from models endpoint", async () => {
      let capturedUrl = "";
      let capturedHeaders: Record<string, string> = {};

      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockImplementationOnce(async (url, init) => {
          capturedUrl = String(url);
          capturedHeaders = (init?.headers as Record<string, string>) || {};
          return {
            ok: true,
            json: async () => ({
              models: [{ name: "models/gemini-2.5-flash" }],
            }),
          } as any;
        });

      const adapter = new GeminiAdapter();
      const apiKey = "AIzaSyTestSecretKeyCleanHeaders999";
      const res = await adapter.testConnection(apiKey);

      expect(res.success).toBe(true);
      expect(capturedUrl).not.toContain("?key=");
      expect(capturedUrl).not.toContain(apiKey);
      expect(capturedHeaders["x-goog-api-key"]).toBe(apiKey);

      fetchSpy.mockRestore();
    });

    it("transmits API key via x-goog-api-key header and strips ?key= from generateContent endpoint", async () => {
      let capturedUrl = "";
      let capturedHeaders: Record<string, string> = {};

      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockImplementationOnce(async (url, init) => {
          capturedUrl = String(url);
          capturedHeaders = (init?.headers as Record<string, string>) || {};
          return {
            ok: true,
            json: async () => ({
              candidates: [
                { content: { parts: [{ text: "Hello without URL leakage" }] } },
              ],
            }),
          } as any;
        });

      const adapter = new GeminiAdapter();
      const apiKey = "AIzaSyTestSecretChatKeyNoLeak123";
      const res = await adapter.generateChatResponse(apiKey, {
        model: "gemini-2.5-flash",
        messages: [{ role: "user", content: "Hello" }],
      });

      expect(res.content).toBe("Hello without URL leakage");
      expect(capturedUrl).not.toContain("?key=");
      expect(capturedUrl).not.toContain(apiKey);
      expect(capturedHeaders["x-goog-api-key"]).toBe(apiKey);

      fetchSpy.mockRestore();
    });
  });

  describe("Closed-Loop Model Tool Calling Integration", () => {
    let db: DatabaseSync;
    let authService: AuthService;
    let repo: CompanionRepository;
    let executor: ToolExecutor;
    let adapter: MockToolCallingAdapter;
    let router: ModelProviderRouter;
    let server: http.Server;
    let port: number;
    let sessionToken: string;

    beforeEach(async () => {
      db = new DatabaseSync(":memory:");
      initSchema(db);
      authService = new AuthService(db);
      repo = new CompanionRepository(db);
      executor = new ToolExecutor(repo);

      adapter = new MockToolCallingAdapter();
      router = new ModelProviderRouter([adapter]);

      const regResult = await authService.register(
        "tool-user@example.com",
        "ValidComplexPassword123!",
        "Tool Tester",
      );
      sessionToken = regResult.sessionToken;

      authService.saveSecret(
        regResult.user.id,
        "gemini",
        "AIzaSyTestKeyForToolsMock123",
      );

      server = createServer({
        db,
        providerRouter: router,
        toolExecutor: executor,
      });

      await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => {
          port = (server.address() as any).port;
          resolve();
        });
      });
    });

    afterEach(async () => {
      if (server)
        await new Promise<void>((resolve) => server.close(() => resolve()));
      db.close();
    });

    it("detects model tool call, executes tool handler, and synthesizes final response", async () => {
      const res = await fetch(
        `http://127.0.0.1:${port}/api/v1/chat/completions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            message: "Please smile on stage",
          }),
        },
      );

      expect(res.status).toBe(200);
      const data = (await res.json()) as any;

      // Assert that 2 provider turns occurred
      expect(adapter.callCount).toBe(2);

      // Assert that executed tool details are included in the response payload
      expect(data.toolExecutions).toBeDefined();
      expect(data.toolExecutions.length).toBe(1);
      expect(data.toolExecutions[0].toolId).toBe("avatar_expression");
      expect(data.toolExecutions[0].result.applied).toBe(true);
      expect(data.toolExecutions[0].result.expression).toBe("happy");

      // Assert that final synthesized message reflects the conversation outcome
      expect(data.message.content).toContain("happy");
      expect(data.usage.totalTokens).toBe(145);
    });
  });
});
