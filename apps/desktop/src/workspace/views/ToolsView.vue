<script setup lang="ts">
import { ref, reactive } from "vue";
import { useAppStore } from "@vrm/app-core";
import type { ToolItem, ToolExecutionResponse } from "@vrm/platform-contracts";
import AppIcon from "../../components/AppIcon.vue";

const store = useAppStore();

const expandedToolId = ref<string | null>(null);
const executingToolId = ref<string | null>(null);
const toolArgs = reactive<Record<string, Record<string, any>>>({});
const toolConfirmations = reactive<Record<string, boolean>>({});
const toolResults = reactive<Record<string, ToolExecutionResponse>>({});

function getToolArgs(toolId: string): Record<string, any> {
  if (!toolArgs[toolId]) {
    toolArgs[toolId] = {};
  }
  return toolArgs[toolId]!;
}

function initArgsForTool(tool: ToolItem) {
  const current = getToolArgs(tool.id);
  if (tool.parameters) {
    for (const [key, param] of Object.entries(tool.parameters)) {
      if (current[key] === undefined) {
        if (param.default !== undefined) {
          current[key] = param.default;
        } else if (param.enum && param.enum.length > 0) {
          current[key] = param.enum[0];
        } else if (param.type === "number") {
          current[key] = 1.0;
        } else if (param.type === "boolean") {
          current[key] = false;
        } else {
          current[key] = "";
        }
      }
    }
  }
}

function toggleTestDrawer(tool: ToolItem) {
  if (expandedToolId.value === tool.id) {
    expandedToolId.value = null;
  } else {
    initArgsForTool(tool);
    expandedToolId.value = tool.id;
  }
}

async function runToolTest(tool: ToolItem) {
  executingToolId.value = tool.id;
  try {
    const args = toolArgs[tool.id] || {};
    const confirmed = Boolean(toolConfirmations[tool.id]);
    const res = await store.executeTool(tool.id, args, confirmed);
    toolResults[tool.id] = res;
  } catch (err: any) {
    toolResults[tool.id] = {
      success: false,
      toolId: tool.id,
      error: {
        code: "execution_failed",
        message: err.message || "Execution request failed",
      },
      executionTimeMs: 0,
    };
  } finally {
    executingToolId.value = null;
  }
}
</script>

