import type { DatabaseSync } from "node:sqlite";
import crypto from "node:crypto";
import type {
  AgentProfile,
  SkillItem,
  RuleItem,
  ToolItem,
  ModelConnection,
  MemoryItem,
  ChatMessage,
} from "@vrm/platform-contracts";

export interface CreateMemoryInput {
  category: MemoryItem["category"];
  content: string;
  agentId?: string;
  confidence?: number;
}

export class CompanionRepository {
  constructor(private db: DatabaseSync) {}

  // ==========================================
  // AGENTS
  // ==========================================

  public listAgents(userId: string): AgentProfile[] {
    const rows = this.db
      .prepare(
        `SELECT id, name, description, personality, conversational_style, 
                system_instructions, preferred_provider, preferred_model, 
                behavior_preferences, is_active
         FROM agents WHERE user_id = ? ORDER BY created_at ASC`,
      )
      .all(userId) as any[];

    return rows.map((r) => this.mapAgentRow(userId, r));
  }

  public getAgentById(userId: string, id: string): AgentProfile | null {
    const row = this.db
      .prepare(
        `SELECT id, name, description, personality, conversational_style, 
                system_instructions, preferred_provider, preferred_model, 
                behavior_preferences, is_active
         FROM agents WHERE user_id = ? AND id = ?`,
      )
      .get(userId, id) as any;

    if (!row) return null;
    return this.mapAgentRow(userId, row);
  }

  public getActiveAgent(userId: string): AgentProfile | null {
    const row = this.db
      .prepare(
        `SELECT id, name, description, personality, conversational_style, 
                system_instructions, preferred_provider, preferred_model, 
                behavior_preferences, is_active
         FROM agents WHERE user_id = ? AND is_active = 1 LIMIT 1`,
      )
      .get(userId) as any;

    if (!row) {
      // Fallback to first agent if none marked active
      const first = this.db
        .prepare(
          `SELECT id, name, description, personality, conversational_style, 
                  system_instructions, preferred_provider, preferred_model, 
                  behavior_preferences, is_active
           FROM agents WHERE user_id = ? ORDER BY created_at ASC LIMIT 1`,
        )
        .get(userId) as any;
      if (!first) return null;
      return this.mapAgentRow(userId, first);
    }
    return this.mapAgentRow(userId, row);
  }

  public createAgent(
    userId: string,
    data: Partial<AgentProfile>,
  ): AgentProfile {
    const id = data.id || `agent_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const name = data.name?.trim() || "New Companion";
    const description = data.description || "";
    const personality = data.personality || "";
    const conversationalStyle = data.conversationalStyle || "";
    const systemInstructions = data.systemInstructions || "";
    const preferredProvider = data.preferredProvider || "gemini";
    const preferredModel = data.preferredModel || "gemini-2.5-flash";
    const behaviorPreferences = JSON.stringify(
      data.behaviorPreferences || {
        proactiveEngagement: true,
        memoryRetention: true,
        expressiveness: "standard",
      },
    );

    this.db.exec("BEGIN TRANSACTION;");
    try {
      // Check if this is the first agent for this user
      const countRow = this.db
        .prepare("SELECT COUNT(*) as count FROM agents WHERE user_id = ?")
        .get(userId) as { count: number };
      const isActive = countRow.count === 0 ? 1 : 0;

      this.db
        .prepare(
          `INSERT INTO agents (
            id, user_id, name, description, personality, conversational_style,
            system_instructions, preferred_provider, preferred_model,
            behavior_preferences, is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          userId,
          name,
          description,
          personality,
          conversationalStyle,
          systemInstructions,
          preferredProvider,
          preferredModel,
          behaviorPreferences,
          isActive,
          now,
          now,
        );

      // Associated skills
      if (data.associatedSkillIds && data.associatedSkillIds.length > 0) {
        const stmt = this.db.prepare(
          "INSERT OR IGNORE INTO agent_skills (agent_id, skill_id, created_at) VALUES (?, ?, ?)",
        );
        for (const skillId of data.associatedSkillIds) {
          stmt.run(id, skillId, now);
        }
      }

      // Associated tools
      if (data.associatedToolIds && data.associatedToolIds.length > 0) {
        const stmt = this.db.prepare(
          "INSERT OR IGNORE INTO agent_tools (agent_id, tool_id, created_at) VALUES (?, ?, ?)",
        );
        for (const toolId of data.associatedToolIds) {
          stmt.run(id, toolId, now);
        }
      }

      this.db.exec("COMMIT;");
    } catch (err) {
      this.db.exec("ROLLBACK;");
      throw err;
    }

