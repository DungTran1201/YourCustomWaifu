import { describe, it, expect, beforeEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import crypto from "node:crypto";
import { initSchema } from "../electron/server/database.js";
import { CompanionRepository } from "../electron/server/companion-repository.js";

describe("Phase 4: Agents, System Prompts, Skills, Rules & Tools", () => {
  let db: DatabaseSync;
  let repo: CompanionRepository;
  let userId: string;

  beforeEach(() => {
    db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys = ON;");
    initSchema(db);
    repo = new CompanionRepository(db);

    userId = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO users (id, email, password_hash, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(userId, "config_test@example.com", "hash", "active", now, now);
    db.prepare(
      "INSERT INTO user_profiles (user_id, display_name, locale, timezone, updated_at) VALUES (?, ?, ?, ?, ?)",
    ).run(userId, "Config User", "en-US", "UTC", now);

    repo.seedDefaultCompanionData(userId);
  });

  describe("Agent & System Prompt Persistence", () => {
    it("persists Agent profile and system instruction edits", () => {
      const active = repo.getActiveAgent(userId);
      expect(active).not.toBeNull();
      expect(active?.name).toBe("Aiko");

      const updated = repo.updateAgent(userId, active!.id, {
        name: "Aiko Custom",
        personality: "Introspective and sharp",
        conversationalStyle: "Direct and scholarly",
        systemInstructions:
          "Provide deep, nuanced answers with step-by-step logic.",
        preferredProvider: "openai",
        preferredModel: "gpt-4o",
      });

      expect(updated.name).toBe("Aiko Custom");
      expect(updated.personality).toBe("Introspective and sharp");
      expect(updated.systemInstructions).toBe(
        "Provide deep, nuanced answers with step-by-step logic.",
      );
      expect(updated.preferredProvider).toBe("openai");
      expect(updated.preferredModel).toBe("gpt-4o");

      // Verify DB persistence
      const reloaded = repo.getAgentById(userId, active!.id);
      expect(reloaded?.name).toBe("Aiko Custom");
      expect(reloaded?.systemInstructions).toBe(
        "Provide deep, nuanced answers with step-by-step logic.",
      );
    });

    it("creates multiple agents and switches active agent selection", () => {
      const agent2 = repo.createAgent(userId, {
        name: "Kuro",
        personality: "Analytical and quiet",
        preferredProvider: "anthropic",
        preferredModel: "claude-3-5-sonnet",
      });

      expect(repo.listAgents(userId).length).toBe(2);

      repo.setActiveAgent(userId, agent2.id);
      expect(repo.getActiveAgent(userId)?.id).toBe(agent2.id);
    });
  });

  describe("Skills Management & Associations", () => {
    it("manages skills CRUD and links to agents", () => {
      const newSkill = repo.createSkill(userId, {
        name: "Code Refactoring",
        category: "Engineering",
        description: "Advises on clean architecture",
        content: "Always check SOLID principles and modular boundaries.",
        enabled: true,
      });

      expect(newSkill.id).toBeDefined();
      expect(
        repo.listSkills(userId).some((s) => s.name === "Code Refactoring"),
      ).toBe(true);

      // Disable skill
      const disabled = repo.updateSkill(userId, newSkill.id, {
        enabled: false,
      });
      expect(disabled.enabled).toBe(false);

      // Associate with agent
      const active = repo.getActiveAgent(userId)!;
      repo.updateAgent(userId, active.id, {
        associatedSkillIds: [...active.associatedSkillIds, newSkill.id],
      });

      const updatedAgent = repo.getAgentById(userId, active.id)!;
      expect(updatedAgent.associatedSkillIds).toContain(newSkill.id);

      // Delete skill
      repo.deleteSkill(userId, newSkill.id);
      expect(repo.getSkillById(userId, newSkill.id)).toBeNull();
    });
  });

  describe("Rules Precedence & Deterministic Ordering", () => {
    it("orders rules by priority and filters by agent scope", () => {
      const active = repo.getActiveAgent(userId)!;

      // Add high-priority agent-specific rule (priority 1)
      const agentRule = repo.createRule(userId, {
        name: "Agent Critical Rule",
        content: "Must speak in formal prose",
        scope: "agent",
        applicableAgentId: active.id,
        priority: 1,
        enabled: true,
      });

      // Add lower-priority global rule (priority 5)
      const globalRule = repo.createRule(userId, {
        name: "Global Rule",
        content: "Always respect system limits",
        scope: "global",
        priority: 5,
        enabled: true,
      });

      // Add a rule for a DIFFERENT agent
      const agentB = repo.createAgent(userId, { name: "Agent B" });
      const otherRule = repo.createRule(userId, {
        name: "Other Agent Rule",
        content: "Only for other agent",
        scope: "agent",
        applicableAgentId: agentB.id,
        priority: 2,
        enabled: true,
      });

      const applicable = repo.listRules(userId, active.id);

      // Must contain agentRule and globalRule, but NOT otherRule
      const ids = applicable.map((r) => r.id);
      expect(ids).toContain(agentRule.id);
      expect(ids).toContain(globalRule.id);
      expect(ids).not.toContain(otherRule.id);

      // Must be ordered by priority ascending (1 before 5)
      const agentRuleIdx = applicable.findIndex((r) => r.id === agentRule.id);
      const globalRuleIdx = applicable.findIndex((r) => r.id === globalRule.id);
      expect(agentRuleIdx).toBeLessThan(globalRuleIdx);
    });

    it("excludes disabled rules from active enforcement", () => {
      const active = repo.getActiveAgent(userId)!;
      const rule = repo.createRule(userId, {
        name: "Disabled Rule",
        content: "Do not execute",
        scope: "global",
        priority: 1,
        enabled: false,
      });

      const all = repo.listRules(userId, active.id);
      const target = all.find((r) => r.id === rule.id);
      expect(target).toBeDefined();
      expect(target?.enabled).toBe(false);

      // Filtering enabled only excludes it
      const enabledOnly = all.filter((r) => r.enabled);
      expect(enabledOnly.some((r) => r.id === rule.id)).toBe(false);
    });
  });

  describe("Tools Registry & Permissions", () => {
    it("manages tool metadata, enablement, and permission levels", () => {
      const tools = repo.listTools(userId);
      expect(tools.length).toBeGreaterThanOrEqual(3);

      const expressionTool = tools.find((t) =>
        t.name.includes("Expression Engine"),
      );
      expect(expressionTool).toBeDefined();
      expect(expressionTool?.permissionLevel).toBe("user-action");
      expect(expressionTool?.requiresConfirmation).toBe(false);

      // Toggle tool enablement
      const toggled = repo.updateTool(userId, expressionTool!.id, {
        enabled: false,
      });
      expect(toggled.enabled).toBe(false);

      // Re-fetch
      const refreshed = repo.getToolById(userId, expressionTool!.id);
      expect(refreshed?.enabled).toBe(false);
    });
  });
});
