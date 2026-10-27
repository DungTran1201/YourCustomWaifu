import { describe, it, expect, afterEach } from "vitest";
import http from "node:http";
import { DatabaseSync } from "node:sqlite";
import { initSchema } from "../electron/server/database.js";
import { createServer } from "../electron/server/server.js";

describe("Embedded Server Startup, Port Conflict & Health Verification (HARD RULE 6)", () => {
  const activeServers: http.Server[] = [];

  afterEach(async () => {
    while (activeServers.length > 0) {
      const s = activeServers.pop();
      if (s) {
        await new Promise<void>((resolve) => {
          s.close(() => resolve());
        });
      }
    }
  });

  async function verifyRunningAuthServer(port: number): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/health`, {
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) return false;
      const data = (await res.json().catch(() => ({}))) as {
        status?: string;
        version?: string;
      };
      return (
        data &&
        data.status === "healthy" &&
        typeof data.version === "string" &&
        data.version.length > 0
      );
    } catch {
      return false;
    }
  }

  it("verifies health check returns true for authentic YourCustomWaifu service", async () => {
    const db = new DatabaseSync(":memory:");
    initSchema(db);
    const validServer = createServer({ db });
    await new Promise<void>((resolve) => {
      validServer.listen(0, "127.0.0.1", () => resolve());
    });
    activeServers.push(validServer);

    const addr = validServer.address() as { port: number };
    const isHealthy = await verifyRunningAuthServer(addr.port);
    expect(isHealthy).toBe(true);
  });

  it("rejects alien process occupying port without valid health contract", async () => {
    // Simulate an alien process (e.g. unrelated dev server or rogue process)
    const alienServer = http.createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("I am an alien server");
    });
    await new Promise<void>((resolve) => {
      alienServer.listen(0, "127.0.0.1", () => resolve());
    });
    activeServers.push(alienServer);

    const addr = alienServer.address() as { port: number };
    const isHealthy = await verifyRunningAuthServer(addr.port);
    expect(isHealthy).toBe(false);
  });

  it("safely handles alien process returning non-200 on health endpoint", async () => {
    const alienServer = http.createServer((_req, res) => {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not_found" }));
    });
    await new Promise<void>((resolve) => {
      alienServer.listen(0, "127.0.0.1", () => resolve());
    });
    activeServers.push(alienServer);

    const addr = alienServer.address() as { port: number };
    const isHealthy = await verifyRunningAuthServer(addr.port);
    expect(isHealthy).toBe(false);
  });

  it("allocates dynamic port when primary port is occupied by an alien process", async () => {
    // 1. Occupy a port with an alien server
    const alienServer = http.createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<h1>Apache/Nginx/Alien Service</h1>");
    });
    await new Promise<void>((resolve) => {
      alienServer.listen(0, "127.0.0.1", () => resolve());
    });
    activeServers.push(alienServer);

    const alienPort = (alienServer.address() as { port: number }).port;

    // 2. Start our auth service targeting the occupied port
    const db = new DatabaseSync(":memory:");
    initSchema(db);
    const candidateServer = createServer({ db });

    let activeBaseUrl = "";

    await new Promise<void>((resolve) => {
      candidateServer.listen(alienPort, "127.0.0.1", () => {
        // Should not reach here because alienPort is occupied
        resolve();
      });

      candidateServer.on("error", async (err: any) => {
        expect(err.code).toBe("EADDRINUSE");

        // Verify occupied port is not our service
        const isHealthy = await verifyRunningAuthServer(alienPort);
        expect(isHealthy).toBe(false);

        // Fallback to dynamic port 0
        const fallbackServer = createServer({ db });
        fallbackServer.listen(0, "127.0.0.1", () => {
          activeServers.push(fallbackServer);
          const fallbackAddr = fallbackServer.address() as { port: number };
          activeBaseUrl = `http://127.0.0.1:${fallbackAddr.port}`;
          resolve();
        });
      });
    });

    expect(activeBaseUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(activeBaseUrl).not.toBe(`http://127.0.0.1:${alienPort}`);

    // Verify fallback dynamic server is fully responsive and healthy
    const dynamicPort = parseInt(activeBaseUrl.split(":")[2]!, 10);
    const fallbackHealthy = await verifyRunningAuthServer(dynamicPort);
    expect(fallbackHealthy).toBe(true);
  });
});