<template>
  <div class="view-container">
    <div class="section-header">
      <div>
        <h2>Agent Tools & Capabilities</h2>
        <p>
          Sandboxed companion capabilities with schema validation, permission
          isolation, and execution telemetry.
        </p>
      </div>
    </div>

    <div class="info-banner">
      <AppIcon name="security" size="16" />
      <p>
        Tools are sandboxed and managed directly by the runtime. Terminal, Git,
        and shell execution tools are strictly prohibited.
      </p>
    </div>

    <div class="tools-grid">
      <div
        v-for="tool in store.state.tools"
        :key="tool.id"
        :id="'tool-card-' + tool.id"
        class="tool-card"
      >
        <div class="tool-header">
          <div class="tool-title-block">
            <span class="tool-category">{{ tool.category }}</span>
            <h4 class="tool-name">{{ tool.name }}</h4>
          </div>

          <label
            class="switch"
            :title="tool.enabled ? 'Disable Tool' : 'Enable Tool'"
          >
            <input
              :id="'tool-toggle-' + tool.id"
              type="checkbox"
              :checked="tool.enabled"
              @change="store.toggleTool(tool.id)"
            />
            <span class="slider"></span>
          </label>
        </div>

        <p class="tool-desc">{{ tool.description }}</p>

        <div class="tool-meta-tags">
          <div class="meta-item">
            <span class="meta-label">Permission:</span>
            <span :class="['perm-badge', tool.permissionLevel]">{{
              tool.permissionLevel
            }}</span>
          </div>

          <div class="meta-item">
            <span class="meta-label">Confirmation:</span>
            <span class="meta-val">{{
              tool.requiresConfirmation ? "Required" : "Auto-permitted"
            }}</span>
          </div>

          <div class="meta-item">
            <span class="meta-label">Status:</span>
            <span class="status-val ready">{{ tool.status }}</span>
          </div>

          <div class="meta-actions">
            <button
              :id="'tool-test-btn-' + tool.id"
              class="test-toggle-btn"
              @click="toggleTestDrawer(tool)"
            >
              <AppIcon name="zap" size="13" />
              <span>{{
                expandedToolId === tool.id ? "Close Test" : "Test Execution"
              }}</span>
            </button>
          </div>
        </div>

        <!-- Interactive Testing Harness -->
        <div
          v-if="expandedToolId === tool.id"
          :id="'tool-test-panel-' + tool.id"
          class="test-panel"
        >
          <div class="test-panel-header">
            <span class="panel-title">Interactive Tool Sandbox</span>
            <span v-if="tool.requiresConfirmation" class="confirm-warning">
              Requires User Confirmation Gate
            </span>
          </div>

          <!-- Parameter Inputs -->
          <div
            v-if="tool.parameters && Object.keys(tool.parameters).length > 0"
            class="params-form"
          >
            <div
              v-for="(paramDef, paramKey) in tool.parameters"
              :key="paramKey"
              class="param-row"
            >
              <label class="param-label">
                <span>{{ paramKey }}</span>
                <span v-if="paramDef.required" class="required-star">*</span>
                <span class="param-type-badge">{{ paramDef.type }}</span>
              </label>

              <!-- Enum Dropdown -->
              <select
                v-if="paramDef.enum && paramDef.enum.length > 0"
                v-model="getToolArgs(tool.id)[paramKey]"
                :id="'tool-input-' + tool.id + '-' + paramKey"
                class="param-input select-input"
              >
                <option
                  v-for="opt in paramDef.enum"
                  :key="String(opt)"
                  :value="opt"
                >
                  {{ opt }}
                </option>
              </select>

              <!-- Number Input -->
              <input
                v-else-if="paramDef.type === 'number'"
                type="number"
                v-model.number="getToolArgs(tool.id)[paramKey]"
                :id="'tool-input-' + tool.id + '-' + paramKey"
                step="0.1"
                min="0"
                class="param-input number-input"
              />

              <!-- Boolean Input -->
              <label
                v-else-if="paramDef.type === 'boolean'"
                class="param-checkbox-label"
              >
                <input
                  type="checkbox"
                  v-model="getToolArgs(tool.id)[paramKey]"
                  :id="'tool-input-' + tool.id + '-' + paramKey"
                />
                <span>Enable {{ paramKey }}</span>
              </label>

              <!-- Default Text Input -->
              <input
                v-else
                type="text"
                v-model="getToolArgs(tool.id)[paramKey]"
                :id="'tool-input-' + tool.id + '-' + paramKey"
                :placeholder="paramDef.description"
                class="param-input text-input"
              />

              <span class="param-hint">{{ paramDef.description }}</span>
            </div>
          </div>

          <div v-else class="no-params-hint">
            This tool does not require additional input parameters.
          </div>

          <!-- Confirmation Checkbox Gate -->
          <div class="confirmation-gate-row">
            <label class="confirm-checkbox-label">
              <input
                type="checkbox"
                v-model="toolConfirmations[tool.id]"
                :id="'tool-confirm-check-' + tool.id"
              />
              <span
                >Explicitly grant user confirmation for this invocation</span
              >
            </label>
          </div>

          <!-- Action Button -->
          <div class="test-panel-actions">
            <button
              :id="'tool-exec-btn-' + tool.id"
              class="exec-btn"
              :disabled="executingToolId === tool.id"
              @click="runToolTest(tool)"
            >
              <AppIcon name="zap" size="14" />
              <span>{{
                executingToolId === tool.id
                  ? "Executing..."
                  : "Execute Tool Now"
              }}</span>
            </button>
          </div>

          <!-- Execution Result Output -->
          <div
            v-if="toolResults[tool.id]"
            :id="'tool-result-' + tool.id"
            class="result-container"
          >
            <div class="result-header">
              <span
                :class="[
                  'result-badge',
                  toolResults[tool.id]?.success
                    ? 'badge-success'
                    : 'badge-error',
                ]"
              >
                {{
                  toolResults[tool.id]?.success
                    ? "Success"
                    : "Failed: " + toolResults[tool.id]?.error?.code
                }}
              </span>
              <span class="latency-metric">
                {{ toolResults[tool.id]?.executionTimeMs }}ms
              </span>
            </div>

            <pre class="result-body">{{
              toolResults[tool.id]?.success
                ? JSON.stringify(toolResults[tool.id]?.result, null, 2)
                : toolResults[tool.id]?.error?.message
            }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.view-container {
  width: 100%;
  max-width: 860px;
  margin: 0 auto;
  padding: clamp(20px, 4vw, 40px) clamp(14px, 3vw, 24px);
  box-sizing: border-box;
  min-width: 0;
}

.section-header {
  margin-bottom: 24px;
}

.section-header h2 {
  font-size: clamp(1.35rem, 3vw, 1.8rem);
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.section-header p {
  color: var(--text-secondary);
  font-size: 0.95rem;
}

.info-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px 18px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  margin-bottom: 24px;
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.tools-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

.tool-card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.tool-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.tool-title-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tool-category {
  font-size: 0.7rem;
  color: var(--text-muted);
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.05em;
}

.tool-name {
  font-size: 1.1rem;
  color: var(--text-primary);
  font-weight: 600;
}

.tool-desc {
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.45;
}

.tool-meta-tags {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--border-subtle);
  font-size: 0.8rem;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.meta-label {
  color: var(--text-muted);
}

.perm-badge {
  font-size: 0.75rem;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  font-family: var(--font-family-mono);
}

.perm-badge.user-action {
  color: #22d3ee;
}

.perm-badge.read-only {
  color: #a78bfa;
}

.perm-badge.system {
  color: #f59e0b;
}

.status-val.ready {
  color: #10b981;
  font-weight: 600;
}

.meta-actions {
  margin-left: auto;
}

.test-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-surface);
  color: var(--text-primary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  padding: 5px 12px;
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.test-toggle-btn:hover {
  background: var(--bg-hover);
  border-color: var(--accent-cyan);
  color: var(--accent-cyan);
}

.switch {
  position: relative;
  display: inline-block;
  width: 38px;
  height: 20px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--bg-hover);
  transition: 0.3s;
  border-radius: 20px;
  border: 1px solid var(--border-subtle);
}

.slider:before {
  position: absolute;
  content: "";
  height: 14px;
  width: 14px;
  left: 2px;
  bottom: 2px;
  background-color: var(--text-primary);
  transition: 0.3s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: var(--accent-cyan);
}

input:checked + .slider:before {
  transform: translateX(18px);
  background-color: #000;
}

/* Test Panel Styles */
.test-panel {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  padding: 16px;
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.test-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.panel-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
}

.confirm-warning {
  font-size: 0.72rem;
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.1);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(245, 158, 11, 0.25);
}

