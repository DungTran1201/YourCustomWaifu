import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { initSchema } from "../electron/server/database.js";
import { CompanionRepository } from "../electron/server/companion-repository.js";

describe("Phase 1: Companion Domain Durable Storage & Migrations", () => {
  let db: DatabaseSync;
  let repo: CompanionRepository;

  beforeEach(() => {
    db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys = ON;");
    initSchema(db);
    repo = new CompanionRepository(db);
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // already closed
    }
  });

  function createTestUser(
    email = `user_${crypto.randomUUID()}@example.com`,
  ): string {
    const userId = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO users (id, email, password_hash, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(userId, email, "dummy_hash", "active", now, now);
    db.prepare(
      "INSERT INTO user_profiles (user_id, display_name, locale, timezone, updated_at) VALUES (?, ?, ?, ?, ?)",
    ).run(userId, "Test User", "en-US", "UTC", now);
    return userId;
  }

  it("initializes fresh database with all tables and schema migrations", () => {
    const migrations = db
      .prepare(
        "SELECT version, name FROM schema_migrations ORDER BY version ASC",
      )
      .all() as { version: number; name: string }[];

    expect(migrations.length).toBe(2);
    expect(migrations[0]?.version).toBe(1);
    expect(migrations[0]?.name).toBe("001_base_auth");
    expect(migrations[1]?.version).toBe(2);
    expect(migrations[1]?.name).toBe("002_companion_domain");

    // Verify key tables exist
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
      )
      .all() as { name: string }[];
    const tableNames = tables.map((t) => t.name);

    expect(tableNames).toContain("users");
    expect(tableNames).toContain("user_profiles");
    expect(tableNames).toContain("sessions");
    expect(tableNames).toContain("user_secrets_vault");
    expect(tableNames).toContain("agents");
    expect(tableNames).toContain("skills");
    expect(tableNames).toContain("agent_skills");
    expect(tableNames).toContain("rules");
    expect(tableNames).toContain("tools");
    expect(tableNames).toContain("agent_tools");
    expect(tableNames).toContain("memories");
    expect(tableNames).toContain("conversations");
    expect(tableNames).toContain("chat_messages");
    expect(tableNames).toContain("user_provider_settings");
  });

  it("upgrades existing database safely while preserving prior user records", () => {
    // 1. Create a simulated legacy database with only Migration 1 tables
    const legacyDb = new DatabaseSync(":memory:");
    legacyDb.exec("PRAGMA foreign_keys = ON;");
    legacyDb.exec(`
      CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
      INSERT INTO schema_migrations (version, name, applied_at) VALUES (1, '001_base_auth', '2026-01-01T00:00:00.000Z');

      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        failed_login_attempts INTEGER NOT NULL DEFAULT 0,
        lockout_until TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE user_profiles (
        user_id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        avatar_url TEXT,
        locale TEXT NOT NULL DEFAULT 'en-US',
        timezone TEXT NOT NULL DEFAULT 'UTC',
        updated_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE user_secrets_vault (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        ciphertext TEXT NOT NULL,
        nonce TEXT NOT NULL,
        tag TEXT NOT NULL,
        key_hint TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(user_id, provider),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // Insert pre-existing user and secret
    const legacyUserId = "legacy_user_123";
    legacyDb
      .prepare(
        "INSERT INTO users (id, email, password_hash, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(
        legacyUserId,
        "existing@waifu.local",
        "hashed_pw_legacy",
        "active",
        "2026-01-01T00:00:00.000Z",
        "2026-01-01T00:00:00.000Z",
      );
    legacyDb
      .prepare(
        "INSERT INTO user_profiles (user_id, display_name, locale, timezone, updated_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(
        legacyUserId,
        "Original Master",
        "en-US",
        "UTC",
        "2026-01-01T00:00:00.000Z",
      );
    legacyDb
      .prepare(
        "INSERT INTO user_secrets_vault (id, user_id, provider, ciphertext, nonce, tag, key_hint, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        "sec_1",
        legacyUserId,
        "gemini",
        "encrypted_cipher",
        "nonce_123",
        "tag_123",
        "...9999",
        "2026-01-01T00:00:00.000Z",
        "2026-01-01T00:00:00.000Z",
      );

    // 2. Run additive upgrade migration
    initSchema(legacyDb);

    // 3. Verify Migration 2 is recorded and existing data is intact
    const migrations = legacyDb
      .prepare("SELECT version FROM schema_migrations ORDER BY version ASC")
      .all() as { version: number }[];
    expect(migrations.map((m) => m.version)).toEqual([1, 2]);

    const user = legacyDb
      .prepare("SELECT email FROM users WHERE id = ?")
      .get(legacyUserId) as { email: string };
    expect(user.email).toBe("existing@waifu.local");

    const secret = legacyDb
      .prepare("SELECT key_hint FROM user_secrets_vault WHERE user_id = ?")
      .get(legacyUserId) as { key_hint: string };
    expect(secret.key_hint).toBe("...9999");

    // 4. Verify companion domain operations now work on the upgraded database
    const upgradedRepo = new CompanionRepository(legacyDb);
    upgradedRepo.seedDefaultCompanionData(legacyUserId);
    const agents = upgradedRepo.listAgents(legacyUserId);
    expect(agents.length).toBeGreaterThan(0);
    expect(agents[0]?.name).toBe("Aiko");

    legacyDb.close();
  });

  it("enforces foreign key constraints on domain tables", () => {
    // Attempting to create an agent with a non-existent user_id must fail
    expect(() => {
      repo.createAgent("non_existent_user_id", {
        name: "Phantom",
      });
    }).toThrow();
  });

  it("cascades deletion of user to all companion domain records", () => {
    const userId = createTestUser();

    // Seed companion data
    repo.seedDefaultCompanionData(userId);
    repo.createMemory(userId, {
      category: "preference",
      content: "Likes clean desktop",
    });

    // Verify records exist
    expect(repo.listAgents(userId).length).toBe(1);
    expect(repo.listSkills(userId).length).toBe(3);
    expect(repo.listRules(userId).length).toBe(3);
    expect(repo.listTools(userId).length).toBe(3);
    expect(repo.listMemories(userId).length).toBe(1);

    // Delete user
    db.prepare("DELETE FROM users WHERE id = ?").run(userId);

    // Verify all domain records were automatically cascaded
    expect(repo.listAgents(userId).length).toBe(0);
    expect(repo.listSkills(userId).length).toBe(0);
    expect(repo.listRules(userId).length).toBe(0);
    expect(repo.listTools(userId).length).toBe(0);
    expect(repo.listMemories(userId).length).toBe(0);

    const convs = db
      .prepare("SELECT COUNT(*) as count FROM conversations WHERE user_id = ?")
      .get(userId) as { count: number };
    expect(convs.count).toBe(0);
  });

  it("enforces strict user isolation across all domain operations", () => {
    const userA = createTestUser();
    const userB = createTestUser();

    // User A creates resources
    const agentA = repo.createAgent(userA, {
      name: "Agent Aiko A",
      personality: "Warm",
    });
    const skillA = repo.createSkill(userA, {
      name: "Skill A",
      category: "Routines",
      description: "Briefing",
      content: "Do A",
      enabled: true,
    });
    const ruleA = repo.createRule(userA, {
      name: "Rule A",
      content: "Follow A",
      scope: "global",
      priority: 1,
      enabled: true,
    });
    const toolA = repo.createTool(userA, {
      name: "Tool A",
      category: "System",
      description: "Inspect A",
      permissionLevel: "read-only",
      requiresConfirmation: false,
      enabled: true,
      status: "ready",
    });
    const memA = repo.createMemory(userA, {
      category: "fact",
      content: "Secret of User A",
    });

    // User B cannot see User A's data
    expect(repo.getAgentById(userB, agentA.id)).toBeNull();
    expect(repo.getSkillById(userB, skillA.id)).toBeNull();
    expect(repo.getRuleById(userB, ruleA.id)).toBeNull();
    expect(repo.getToolById(userB, toolA.id)).toBeNull();
    expect(repo.getMemoryById(userB, memA.id)).toBeNull();

    expect(repo.listAgents(userB).length).toBe(0);
    expect(repo.listSkills(userB).length).toBe(0);
    expect(repo.listRules(userB).length).toBe(0);
    expect(repo.listTools(userB).length).toBe(0);
    expect(repo.listMemories(userB).length).toBe(0);

    // User B cannot delete User A's data
    expect(() => repo.deleteAgent(userB, agentA.id)).toThrow();
    expect(() => repo.deleteSkill(userB, skillA.id)).toThrow();
    expect(() => repo.deleteRule(userB, ruleA.id)).toThrow();
    expect(() => repo.deleteTool(userB, toolA.id)).toThrow();
    expect(() => repo.deleteMemory(userB, memA.id)).toThrow();

    // User A's data remains intact
    expect(repo.getAgentById(userA, agentA.id)).not.toBeNull();
  });

  it("handles agent active selection and updates", () => {
    const userId = createTestUser();
    const agent1 = repo.createAgent(userId, { name: "Agent 1" });
    const agent2 = repo.createAgent(userId, { name: "Agent 2" });

    expect(repo.getActiveAgent(userId)?.id).toBe(agent1.id);

    repo.setActiveAgent(userId, agent2.id);
    expect(repo.getActiveAgent(userId)?.id).toBe(agent2.id);

    repo.updateAgent(userId, agent2.id, {
      personality: "Updated Personality",
      systemInstructions: "New system prompt",
    });
    const updated = repo.getAgentById(userId, agent2.id);
    expect(updated?.personality).toBe("Updated Personality");
    expect(updated?.systemInstructions).toBe("New system prompt");
  });

  it("searches and scores relevant memories with lexical scoring", () => {
    const userId = createTestUser();

    repo.createMemory(userId, {
      category: "preference",
      content: "User prefers dark mode and minimalist desktop layouts",
    });
    repo.createMemory(userId, {
      category: "fact",
      content: "Building TypeScript and Vue desktop applications",
    });
    repo.createMemory(userId, {
      category: "habit",
      content: "Drinks green tea while coding in the morning",
    });

    const results = repo.searchRelevantMemories(
      userId,
      "desktop layouts dark mode",
      undefined,
      2,
    );
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.content).toContain("minimalist desktop layouts");
    expect(results[0]?.lastRecalledAt).toBeDefined();
  });

  it("persists domain data across database close and reopen", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "waifu-db-test-"));
    const tempDbPath = path.join(tempDir, "test.db");

    try {
      // 1. Open and seed
      const fileDb1 = new DatabaseSync(tempDbPath);
      fileDb1.exec("PRAGMA foreign_keys = ON;");
      initSchema(fileDb1);
      const repo1 = new CompanionRepository(fileDb1);

      const userId = "persisted_user_abc";
      const now = new Date().toISOString();
      fileDb1
        .prepare(
          "INSERT INTO users (id, email, password_hash, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run(userId, "persisted@test.local", "hash", "active", now, now);
      fileDb1
        .prepare(
          "INSERT INTO user_profiles (user_id, display_name, locale, timezone, updated_at) VALUES (?, ?, ?, ?, ?)",
        )
        .run(userId, "Persistent User", "en-US", "UTC", now);

      repo1.seedDefaultCompanionData(userId);
      repo1.createMemory(userId, {
        category: "fact",
        content: "Persisted memory across disk reopen",
      });

      fileDb1.close();

      // 2. Reopen and verify
      const fileDb2 = new DatabaseSync(tempDbPath);
      fileDb2.exec("PRAGMA foreign_keys = ON;");
      initSchema(fileDb2);
      const repo2 = new CompanionRepository(fileDb2);

      const agents = repo2.listAgents(userId);
      expect(agents.length).toBe(1);
      expect(agents[0]?.name).toBe("Aiko");

      const memories = repo2.listMemories(userId);
      expect(memories.length).toBe(1);
      expect(memories[0]?.content).toBe("Persisted memory across disk reopen");

      fileDb2.close();
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