    return this.getAgentById(userId, id)!;
  }

  public updateAgent(
    userId: string,
    id: string,
    partial: Partial<AgentProfile>,
  ): AgentProfile {
    const existing = this.getAgentById(userId, id);
    if (!existing) {
      throw new Error(`Agent not found: ${id}`);
    }

    const now = new Date().toISOString();
    const name =
      partial.name !== undefined ? partial.name.trim() : existing.name;
    const description =
      partial.description !== undefined
        ? partial.description
        : existing.description;
    const personality =
      partial.personality !== undefined
        ? partial.personality
        : existing.personality;
    const conversationalStyle =
      partial.conversationalStyle !== undefined
        ? partial.conversationalStyle
        : existing.conversationalStyle;
    const systemInstructions =
      partial.systemInstructions !== undefined
        ? partial.systemInstructions
        : existing.systemInstructions;
    const preferredProvider =
      partial.preferredProvider !== undefined
        ? partial.preferredProvider
        : existing.preferredProvider;
    const preferredModel =
      partial.preferredModel !== undefined
        ? partial.preferredModel
        : existing.preferredModel;
    const behaviorPreferences = JSON.stringify(
      partial.behaviorPreferences !== undefined
        ? partial.behaviorPreferences
        : existing.behaviorPreferences,
    );

    this.db.exec("BEGIN TRANSACTION;");
    try {
      this.db
        .prepare(
          `UPDATE agents SET
            name = ?, description = ?, personality = ?, conversational_style = ?,
            system_instructions = ?, preferred_provider = ?, preferred_model = ?,
            behavior_preferences = ?, updated_at = ?
           WHERE user_id = ? AND id = ?`,
        )
        .run(
          name,
          description,
          personality,
          conversationalStyle,
          systemInstructions,
          preferredProvider,
          preferredModel,
          behaviorPreferences,
          now,
          userId,
          id,
        );

      if (partial.associatedSkillIds !== undefined) {
        this.db.prepare("DELETE FROM agent_skills WHERE agent_id = ?").run(id);
        const stmt = this.db.prepare(
          "INSERT OR IGNORE INTO agent_skills (agent_id, skill_id, created_at) VALUES (?, ?, ?)",
        );
        for (const skillId of partial.associatedSkillIds) {
          stmt.run(id, skillId, now);
        }
      }

      if (partial.associatedToolIds !== undefined) {
        this.db.prepare("DELETE FROM agent_tools WHERE agent_id = ?").run(id);
        const stmt = this.db.prepare(
          "INSERT OR IGNORE INTO agent_tools (agent_id, tool_id, created_at) VALUES (?, ?, ?)",
        );
        for (const toolId of partial.associatedToolIds) {
          stmt.run(id, toolId, now);
        }
      }

      this.db.exec("COMMIT;");
    } catch (err) {
      this.db.exec("ROLLBACK;");
      throw err;
    }

    return this.getAgentById(userId, id)!;
  }

  public deleteAgent(userId: string, id: string): void {
    const existing = this.getAgentById(userId, id);
    if (!existing) {
      throw new Error(`Agent not found: ${id}`);
    }

    this.db.exec("BEGIN TRANSACTION;");
    try {
      this.db
        .prepare("DELETE FROM agents WHERE user_id = ? AND id = ?")
        .run(userId, id);

      // If active agent was deleted, set next available agent as active
      const remaining = this.db
        .prepare(
          "SELECT id FROM agents WHERE user_id = ? ORDER BY created_at ASC LIMIT 1",
        )
        .get(userId) as { id: string } | undefined;
      if (remaining) {
        this.db
          .prepare(
            "UPDATE agents SET is_active = 1 WHERE user_id = ? AND id = ?",
          )
          .run(userId, remaining.id);
      }

      this.db.exec("COMMIT;");
    } catch (err) {
      this.db.exec("ROLLBACK;");
      throw err;
    }
  }

  public setActiveAgent(userId: string, id: string): void {
    const existing = this.getAgentById(userId, id);
    if (!existing) {
      throw new Error(`Agent not found: ${id}`);
    }

    this.db.exec("BEGIN TRANSACTION;");
    try {
      this.db
        .prepare("UPDATE agents SET is_active = 0 WHERE user_id = ?")
        .run(userId);
      this.db
        .prepare("UPDATE agents SET is_active = 1 WHERE user_id = ? AND id = ?")
        .run(userId, id);
      this.db.exec("COMMIT;");
    } catch (err) {
      this.db.exec("ROLLBACK;");
      throw err;
    }
  }

  private mapAgentRow(userId: string, row: any): AgentProfile {
    const skillRows = this.db
      .prepare("SELECT skill_id FROM agent_skills WHERE agent_id = ?")
      .all(row.id) as { skill_id: string }[];
    const toolRows = this.db
      .prepare("SELECT tool_id FROM agent_tools WHERE agent_id = ?")
      .all(row.id) as { tool_id: string }[];
    const ruleRows = this.db
      .prepare(
        "SELECT id FROM rules WHERE user_id = ? AND applicable_agent_id = ?",
      )
      .all(userId, row.id) as { id: string }[];

    let behaviorPreferences: any = {
      proactiveEngagement: true,
      memoryRetention: true,
      expressiveness: "standard",
    };
    try {
      if (row.behavior_preferences) {
        behaviorPreferences = JSON.parse(row.behavior_preferences);
      }
    } catch {
      // fallback
    }

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      personality: row.personality,
      conversationalStyle: row.conversational_style,
      systemInstructions: row.system_instructions,
      preferredProvider: row.preferred_provider,
      preferredModel: row.preferred_model,
      associatedSkillIds: skillRows.map((s) => s.skill_id),
      associatedRuleIds: ruleRows.map((r) => r.id),
      associatedToolIds: toolRows.map((t) => t.tool_id),
      behaviorPreferences,
    };
  }

  // ==========================================
  // SKILLS
  // ==========================================

  public listSkills(userId: string): SkillItem[] {
    const rows = this.db
      .prepare(
        "SELECT id, name, description, category, content, enabled FROM skills WHERE user_id = ? ORDER BY created_at ASC",
      )
      .all(userId) as any[];

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      category: r.category,
      content: r.content,
      enabled: Boolean(r.enabled),
    }));
  }

  public getSkillById(userId: string, id: string): SkillItem | null {
    const r = this.db
      .prepare(
        "SELECT id, name, description, category, content, enabled FROM skills WHERE user_id = ? AND id = ?",
      )
      .get(userId, id) as any;

    if (!r) return null;
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      category: r.category,
      content: r.content,
      enabled: Boolean(r.enabled),
    };
  }

  public createSkill(
    userId: string,
    data: Omit<SkillItem, "id"> & { id?: string },
  ): SkillItem {
    const id = data.id || `skill_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const name = data.name.trim();
    if (!name) throw new Error("Skill name cannot be empty");
    if (!data.content) throw new Error("Skill content cannot be empty");

    this.db
      .prepare(
        `INSERT INTO skills (id, user_id, name, description, category, content, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        userId,
        name,
        data.description || "",
        data.category || "General",
        data.content,
        data.enabled ? 1 : 0,
        now,
        now,
      );

    return this.getSkillById(userId, id)!;
  }

  public updateSkill(
    userId: string,
    id: string,
    partial: Partial<SkillItem>,
  ): SkillItem {
    const existing = this.getSkillById(userId, id);
    if (!existing) throw new Error(`Skill not found: ${id}`);

    const now = new Date().toISOString();
    const name =
      partial.name !== undefined ? partial.name.trim() : existing.name;
    const description =
      partial.description !== undefined
        ? partial.description
        : existing.description;
    const category =
      partial.category !== undefined ? partial.category : existing.category;
    const content =
      partial.content !== undefined ? partial.content : existing.content;
    const enabled =
      partial.enabled !== undefined
        ? partial.enabled
          ? 1
          : 0
        : existing.enabled
          ? 1
          : 0;

    this.db
      .prepare(
        `UPDATE skills SET name = ?, description = ?, category = ?, content = ?, enabled = ?, updated_at = ?
         WHERE user_id = ? AND id = ?`,
      )
      .run(name, description, category, content, enabled, now, userId, id);

    return this.getSkillById(userId, id)!;
  }

  public deleteSkill(userId: string, id: string): void {
    const existing = this.getSkillById(userId, id);
    if (!existing) throw new Error(`Skill not found: ${id}`);

    this.db
      .prepare("DELETE FROM skills WHERE user_id = ? AND id = ?")
      .run(userId, id);
  }

  // ==========================================
  // RULES
  // ==========================================

  public listRules(userId: string, agentId?: string): RuleItem[] {
    let query =
      "SELECT id, name, content, scope, applicable_agent_id, priority, enabled FROM rules WHERE user_id = ?";
    const params: any[] = [userId];

    if (agentId) {
      query += " AND (scope = 'global' OR applicable_agent_id = ?)";
      params.push(agentId);
    }
    query += " ORDER BY priority ASC, created_at ASC";

    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      content: r.content,
      scope: r.scope,
      applicableAgentId: r.applicable_agent_id || undefined,
      priority: r.priority,
      enabled: Boolean(r.enabled),
    }));
  }

  public getRuleById(userId: string, id: string): RuleItem | null {
    const r = this.db
      .prepare(
        "SELECT id, name, content, scope, applicable_agent_id, priority, enabled FROM rules WHERE user_id = ? AND id = ?",
      )
      .get(userId, id) as any;

    if (!r) return null;
    return {
      id: r.id,
      name: r.name,
      content: r.content,
      scope: r.scope,
      applicableAgentId: r.applicable_agent_id || undefined,
      priority: r.priority,
      enabled: Boolean(r.enabled),
    };
  }

  public createRule(
    userId: string,
    data: Omit<RuleItem, "id"> & { id?: string },
  ): RuleItem {
    const id = data.id || `rule_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const name = data.name.trim();
    if (!name) throw new Error("Rule name cannot be empty");
    if (!data.content) throw new Error("Rule content cannot be empty");

    this.db
      .prepare(
        `INSERT INTO rules (id, user_id, name, content, scope, applicable_agent_id, priority, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        userId,
        name,
        data.content,
        data.scope || "global",
        data.applicableAgentId || null,
        data.priority || 1,
        data.enabled ? 1 : 0,
        now,
        now,
      );

    return this.getRuleById(userId, id)!;
  }

  public updateRule(
    userId: string,
    id: string,
    partial: Partial<RuleItem>,
  ): RuleItem {
    const existing = this.getRuleById(userId, id);
    if (!existing) throw new Error(`Rule not found: ${id}`);

    const now = new Date().toISOString();
    const name =
      partial.name !== undefined ? partial.name.trim() : existing.name;
    const content =
      partial.content !== undefined ? partial.content : existing.content;
    const scope = partial.scope !== undefined ? partial.scope : existing.scope;
    const applicableAgentId =
      partial.applicableAgentId !== undefined
        ? partial.applicableAgentId || null
        : existing.applicableAgentId || null;
    const priority =
      partial.priority !== undefined ? partial.priority : existing.priority;
    const enabled =
      partial.enabled !== undefined
        ? partial.enabled
          ? 1
          : 0
        : existing.enabled
          ? 1
          : 0;

    this.db
      .prepare(
        `UPDATE rules SET name = ?, content = ?, scope = ?, applicable_agent_id = ?, priority = ?, enabled = ?, updated_at = ?
         WHERE user_id = ? AND id = ?`,
      )
      .run(
        name,
        content,
        scope,
        applicableAgentId,
        priority,
        enabled,
        now,
        userId,
        id,
      );

    return this.getRuleById(userId, id)!;
  }

  public deleteRule(userId: string, id: string): void {
    const existing = this.getRuleById(userId, id);
    if (!existing) throw new Error(`Rule not found: ${id}`);

    this.db
      .prepare("DELETE FROM rules WHERE user_id = ? AND id = ?")
      .run(userId, id);
  }

  // ==========================================
  // TOOLS
  // ==========================================

  public listTools(userId: string): ToolItem[] {
    const rows = this.db
      .prepare(
        "SELECT id, name, description, category, permission_level, requires_confirmation, enabled, status FROM tools WHERE user_id = ? ORDER BY created_at ASC",
      )
      .all(userId) as any[];

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      category: r.category,
      permissionLevel: r.permission_level,
      requiresConfirmation: Boolean(r.requires_confirmation),
      enabled: Boolean(r.enabled),
      status: r.status,
    }));
  }

  public getToolById(userId: string, id: string): ToolItem | null {
    const r = this.db
      .prepare(
        "SELECT id, name, description, category, permission_level, requires_confirmation, enabled, status FROM tools WHERE user_id = ? AND id = ?",
      )
      .get(userId, id) as any;

    if (!r) return null;
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      category: r.category,
      permissionLevel: r.permission_level,
      requiresConfirmation: Boolean(r.requires_confirmation),
      enabled: Boolean(r.enabled),
      status: r.status,
    };
  }

  public createTool(
    userId: string,
    data: Omit<ToolItem, "id"> & { id?: string },
  ): ToolItem {
    const id = data.id || `tool_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const name = data.name.trim();
    if (!name) throw new Error("Tool name cannot be empty");

    this.db
      .prepare(
        `INSERT INTO tools (id, user_id, name, description, category, permission_level, requires_confirmation, enabled, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        userId,
        name,
        data.description || "",
        data.category || "General",
        data.permissionLevel || "read-only",
        data.requiresConfirmation ? 1 : 0,
        data.enabled ? 1 : 0,
        data.status || "ready",
        now,
        now,
      );

    return this.getToolById(userId, id)!;
  }

  public updateTool(
    userId: string,
    id: string,
    partial: Partial<ToolItem>,
  ): ToolItem {
    const existing = this.getToolById(userId, id);
    if (!existing) throw new Error(`Tool not found: ${id}`);

    const now = new Date().toISOString();
    const name =
      partial.name !== undefined ? partial.name.trim() : existing.name;
    const description =
      partial.description !== undefined
        ? partial.description
        : existing.description;
    const category =
      partial.category !== undefined ? partial.category : existing.category;
    const permissionLevel =
      partial.permissionLevel !== undefined
        ? partial.permissionLevel
        : existing.permissionLevel;
    const requiresConfirmation =
      partial.requiresConfirmation !== undefined
        ? partial.requiresConfirmation
          ? 1
          : 0
        : existing.requiresConfirmation
          ? 1
          : 0;
    const enabled =
      partial.enabled !== undefined
        ? partial.enabled
          ? 1
          : 0
        : existing.enabled
          ? 1
          : 0;
    const status =
      partial.status !== undefined ? partial.status : existing.status;

    this.db
      .prepare(
        `UPDATE tools SET name = ?, description = ?, category = ?, permission_level = ?, requires_confirmation = ?, enabled = ?, status = ?, updated_at = ?
         WHERE user_id = ? AND id = ?`,
      )
      .run(
        name,
        description,
        category,
        permissionLevel,
        requiresConfirmation,
        enabled,
        status,
        now,
        userId,
        id,
      );

    return this.getToolById(userId, id)!;
  }

  public deleteTool(userId: string, id: string): void {
    const existing = this.getToolById(userId, id);
    if (!existing) throw new Error(`Tool not found: ${id}`);

    this.db
      .prepare("DELETE FROM tools WHERE user_id = ? AND id = ?")
      .run(userId, id);
  }

  // ==========================================
  // MEMORIES
  // ==========================================

  public listMemories(
    userId: string,
    options: {
      agentId?: string;
      category?: string;
      query?: string;
      limit?: number;
    } = {},
  ): MemoryItem[] {
    let sql =
      "SELECT id, category, content, confidence, last_recalled_at, created_at FROM memories WHERE user_id = ?";
    const params: any[] = [userId];

    if (options.agentId) {
      sql += " AND (agent_id IS NULL OR agent_id = ?)";
      params.push(options.agentId);
    }
    if (options.category) {
      sql += " AND category = ?";
      params.push(options.category);
    }
    if (options.query) {
      sql += " AND content LIKE ?";
      params.push(`%${options.query}%`);
    }

    sql += " ORDER BY created_at DESC";
    if (options.limit && options.limit > 0) {
      sql += " LIMIT ?";
      params.push(options.limit);
    }

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((r) => ({
      id: r.id,
      category: r.category,
      content: r.content,
      confidence: r.confidence,
      lastRecalledAt: r.last_recalled_at || undefined,
      createdAt: r.created_at,
    }));
  }

  public getMemoryById(userId: string, id: string): MemoryItem | null {
    const r = this.db
      .prepare(
        "SELECT id, category, content, confidence, last_recalled_at, created_at FROM memories WHERE user_id = ? AND id = ?",
      )
      .get(userId, id) as any;

    if (!r) return null;
    return {
      id: r.id,
      category: r.category,
      content: r.content,
      confidence: r.confidence,
      lastRecalledAt: r.last_recalled_at || undefined,
      createdAt: r.created_at,
    };
  }

  public createMemory(userId: string, data: CreateMemoryInput): MemoryItem {
    const id = `mem_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const content = data.content.trim();
    if (!content) throw new Error("Memory content cannot be empty");

    this.db
      .prepare(
        `INSERT INTO memories (id, user_id, agent_id, category, content, confidence, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        userId,
        data.agentId || null,
        data.category || "fact",
        content,
        typeof data.confidence === "number" ? data.confidence : 1.0,
        now,
        now,
      );

    return this.getMemoryById(userId, id)!;
  }

  public updateMemory(
    userId: string,
    id: string,
    partial: Partial<MemoryItem>,
  ): MemoryItem {
    const existing = this.getMemoryById(userId, id);
    if (!existing) throw new Error(`Memory not found: ${id}`);

    const now = new Date().toISOString();
    const content =
      partial.content !== undefined ? partial.content.trim() : existing.content;
    const category =
      partial.category !== undefined ? partial.category : existing.category;
    const confidence =
      partial.confidence !== undefined
        ? partial.confidence
        : existing.confidence;

    this.db
      .prepare(
        `UPDATE memories SET content = ?, category = ?, confidence = ?, updated_at = ?
         WHERE user_id = ? AND id = ?`,
      )
      .run(content, category, confidence, now, userId, id);

    return this.getMemoryById(userId, id)!;
  }

  public deleteMemory(userId: string, id: string): void {
    const existing = this.getMemoryById(userId, id);
    if (!existing) throw new Error(`Memory not found: ${id}`);

    this.db
      .prepare("DELETE FROM memories WHERE user_id = ? AND id = ?")
      .run(userId, id);
  }

  public clearAllMemories(userId: string, agentId?: string): void {
    if (agentId) {
      this.db
        .prepare("DELETE FROM memories WHERE user_id = ? AND agent_id = ?")
        .run(userId, agentId);
    } else {
      this.db.prepare("DELETE FROM memories WHERE user_id = ?").run(userId);
    }
  }

  public searchRelevantMemories(
    userId: string,
    query: string,
    agentId?: string,
    limit: number = 5,
  ): MemoryItem[] {
    const terms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2);

    if (terms.length === 0) {
      return this.listMemories(userId, { agentId, limit });
    }

    // Lexical scoring across terms
    const all = this.listMemories(userId, { agentId });
    const scored = all.map((item) => {
      let score = 0;
      const lower = item.content.toLowerCase();
      for (const term of terms) {
        if (lower.includes(term)) {
          score += 1;
        }
      }
      return { item, score };
    });

    const relevant = scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.item);

    // Update last_recalled_at for retrieved items
    if (relevant.length > 0) {
      const now = new Date().toISOString();
      const stmt = this.db.prepare(
        "UPDATE memories SET last_recalled_at = ? WHERE user_id = ? AND id = ?",
      );
      for (const item of relevant) {
        stmt.run(now, userId, item.id);
        item.lastRecalledAt = now;
      }
    }

    return relevant;
  }

  // ==========================================
  // CONVERSATIONS & CHAT MESSAGES
  // ==========================================

  public getOrCreateDefaultConversation(
    userId: string,
    agentId?: string,
  ): { conversationId: string } {
    const row = this.db
      .prepare(
        "SELECT id FROM conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1",
      )
      .get(userId) as { id: string } | undefined;

    if (row) {
      return { conversationId: row.id };
    }

    const id = `conv_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    this.db
      .prepare(
        "INSERT INTO conversations (id, user_id, agent_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(id, userId, agentId || null, "Default Conversation", now, now);

    return { conversationId: id };
  }

  public listMessages(
    userId: string,
    conversationId?: string,
    limit: number = 50,
  ): ChatMessage[] {
    let sql =
      "SELECT id, role, content, status, agent_id, created_at FROM chat_messages WHERE user_id = ?";
    const params: any[] = [userId];

    if (conversationId) {
      sql += " AND conversation_id = ?";
      params.push(conversationId);
    }
    sql += " ORDER BY created_at ASC";
    if (limit > 0) {
      sql += " LIMIT ?";
      params.push(limit);
    }

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((r) => ({
      id: r.id,
      role: r.role,
      content: r.content,
      status: r.status,
      agentId: r.agent_id || undefined,
      timestamp: r.created_at,
    }));
  }

  public addMessage(
    userId: string,
    conversationId: string,
    message: {
      role: ChatMessage["role"];
      content: string;
      agentId?: string;
      status?: ChatMessage["status"];
      id?: string;
      timestamp?: string;
    },
  ): ChatMessage {
    const id = message.id || `msg_${crypto.randomUUID()}`;
    const now = message.timestamp || new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO chat_messages (id, conversation_id, user_id, agent_id, role, content, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        conversationId,
        userId,
        message.agentId || null,
        message.role,
        message.content,
        message.status || "complete",
        now,
      );

    // Touch conversation updated_at
    this.db
      .prepare(
        "UPDATE conversations SET updated_at = ? WHERE id = ? AND user_id = ?",
      )
      .run(now, conversationId, userId);

    return {
      id,
      role: message.role,
      content: message.content,
      status: message.status || "complete",
      agentId: message.agentId,
      timestamp: now,
    };
  }

  public clearMessages(userId: string, conversationId?: string): void {
    if (conversationId) {
      this.db
        .prepare(
          "DELETE FROM chat_messages WHERE user_id = ? AND conversation_id = ?",
        )
        .run(userId, conversationId);
    } else {
      this.db
        .prepare("DELETE FROM chat_messages WHERE user_id = ?")
        .run(userId);
    }
  }

  // ==========================================
  // USER PROVIDER SETTINGS / CONNECTIONS
  // ==========================================

  public listProviderSettings(userId: string): ModelConnection[] {
    const rows = this.db
      .prepare(
        `SELECT provider, selected_model, available_models, status, error_message
         FROM user_provider_settings WHERE user_id = ?`,
      )
      .all(userId) as any[];

    const defaults: Record<
      string,
      { displayName: string; defaultModel: string; available: string[] }
    > = {
      gemini: {
        displayName: "Google Gemini",
        defaultModel: "gemini-2.5-flash",
        available: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
      },
      openai: {
        displayName: "OpenAI GPT",
        defaultModel: "gpt-4o",
        available: ["gpt-4o", "gpt-4o-mini"],
      },
      anthropic: {
        displayName: "Anthropic Claude",
        defaultModel: "claude-3-5-sonnet",
        available: ["claude-3-5-sonnet", "claude-3-5-haiku"],
      },
    };

    const providers: Array<"gemini" | "openai" | "anthropic"> = [
      "gemini",
      "openai",
      "anthropic",
    ];

    return providers.map((provider) => {
      const row = rows.find((r) => r.provider === provider);
      const def = defaults[provider]!;

      let availableModels = def.available;
      if (row?.available_models) {
        try {
          availableModels = JSON.parse(row.available_models);
        } catch {
          // fallback
        }
      }

      return {
        provider,
        displayName: def.displayName,
        status: row?.status || "not_configured",
        selectedModel: row?.selected_model || def.defaultModel,
        availableModels,
        errorMessage: row?.error_message || undefined,
      };
    });
  }

  public saveProviderSettings(
    userId: string,
    connection: {
      provider: "gemini" | "openai" | "anthropic";
      selectedModel: string;
      availableModels?: string[];
      status?: ModelConnection["status"];
      errorMessage?: string;
    },
  ): ModelConnection {
    const now = new Date().toISOString();
    const id = `ups_${crypto.randomUUID()}`;
    const availableModels = JSON.stringify(connection.availableModels || []);

    this.db
      .prepare(
        `INSERT INTO user_provider_settings (id, user_id, provider, selected_model, available_models, status, error_message, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, provider) DO UPDATE SET
           selected_model = excluded.selected_model,
           available_models = CASE WHEN excluded.available_models != '[]' THEN excluded.available_models ELSE user_provider_settings.available_models END,
           status = excluded.status,
           error_message = excluded.error_message,
           updated_at = excluded.updated_at`,
      )
      .run(
        id,
        userId,
        connection.provider,
        connection.selectedModel,
        availableModels,
        connection.status || "configured",
        connection.errorMessage || null,
        now,
      );

    const list = this.listProviderSettings(userId);
    return list.find((c) => c.provider === connection.provider)!;
  }

  // ==========================================
  // INITIAL SEEDING FOR NEW USER
  // ==========================================

  public seedDefaultCompanionData(userId: string): void {
    const existingAgents = this.listAgents(userId);
    if (existingAgents.length > 0) return; // Already seeded

    // 1. Default Skills
    const skillBriefing = this.createSkill(userId, {
      id: `skill_${crypto.randomUUID()}`,
      name: "Daily Briefing",
      category: "Routines",
      description: "Provides a concise morning overview and task summary",
      content: "Check scheduled reminders, weather, and open objectives",
      enabled: true,
    });

    const skillCheckin = this.createSkill(userId, {
      id: `skill_${crypto.randomUUID()}`,
      name: "Attentive Check-in",
      category: "Wellbeing",
      description: "Gently inquires after periods of intense focus",
      content:
        "Offer water/break reminders after 90 minutes of continuous desktop activity",
      enabled: true,
    });

    const skillSummarizer = this.createSkill(userId, {
      id: `skill_${crypto.randomUUID()}`,
      name: "Context Distillation",
      category: "Cognition",
      description: "Condenses lengthy conversations into core memories",
      content: "Extract key user preferences and save to memory store",
      enabled: true,
    });

    // 2. Default Rules
    const ruleConcise = this.createRule(userId, {
      id: `rule_${crypto.randomUUID()}`,
      name: "Restrained & Crisp Replies",
      content:
        "Provide direct, high-value responses without unnecessary filler",
      scope: "agent",
      priority: 1,
      enabled: true,
    });

    this.createRule(userId, {
      id: `rule_${crypto.randomUUID()}`,
      name: "Local Data Primacy",
      content:
        "Never transmit user memories or personal identifiers to unconfigured third parties",
      scope: "global",
      priority: 2,
      enabled: true,
    });

    this.createRule(userId, {
      id: `rule_${crypto.randomUUID()}`,
      name: "Stage Visibility Harmony",
      content:
        "When stage is minimized or user is in focus mode, avoid distracting avatar animations",
      scope: "global",
      priority: 3,
      enabled: true,
    });

    // 3. Default Tools
    const toolExpression = this.createTool(userId, {
      id: `tool_${crypto.randomUUID()}`,
      name: "Avatar Expression Engine",
      category: "Presentation",
      description:
        "Triggers facial expressions and subtle animations on Avatar Stage",
      permissionLevel: "user-action",
      requiresConfirmation: false,
      enabled: true,
      status: "ready",
    });

    const toolRecall = this.createTool(userId, {
      id: `tool_${crypto.randomUUID()}`,
      name: "Associative Memory Recall",
      category: "Context",
      description: "Queries stored long-term preferences and facts",
      permissionLevel: "read-only",
      requiresConfirmation: false,
      enabled: true,
      status: "ready",
    });

    this.createTool(userId, {
      id: `tool_${crypto.randomUUID()}`,
      name: "Environment Diagnostics",
      category: "System",
      description:
        "Inspects desktop OS platform, runtime version, and memory usage",
      permissionLevel: "read-only",
      requiresConfirmation: false,
      enabled: true,
      status: "ready",
    });

    // 4. Default Agent: Aiko
    const aiko = this.createAgent(userId, {
      name: "Aiko",
      description:
        "Personal desktop AI companion and attentive daily assistant",
      personality: "Warm, perceptive, supportive, and subtly playful",
      conversationalStyle: "Natural, direct, caring, and engaging",
      systemInstructions:
        "You are Aiko, the user's dedicated personal companion on their desktop workspace. Respond thoughtfully, remember past context, respect the user's focus, and help with their daily tasks and creative projects.",
      preferredModel: "gemini-2.5-flash",
      preferredProvider: "gemini",
      associatedSkillIds: [
        skillBriefing.id,
        skillCheckin.id,
        skillSummarizer.id,
      ],
      associatedRuleIds: [ruleConcise.id],
      associatedToolIds: [toolExpression.id, toolRecall.id],
      behaviorPreferences: {
        proactiveEngagement: true,
        memoryRetention: true,
        expressiveness: "standard",
      },
    });

    // Link the agent-scoped rule
    this.updateRule(userId, ruleConcise.id, { applicableAgentId: aiko.id });
    this.setActiveAgent(userId, aiko.id);

    // 5. Default Conversation
    this.getOrCreateDefaultConversation(userId, aiko.id);
  }
}
