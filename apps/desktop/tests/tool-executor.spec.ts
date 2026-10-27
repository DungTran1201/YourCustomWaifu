import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import http from "node:http";
import { AuthService } from "../electron/server/auth-service.js";
import { CompanionRepository } from "../electron/server/companion-repository.js";
import { ToolExecutor } from "../electron/server/tool-executor.js";
import { createServer } from "../electron/server/server.js";
import { initSchema } from "../electron/server/database.js";

describe("F08: Tool Registry, Schema Validation & Sandboxed Execution", () => {
  let db: DatabaseSync;
  let authService: AuthService;
  let repo: CompanionRepository;
  let executor: ToolExecutor;
  let userId: string;

  let regToken: string;

  beforeEach(async () => {
    db = new DatabaseSync(":memory:");
    initSchema(db);
    authService = new AuthService(db);
    repo = new CompanionRepository(db);
    executor = new ToolExecutor(repo);

    const regResult = await authService.register(
      "tooluser@example.com",
      "VeryStrongPassphrase123!",
      "Tool Tester",
    );
    userId = regResult.user.id;
    regToken = regResult.sessionToken;
  });

  afterEach(() => {
    db.close();
  });

  describe("Schema Validation & Discovery", () => {
    it("enriches registered tools with schema definitions and parameter contracts", () => {
      const tools = repo.listTools(userId);
      expect(tools.length).toBeGreaterThanOrEqual(3);

      const expressionTool = tools.find((t) =>
        t.name.includes("Expression Engine"),
      );
      expect(expressionTool).toBeDefined();

      const enriched = executor.enrichToolItem(expressionTool!);
      expect(enriched.parameters).toBeDefined();
      expect(enriched.parameters?.expression).toBeDefined();
      expect(enriched.parameters?.expression?.type).toBe("string");
      expect(enriched.parameters?.expression?.required).toBe(true);
      expect(enriched.parameters?.expression?.enum).toContain("happy");
      expect(enriched.parameters?.intensity?.type).toBe("number");
    });

    it("validates required parameters and rejects missing fields", () => {
      const def = executor.getDefinition("avatar_expression");
      expect(def).toBeDefined();

      const validation = executor.validateParameters(def!.parameters, {});
      expect(validation.valid).toBe(false);
      expect(validation.error).toContain(
        "Missing required parameter: 'expression'",
      );
    });

    it("validates parameter types and enum options", () => {
      const def = executor.getDefinition("avatar_expression")!;

      // Wrong type
      const typeCheck = executor.validateParameters(def.parameters, {
        expression: 12345,
      });
      expect(typeCheck.valid).toBe(false);
      expect(typeCheck.error).toContain("must be a string");

      // Invalid enum
      const enumCheck = executor.validateParameters(def.parameters, {
        expression: "unsupported_face",
      });
      expect(enumCheck.valid).toBe(false);
      expect(enumCheck.error).toContain("must be one of");

      // Valid parameters
      const validCheck = executor.validateParameters(def.parameters, {
        expression: "happy",
        intensity: 0.8,
      });
      expect(validCheck.valid).toBe(true);
    });
  });

  describe("Execution Engine & Sandbox Boundaries", () => {
    it("successfully executes Avatar Expression Engine", async () => {
      const tools = repo.listTools(userId);
      const tool = tools.find((t) => t.name.includes("Expression Engine"))!;

      const response = await executor.execute(userId, tool.id, {
        toolId: tool.id,
        args: { expression: "wink", intensity: 0.9 },
      });

      expect(response.success).toBe(true);
      expect(response.error).toBeUndefined();
      expect(response.result).toMatchObject({
        applied: true,
        expression: "wink",
        intensity: 0.9,
      });
      expect(response.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("successfully executes Associative Memory Recall tool", async () => {
      // Seed a memory
      repo.createMemory(userId, {
        category: "preference",
        content: "User loves dark roast coffee in the morning",
        confidence: 0.95,
      });

      const tools = repo.listTools(userId);
      const tool = tools.find((t) => t.name.includes("Memory Recall"))!;

      const response = await executor.execute(userId, tool.id, {
        toolId: tool.id,
        args: { query: "coffee", limit: 3 },
      });

      expect(response.success).toBe(true);
      const result = response.result as any;
      expect(result.count).toBe(1);
      expect(result.memories[0].content).toContain("coffee");
    });

    it("successfully executes Environment Diagnostics tool", async () => {
      const tools = repo.listTools(userId);
      const tool = tools.find((t) => t.name.includes("Diagnostics"))!;

      const response = await executor.execute(userId, tool.id, {
        toolId: tool.id,
        args: { detail: "summary" },
      });

      expect(response.success).toBe(true);
      const result = response.result as any;
      expect(result.platform).toBe(process.platform);
      expect(typeof result.uptimeSeconds).toBe("number");
      expect(typeof result.memoryUsageMb).toBe("number");
    });

    it("rejects unknown tool ID with unknown_tool error", async () => {
      const response = await executor.execute(userId, "non_existent_tool_id", {
        toolId: "non_existent_tool_id",
      });

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe("unknown_tool");
      expect(response.error?.message).toContain("Tool not found");
    });

    it("blocks execution when tool is disabled", async () => {
      const tools = repo.listTools(userId);
      const tool = tools[0]!;

      // Disable tool
      repo.updateTool(userId, tool.id, { enabled: false });

      const response = await executor.execute(userId, tool.id, {
        toolId: tool.id,
        args: { expression: "happy" },
      });

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe("tool_disabled");
      expect(response.error?.message).toContain("disabled");
    });

    it("enforces user confirmation gate for sensitive actions", async () => {
      const tools = repo.listTools(userId);
      const tool = tools.find((t) => t.name.includes("Expression Engine"))!;

      // Mark as requiring confirmation
      repo.updateTool(userId, tool.id, { requiresConfirmation: true });

      // Unconfirmed execution attempt
      const blocked = await executor.execute(userId, tool.id, {
        toolId: tool.id,
        args: { expression: "surprised" },
        confirmed: false,
      });

      expect(blocked.success).toBe(false);
      expect(blocked.error?.code).toBe("confirmation_required");

      // Confirmed execution attempt
      const allowed = await executor.execute(userId, tool.id, {
        toolId: tool.id,
        args: { expression: "surprised" },
        confirmed: true,
      });

      expect(allowed.success).toBe(true);
      expect(allowed.result).toMatchObject({
        applied: true,
        expression: "surprised",
      });
    });

    it("enforces timeout on long-running tool execution", async () => {
      // Register a slow tool
      executor.registerHandler(
        "slow_tool",
        {
          id: "slow_tool",
          name: "Slow Mock Tool",
          description: "Simulates delay",
          category: "System",
          permissionLevel: "system",
          requiresConfirmation: false,
          parameters: {},
        },
        async () => {
          await new Promise((r) => setTimeout(r, 200));
          return { done: true };
        },
      );

      // Create record in DB
      repo.createTool(userId, {
        id: "slow_tool",
        name: "Slow Mock Tool",
        category: "System",
        description: "Simulates delay",
        permissionLevel: "system",
        requiresConfirmation: false,
        enabled: true,
        status: "ready",
      });

      const response = await executor.execute(
        userId,
        "slow_tool",
        { toolId: "slow_tool" },
        { timeoutMs: 50 },
      );

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe("execution_timeout");
      expect(response.error?.message).toContain("timed out after 50ms");
    });
  });

  describe("HTTP API Endpoint /api/v1/tools/:id/execute", () => {
    let server: http.Server;
    let port: number;
    let sessionToken: string;

    beforeEach(async () => {
      sessionToken = regToken;

      server = createServer({ db, toolExecutor: executor });
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
    });

    it("executes tool through authenticated POST endpoint", async () => {
      const tools = repo.listTools(userId);
      const tool = tools.find((t) => t.name.includes("Diagnostics"))!;

      const res = await fetch(
        `http://127.0.0.1:${port}/api/v1/tools/${tool.id}/execute`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            args: { detail: "summary" },
          }),
        },
      );

      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.success).toBe(true);
      expect(data.toolId).toBe(tool.id);
      expect(data.result.platform).toBe(process.platform);
    });

    it("rejects unauthenticated execute request with 401", async () => {
      const res = await fetch(
        `http://127.0.0.1:${port}/api/v1/tools/tool_123/execute`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ args: {} }),
        },
      );

      expect(res.status).toBe(401);
    });
  });
});
