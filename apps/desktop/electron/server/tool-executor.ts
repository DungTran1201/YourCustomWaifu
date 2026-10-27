import type {
  MemoryItem,
  ToolDefinition,
  ToolExecutionRequest,
  ToolExecutionResponse,
  ToolItem,
  ToolParameterSchema,
} from "@vrm/platform-contracts";
import type { CompanionRepository } from "./companion-repository";

export interface ToolHandlerContext {
  userId: string;
  tool: ToolItem;
  companionRepo: CompanionRepository;
}

export type ToolHandler = (
  args: Record<string, unknown>,
  context: ToolHandlerContext,
) => Promise<unknown> | unknown;

export const BUILTIN_TOOL_DEFINITIONS = {
  avatar_expression: {
    id: "tool_stage_expression",
    name: "Avatar Expression Engine",
    description:
      "Triggers facial expressions and subtle animations on Avatar Stage",
    category: "Presentation",
    permissionLevel: "user-action",
    requiresConfirmation: false,
    parameters: {
      expression: {
        type: "string",
        description: "Target facial expression",
        required: true,
        enum: [
          "neutral",
          "happy",
          "blink",
          "thinking",
          "surprised",
          "wink",
          "relaxed",
        ],
      },
      intensity: {
        type: "number",
        description: "Weight intensity between 0.0 and 1.0",
        required: false,
        default: 1.0,
      },
    },
  },
  memory_recall: {
    id: "tool_memory_recall",
    name: "Associative Memory Recall",
    description: "Queries stored long-term preferences and facts",
    category: "Context",
    permissionLevel: "read-only",
    requiresConfirmation: false,
    parameters: {
      query: {
        type: "string",
        description: "Search keyword or query phrase",
        required: true,
      },
      limit: {
        type: "number",
        description: "Maximum number of memories to return (1-20)",
        required: false,
        default: 5,
      },
    },
  },
  system_diagnostics: {
    id: "tool_system_diagnostics",
    name: "Environment Diagnostics",
    description:
      "Inspects desktop OS platform, runtime version, and memory usage",
    category: "System",
    permissionLevel: "read-only",
    requiresConfirmation: false,
    parameters: {
      detail: {
        type: "string",
        description: "Detail level: summary or full",
        required: false,
        enum: ["summary", "full"],
        default: "summary",
      },
    },
  },
} satisfies Record<string, ToolDefinition>;

const MAX_RESULT_BYTES = 64 * 1024; // 64 KB
const DEFAULT_TIMEOUT_MS = 5000;

export class ToolExecutor {
  private handlers = new Map<string, ToolHandler>();
  private definitions = new Map<string, ToolDefinition>();
  private companionRepo: CompanionRepository;

  constructor(companionRepo: CompanionRepository) {
    this.companionRepo = companionRepo;
    this.registerBuiltinTools();
  }

  private registerBuiltinTools(): void {
    // 1. Avatar Expression
    this.registerHandler(
      "avatar_expression",
      BUILTIN_TOOL_DEFINITIONS.avatar_expression,
      async (args) => {
        const expression = String(args.expression);
        const intensity =
          typeof args.intensity === "number"
            ? Math.max(0, Math.min(1, args.intensity))
            : 1.0;
        return {
          applied: true,
          expression,
          intensity,
          timestamp: new Date().toISOString(),
        };
      },
    );

    // 2. Memory Recall
    this.registerHandler(
      "memory_recall",
      BUILTIN_TOOL_DEFINITIONS.memory_recall,
      async (args, ctx) => {
        const query = String(args.query).trim();
        const limit =
          typeof args.limit === "number"
            ? Math.max(1, Math.min(20, Math.floor(args.limit)))
            : 5;
        const memories = ctx.companionRepo.listMemories(ctx.userId, {
          query,
          limit,
        });
        return {
          query,
          count: memories.length,
          memories: memories.map((m: MemoryItem) => ({
            id: m.id,
            category: m.category,
            content: m.content,
            confidence: m.confidence,
          })),
        };
      },
    );

    // 3. System Diagnostics
    this.registerHandler(
      "system_diagnostics",
      BUILTIN_TOOL_DEFINITIONS.system_diagnostics,
      async (args) => {
        const detail = args.detail === "full" ? "full" : "summary";
        const mem = process.memoryUsage();
        const baseInfo = {
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version,
          uptimeSeconds: Math.floor(process.uptime()),
          memoryUsageMb: Math.round(mem.heapUsed / 1024 / 1024),
        };

        if (detail === "full") {
          return {
            ...baseInfo,
            heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
            rssMb: Math.round(mem.rss / 1024 / 1024),
            cpuCount: require("os").cpus()?.length || 1,
          };
        }
        return baseInfo;
      },
    );
  }

  public registerHandler(
    key: string,
    definition: ToolDefinition,
    handler: ToolHandler,
  ): void {
    this.definitions.set(key, definition);
    this.definitions.set(definition.id, definition);
    this.definitions.set(definition.name.toLowerCase(), definition);

    this.handlers.set(key, handler);
    this.handlers.set(definition.id, handler);
    this.handlers.set(definition.name.toLowerCase(), handler);
  }

  public getDefinition(toolNameOrId: string): ToolDefinition | undefined {
    return (
      this.definitions.get(toolNameOrId) ||
      this.definitions.get(toolNameOrId.toLowerCase())
    );
  }

  public enrichToolItem(tool: ToolItem): ToolItem {
    const def = this.getDefinition(tool.id) || this.getDefinition(tool.name);
    if (def) {
      return {
        ...tool,
        parameters: def.parameters,
      };
    }
    return tool;
  }

