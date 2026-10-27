import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import http from "node:http";
import { DatabaseSync } from "node:sqlite";
import { createServer } from "../electron/server/server.js";
import { initSchema } from "../electron/server/database.js";
import {
  useAppStore,
  resolveApiBaseUrl,
  getApiBaseUrl,
} from "../src/stores/store.js";

describe("Network Resilience and Fetch Integrity", () => {
  let server: http.Server;
  let serverPort: number;
  let serverUrl: string;
  let db: DatabaseSync;

  const desktopCorsOrigins = [
    "http://localhost:5173",
    "http://localhost:4173",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:4173",
    "file://",
    "null",
    "vscode-webview://",
    "https://vrm.app",
    "https://app.vrm.app",
  ];

  beforeEach(async () => {
    db = new DatabaseSync(":memory:");
    initSchema(db);
    server = createServer({ db, corsOrigins: desktopCorsOrigins });
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address() as { port: number };
        serverPort = addr.port;
        serverUrl = `http://127.0.0.1:${serverPort}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => {
        db.close();
        resolve();
      });
    });
    vi.restoreAllMocks();
  });

  describe("Dynamic Port and Base URL Discovery", () => {
    it("resolves dynamic API Base URL from desktopAPI when present", async () => {
      const customPortUrl = "http://127.0.0.1:54321";
      (window as any).desktopAPI = {
        getApiBaseUrl: vi.fn().mockResolvedValue(customPortUrl),
      };
      const resolved = await resolveApiBaseUrl();
      expect(resolved).toBe(customPortUrl);
      expect((window as any).desktopAPI.getApiBaseUrl).toHaveBeenCalled();
      delete (window as any).desktopAPI;
    });

    it("provides getApiBaseUrl utility", () => {
      expect(typeof getApiBaseUrl()).toBe("string");
    });
  });

  describe("CORS Handling and Preflight Resilience", () => {
    it("permits preflight OPTIONS for dynamic localhost dev server ports", async () => {
      const res = await fetch(`${serverUrl}/api/v1/agents`, {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:5174",
          "Access-Control-Request-Method": "GET",
          "Access-Control-Request-Headers":
            "Authorization, Content-Type, X-CSRF-Token",
        },
      });

      expect(res.status).toBe(204);
      expect(res.headers.get("access-control-allow-origin")).toBe(
        "http://localhost:5174",
      );
      expect(res.headers.get("access-control-allow-credentials")).toBe("true");
      expect(res.headers.get("access-control-allow-methods")).toContain("GET");
      expect(res.headers.get("access-control-allow-headers")).toContain(
        "Authorization",
      );
    });

    it("permits preflight and GET for file:// origin in desktop environment", async () => {
      const optionsRes = await fetch(`${serverUrl}/api/v1/health`, {
        method: "OPTIONS",
        headers: { Origin: "file://" },
      });
      expect(optionsRes.status).toBe(204);
      expect(optionsRes.headers.get("access-control-allow-origin")).toBe(
        "file://",
      );

      const getRes = await fetch(`${serverUrl}/api/v1/health`, {
        headers: { Origin: "file://" },
      });
      expect(getRes.status).toBe(200);
      expect(getRes.headers.get("access-control-allow-origin")).toBe("file://");
    });

    it("permits preflight for null origin in desktop environment", async () => {
      const optionsRes = await fetch(`${serverUrl}/api/v1/health`, {
        method: "OPTIONS",
        headers: { Origin: "null" },
      });
      expect(optionsRes.status).toBe(204);
      expect(optionsRes.headers.get("access-control-allow-origin")).toBe(
        "null",
      );
    });

    it("rejects unauthorized external origin preflights with 403", async () => {
      const res = await fetch(`${serverUrl}/api/v1/agents`, {
        method: "OPTIONS",
        headers: {
          Origin: "https://unauthorized-malicious-site.com",
        },
      });
      expect(res.status).toBe(403);
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
    });
  });

  describe("Desktop Auth Token Propagation and Companion Data Loading", () => {
    it("returns sessionToken and csrfToken upon registration and enables authorized fetches", async () => {
      const regRes = await fetch(`${serverUrl}/api/v1/auth/desktop-register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "resilience-test@example.com",
          password: "SecurePassword123!@#Test",
          displayName: "Resilience Tester",
          deviceName: "DesktopTestRig",
        }),
      });

      expect(regRes.status).toBe(201);
      const regData = await regRes.json();
      expect(regData.user).toBeDefined();
      expect(regData.user.email).toBe("resilience-test@example.com");
      expect(regData.sessionToken).toBeDefined();
      expect(regData.csrfToken).toBeDefined();

      const sessionToken = regData.sessionToken;

      const agentsRes = await fetch(`${serverUrl}/api/v1/agents`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
      });

      expect(agentsRes.status).toBe(200);
      const agentsData = await agentsRes.json();
      expect(Array.isArray(agentsData.agents)).toBe(true);
      expect(agentsData.agents.length).toBeGreaterThan(0);

      const toolsRes = await fetch(`${serverUrl}/api/v1/tools`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
      });

      expect(toolsRes.status).toBe(200);
      const toolsData = await toolsRes.json();
      expect(Array.isArray(toolsData.tools)).toBe(true);
      expect(toolsData.tools.length).toBeGreaterThan(0);
    });

    it("verifies store deleteAccount executes through apiRequest and terminates session", async () => {
      const store = useAppStore();
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("/api/v1/users/me/delete")) {
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: new Headers({ "content-type": "application/json" }),
          });
        }
        if (url.includes("/api/v1/auth/logout")) {
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: new Headers({ "content-type": "application/json" }),
          });
        }
        return new Response(JSON.stringify({}), {
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
        });
      });
      global.fetch = mockFetch;

      await store.deleteAccount("CurrentPassword123!", "DELETE MY ACCOUNT");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/users/me/delete"),
        expect.objectContaining({
          method: "POST",
        }),
      );
      expect(store.state.user).toBeNull();
      expect(store.state.isAuthenticated).toBe(false);
      expect(store.state.sessionToken).toBeNull();
    });
  });
});