.params-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.param-row {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.param-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.required-star {
  color: #ef4444;
}

.param-type-badge {
  font-size: 0.68rem;
  color: var(--text-muted);
  font-family: var(--font-family-mono);
  background: var(--bg-card);
  padding: 1px 4px;
  border-radius: 3px;
  border: 1px solid var(--border-subtle);
}

.param-input {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  padding: 8px 10px;
  font-size: 0.82rem;
  font-family: inherit;
  transition: border-color 0.2s;
}

.param-input:focus {
  border-color: var(--accent-cyan);
  outline: none;
}

.param-checkbox-label,
.confirm-checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  color: var(--text-secondary);
  cursor: pointer;
}

.param-hint {
  font-size: 0.72rem;
  color: var(--text-muted);
}

.no-params-hint {
  font-size: 0.8rem;
  color: var(--text-muted);
  font-style: italic;
}

.confirmation-gate-row {
  padding: 8px 0;
  border-top: 1px dashed var(--border-subtle);
}

.test-panel-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.exec-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--accent-cyan);
  color: #000;
  font-weight: 600;
  font-size: 0.82rem;
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  border: none;
  cursor: pointer;
  transition: opacity 0.2s;
}

.exec-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.result-container {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.result-badge {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
}

.badge-success {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.badge-error {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.latency-metric {
  font-size: 0.72rem;
  font-family: var(--font-family-mono);
  color: var(--text-muted);
}

.result-body {
  margin: 0;
  padding: 8px;
  background: var(--bg-surface);
  border-radius: var(--radius-sm);
  font-family: var(--font-family-mono);
  font-size: 0.75rem;
  color: var(--text-secondary);
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