  public validateParameters(
    schema: Record<string, ToolParameterSchema>,
    args: Record<string, unknown>,
  ): { valid: boolean; error?: string } {
    for (const [paramName, paramDef] of Object.entries(schema)) {
      const val = args[paramName];

      if (val === undefined || val === null) {
        if (paramDef.required) {
          return {
            valid: false,
            error: `Missing required parameter: '${paramName}'`,
          };
        }
        continue;
      }

      // Type check
      if (paramDef.type === "string" && typeof val !== "string") {
        return {
          valid: false,
          error: `Parameter '${paramName}' must be a string`,
        };
      }
      if (paramDef.type === "number") {
        if (typeof val !== "number" || Number.isNaN(val)) {
          return {
            valid: false,
            error: `Parameter '${paramName}' must be a valid number`,
          };
        }
      }
      if (paramDef.type === "boolean" && typeof val !== "boolean") {
        return {
          valid: false,
          error: `Parameter '${paramName}' must be a boolean`,
        };
      }
      if (paramDef.type === "array" && !Array.isArray(val)) {
        return {
          valid: false,
          error: `Parameter '${paramName}' must be an array`,
        };
      }
      if (
        paramDef.type === "object" &&
        (typeof val !== "object" || Array.isArray(val) || val === null)
      ) {
        return {
          valid: false,
          error: `Parameter '${paramName}' must be an object`,
        };
      }

      // Enum check
      if (paramDef.enum && !paramDef.enum.includes(val as any)) {
        return {
          valid: false,
          error: `Parameter '${paramName}' must be one of: [${paramDef.enum.join(", ")}]`,
        };
      }
    }

    return { valid: true };
  }

  public async execute(
    userId: string,
    toolId: string,
    request: ToolExecutionRequest,
    options?: { timeoutMs?: number },
  ): Promise<ToolExecutionResponse> {
    const startTime = Date.now();
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const args = request.args || {};

    // 1. Resolve Tool Record
    let toolRecord: ToolItem | null = this.companionRepo.getToolById(
      userId,
      toolId,
    );

    if (!toolRecord) {
      // Fallback matching by name
      const userTools = this.companionRepo.listTools(userId);
      toolRecord =
        userTools.find(
          (t) =>
            t.id === toolId ||
            t.name.toLowerCase() === toolId.toLowerCase() ||
            this.definitions.get(toolId)?.name.toLowerCase() ===
              t.name.toLowerCase(),
        ) || null;
    }

    if (!toolRecord) {
      return {
        success: false,
        toolId,
        error: {
          code: "unknown_tool",
          message: `Tool not found or not registered for this user: '${toolId}'`,
        },
        executionTimeMs: Date.now() - startTime,
      };
    }

    // 2. Check Tool Enabled State
    if (!toolRecord.enabled) {
      return {
        success: false,
        toolId,
        error: {
          code: "tool_disabled",
          message: `Tool '${toolRecord.name}' is disabled`,
        },
        executionTimeMs: Date.now() - startTime,
      };
    }

    // 3. Check Explicit Confirmation Gate
    if (toolRecord.requiresConfirmation && !request.confirmed) {
      return {
        success: false,
        toolId,
        error: {
          code: "confirmation_required",
          message: `Tool '${toolRecord.name}' requires explicit user confirmation before execution`,
        },
        executionTimeMs: Date.now() - startTime,
      };
    }

    // 4. Resolve Handler & Definition
    const def =
      this.getDefinition(toolRecord.id) ||
      this.getDefinition(toolRecord.name) ||
      this.getDefinition(toolId);

    const handler =
      this.handlers.get(toolRecord.id) ||
      this.handlers.get(toolRecord.name.toLowerCase()) ||
      this.handlers.get(toolId);

    if (!handler || !def) {
      return {
        success: false,
        toolId,
        error: {
          code: "unknown_tool",
          message: `No executable handler registered for tool: '${toolRecord.name}'`,
        },
        executionTimeMs: Date.now() - startTime,
      };
    }

    // 5. Schema Validation
    const validation = this.validateParameters(def.parameters, args);
    if (!validation.valid) {
      return {
        success: false,
        toolId,
        error: {
          code: "invalid_arguments",
          message: validation.error || "Invalid tool parameters",
        },
        executionTimeMs: Date.now() - startTime,
      };
    }

    // 6. Execute Handler with Timeout
    const context: ToolHandlerContext = {
      userId,
      tool: toolRecord,
      companionRepo: this.companionRepo,
    };

    try {
      const executionPromise = Promise.resolve(handler(args, context));
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error(`EXECUTION_TIMEOUT_${timeoutMs}`)),
          timeoutMs,
        );
      });

      const result = await Promise.race([executionPromise, timeoutPromise]);

      // 7. Output Size Boundary Check
      const serialized = JSON.stringify(result);
      if (serialized && serialized.length > MAX_RESULT_BYTES) {
        return {
          success: false,
          toolId,
          error: {
            code: "execution_failed",
            message: `Tool output exceeded maximum size limit of ${MAX_RESULT_BYTES} bytes`,
          },
          executionTimeMs: Date.now() - startTime,
        };
      }

      return {
        success: true,
        toolId,
        result,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (err: any) {
      const executionTimeMs = Date.now() - startTime;
      if (err.message && err.message.startsWith("EXECUTION_TIMEOUT_")) {
        return {
          success: false,
          toolId,
          error: {
            code: "execution_timeout",
            message: `Tool execution timed out after ${timeoutMs}ms`,
          },
          executionTimeMs,
        };
      }

      return {
        success: false,
        toolId,
        error: {
          code: "execution_failed",
          message:
            err.message || "Tool execution encountered an unexpected error",
        },
        executionTimeMs,
      };
    }
  }
}
