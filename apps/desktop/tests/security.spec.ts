import { describe, it, expect } from "vitest";
import { CSP_HEADER, validateIpcSender } from "../electron/main/security.js";

describe("Desktop Security Invariants", () => {
  it("enforces a strict Content Security Policy restricting script execution and allowing loopback API calls", async () => {
    expect(CSP_HEADER).toContain("default-src 'self'");
    expect(CSP_HEADER).toContain("script-src 'self'");
    expect(CSP_HEADER).not.toContain("'unsafe-eval'");
    expect(CSP_HEADER).toContain("http://localhost:*");
    expect(CSP_HEADER).toContain("http://127.0.0.1:*");

    // Ensure src/index.html has matching connect-src for packaged/local file:// execution
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const indexHtml = await fs.readFile(
      path.resolve(__dirname, "../src/index.html"),
      "utf-8",
    );
    expect(indexHtml).toContain(
      "connect-src 'self' http://localhost:* http://127.0.0.1:*",
    );
  });

  it("rejects IPC events from null or destroyed browser windows", () => {
    const mockSender = { id: 123 } as any;
    expect(validateIpcSender(mockSender, null)).toBe(false);

    const mockDestroyedWindow = {
      isDestroyed: () => true,
      webContents: { id: 123 },
    } as any;
    expect(validateIpcSender(mockSender, mockDestroyedWindow)).toBe(false);
  });

  it("validates IPC events originating from the main window webContents", () => {
    const mockSender = { id: 456 } as any;
    const mockActiveWindow = {
      isDestroyed: () => false,
      webContents: { id: 456 },
    } as any;
    expect(validateIpcSender(mockSender, mockActiveWindow)).toBe(true);

    const mockForeignSender = { id: 789 } as any;
    expect(validateIpcSender(mockForeignSender, mockActiveWindow)).toBe(false);
  });

  it("ensures default server CORS configuration does not allow file://, null, or wildcard with credentials", async () => {
    const { createServer } = await import("../electron/server/server.js");
    const { DatabaseSync } = await import("node:sqlite");
    const { initSchema } = await import("../electron/server/database.js");

    const db = new DatabaseSync(":memory:");
    initSchema(db);
    const server = createServer({ db });
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });

    const addr = server.address() as { port: number };
    const res = await fetch(`http://127.0.0.1:${addr.port}/api/v1/health`, {
      headers: { Origin: "file://" },
    });
    // CORS origin header should not be returned for file://
    expect(res.headers.get("access-control-allow-origin")).toBeNull();

    const resNull = await fetch(`http://127.0.0.1:${addr.port}/api/v1/health`, {
      headers: { Origin: "null" },
    });
    expect(resNull.headers.get("access-control-allow-origin")).toBeNull();

    await new Promise<void>((resolve) => {
      server.close(() => {
        db.close();
        resolve();
      });
    });
  });
});
