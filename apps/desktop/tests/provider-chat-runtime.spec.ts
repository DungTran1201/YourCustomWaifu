import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import http from "node:http";
import { initSchema } from "../electron/server/database.js";
import { createServer } from "../electron/server/server.js";
import {
  GeminiAdapter,
  OpenAIAdapter,
  AnthropicAdapter,
  ModelProviderRouter,
  type ModelProviderAdapter,
} from "../electron/server/provider-adapters.js";
import { globalRateLimiter } from "../electron/server/rate-limiter.js";

describe("Phase 3: Model Provider Adapters & Real Chat Runtime", () => {
  describe("GeminiAdapter Unit Tests", () => {
    it("rejects invalid or empty key immediately without network call", async () => {
      const adapter = new GeminiAdapter();
      const res = await adapter.testConnection("");
      expect(res.success).toBe(false);
      expect(res.errorMessage).toContain("missing or too short");
    });

    it("verifies connection successfully with valid mock response", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [
            { name: "models/gemini-2.5-flash" },
            { name: "models/gemini-2.5-pro" },
          ],
        }),
      } as any);

      const adapter = new GeminiAdapter();
      const res = await adapter.testConnection("valid-gemini-key-12345");

      expect(res.success).toBe(true);
      expect(res.availableModels).toContain("gemini-2.5-flash");
      expect(res.availableModels).toContain("gemini-2.5-pro");
      expect(fetchSpy).toHaveBeenCalled();
      fetchSpy.mockRestore();
    });

    it("maps 400/403 invalid API key errors accurately", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => ({
          error: { message: "API key not valid. Please pass a valid API key." },
        }),
      } as any);

      const adapter = new GeminiAdapter();
      const res = await adapter.testConnection("invalid-key-12345");

      expect(res.success).toBe(false);
      expect(res.errorMessage).toContain("Invalid Gemini API Key");
      fetchSpy.mockRestore();
    });

    it("generates chat completion and maps content and token counts", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: "Hello! I am Gemini responding." }],
              },
            },
          ],
          usageMetadata: {
            promptTokenCount: 25,
            candidatesTokenCount: 10,
            totalTokenCount: 35,
          },
        }),
      } as any);

      const adapter = new GeminiAdapter();
      const res = await adapter.generateChatResponse("key-12345", {
        model: "gemini-2.5-flash",
        messages: [{ role: "user", content: "Hi!" }],
        systemPrompt: "You are Aiko",
      });

      expect(res.content).toBe("Hello! I am Gemini responding.");
      expect(res.model).toBe("gemini-2.5-flash");
      expect(res.usage?.totalTokens).toBe(35);
      fetchSpy.mockRestore();
    });
  });

  describe("OpenAIAdapter Unit Tests", () => {
    it("verifies connection and extracts gpt-* models", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: "gpt-4o" },
            { id: "gpt-4o-mini" },
            { id: "text-embedding-3" },
          ],
        }),
      } as any);

      const adapter = new OpenAIAdapter();
      const res = await adapter.testConnection("sk-valid-key-12345");

      expect(res.success).toBe(true);
      expect(res.availableModels).toContain("gpt-4o");
      expect(res.availableModels).not.toContain("text-embedding-3");
      fetchSpy.mockRestore();
    });

    it("maps 401 unauthorized error", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: async () => ({
          error: { message: "Incorrect API key provided" },
        }),
      } as any);

      const adapter = new OpenAIAdapter();
      const res = await adapter.testConnection("sk-invalid-key-123");

      expect(res.success).toBe(false);
      expect(res.errorMessage).toContain("Invalid OpenAI API Key");
      fetchSpy.mockRestore();
    });

    it("generates chat completion using OpenAI standard completions format", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: { content: "Greetings from GPT-4o!" },
            },
          ],
          usage: {
            prompt_tokens: 30,
            completion_tokens: 8,
            total_tokens: 38,
          },
        }),
      } as any);

      const adapter = new OpenAIAdapter();
      const res = await adapter.generateChatResponse("sk-key-123", {
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hello!" }],
      });

      expect(res.content).toBe("Greetings from GPT-4o!");
      expect(res.usage?.totalTokens).toBe(38);
      fetchSpy.mockRestore();
    });
  });

  describe("AnthropicAdapter Unit Tests", () => {
    it("verifies connection and extracts claude models", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: "claude-3-5-sonnet-20241022" },
            { id: "claude-3-5-haiku-20241022" },
          ],
        }),
      } as any);

      const adapter = new AnthropicAdapter();
      const res = await adapter.testConnection("sk-ant-valid-key");

      expect(res.success).toBe(true);
      expect(res.availableModels).toContain("claude-3-5-sonnet-20241022");
      fetchSpy.mockRestore();
    });

    it("generates chat completion from Anthropic content blocks", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: "text", text: "Claude response message" }],
          usage: { input_tokens: 15, output_tokens: 5 },
        }),
      } as any);

      const adapter = new AnthropicAdapter();
      const res = await adapter.generateChatResponse("sk-ant-key", {
        model: "claude-3-5-sonnet-20241022",
        messages: [{ role: "user", content: "Tell me a story" }],
        systemPrompt: "You are a companion",
      });

      expect(res.content).toBe("Claude response message");
      expect(res.usage?.totalTokens).toBe(20);
      fetchSpy.mockRestore();
    });
  });

  describe("End-to-End Chat & Provider Service Integration", () => {
    let db: DatabaseSync;
    let server: http.Server;
    let baseUrl: string;
    let fakeAdapter: ModelProviderAdapter;
    let router: ModelProviderRouter;

    beforeEach(async () => {
      globalRateLimiter.clear();
      db = new DatabaseSync(":memory:");
      initSchema(db);

      // Create fake mock adapter for deterministic integration tests
      fakeAdapter = {
        provider: "gemini",
        testConnection: async (key: string) => {
          if (key === "invalid_key") {
            return { success: false, errorMessage: "Simulated invalid key" };
          }
          return {
            success: true,
            availableModels: ["gemini-2.5-flash", "gemini-2.5-pro"],
          };
        },
        generateChatResponse: async (_key, req) => {
          return {
            content: `Echo: You said "${req.messages[req.messages.length - 1]?.content}" (model: ${req.model})`,
            model: req.model,
            usage: { promptTokens: 10, completionTokens: 8, totalTokens: 18 },
          };
        },
      };

      router = new ModelProviderRouter([fakeAdapter]);
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
      await new Promise<void>((resolve) => server.close(() => resolve()));
      db.close();
    });

    async function request(path: string, options: any = {}) {
      const url = `${baseUrl}${path}`;
      const headers: any = {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      };
      if (options.cookie) headers["Cookie"] = options.cookie;

      const res = await fetch(url, {
        method: options.method || "GET",
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      return { status: res.status, headers: res.headers, body: data };
    }

    it("refuses provider test when no key is configured in Hardware Key Vault", async () => {
      const reg = await request("/api/v1/auth/register", {
        method: "POST",
        body: {
          email: "chat_user1@example.com",
          password: "CorrectHorseBatteryStaple123!",
        },
      });
      const cookie = reg.headers.get("set-cookie")!.split(";")[0];

      const testRes = await request("/api/v1/providers/test", {
        method: "POST",
        cookie,
        body: { provider: "gemini" },
      });

      expect(testRes.status).toBe(400);
      expect(testRes.body.error).toBe("no_secret");
    });

    it("executes real connection test using vault key and updates provider status", async () => {
      const reg = await request("/api/v1/auth/register", {
        method: "POST",
        body: {
          email: "chat_user2@example.com",
          password: "CorrectHorseBatteryStaple123!",
        },
      });
      const cookie = reg.headers.get("set-cookie")!.split(";")[0];

      // Save secret
      await request("/api/v1/users/me/secrets", {
        method: "POST",
        cookie,
        body: { provider: "gemini", apiKey: "valid_gemini_api_key_12345" },
      });

      // Test provider connection
      const testRes = await request("/api/v1/providers/test", {
        method: "POST",
        cookie,
        body: { provider: "gemini", selectedModel: "gemini-2.5-flash" },
      });

      expect(testRes.status).toBe(200);
      expect(testRes.body.success).toBe(true);
      expect(testRes.body.availableModels).toContain("gemini-2.5-flash");

      // Verify provider settings were updated in database
      const settingsRes = await request("/api/v1/providers/settings", {
        cookie,
      });
      expect(settingsRes.status).toBe(200);
      const geminiConn = settingsRes.body.connections.find(
        (c: any) => c.provider === "gemini",
      );
      expect(geminiConn.status).toBe("ready");
    });

    it("sends chat message, invokes provider adapter, and persists conversation history", async () => {
      const reg = await request("/api/v1/auth/register", {
        method: "POST",
        body: {
          email: "chat_user3@example.com",
          password: "CorrectHorseBatteryStaple123!",
        },
      });
      const cookie = reg.headers.get("set-cookie")!.split(";")[0];

      // Save secret
      await request("/api/v1/users/me/secrets", {
        method: "POST",
        cookie,
        body: { provider: "gemini", apiKey: "valid_gemini_api_key_12345" },
      });

      // Send Chat Message
      const chatRes = await request("/api/v1/chat/completions", {
        method: "POST",
        cookie,
        body: { message: "Hello Aiko, what is your mission?" },
      });

      expect(chatRes.status).toBe(200);
      expect(chatRes.body.message.role).toBe("assistant");
      expect(chatRes.body.message.content).toContain(
        'Echo: You said "Hello Aiko, what is your mission?"',
      );
      expect(chatRes.body.userMessage.content).toBe(
        "Hello Aiko, what is your mission?",
      );

      // Verify conversation history was persisted to database
      const historyRes = await request("/api/v1/chat/messages", { cookie });
      expect(historyRes.status).toBe(200);
      expect(historyRes.body.messages.length).toBeGreaterThanOrEqual(2);

      const lastUser = historyRes.body.messages.find(
        (m: any) => m.content === "Hello Aiko, what is your mission?",
      );
      expect(lastUser).toBeDefined();

      // Clear chat messages
      const clearRes = await request("/api/v1/chat/clear", {
        method: "POST",
        cookie,
        body: {},
      });
      expect(clearRes.status).toBe(200);

      const afterClear = await request("/api/v1/chat/messages", { cookie });
      expect(afterClear.body.messages.length).toBe(0);
    });
  });
});
