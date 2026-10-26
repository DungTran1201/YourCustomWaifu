<script setup lang="ts">
import { ref } from "vue";
import { useAppStore } from "@vrm/app-core";

const store = useAppStore();
const showCreateModal = ref(false);

const newRuleName = ref("");
const newRuleContent = ref("");
const newRuleScope = ref<"global" | "agent">("global");
const newRulePriority = ref(1);

function handleCreateRule() {
  if (!newRuleName.value.trim() || !newRuleContent.value.trim()) return;
  store.addRule({
    name: newRuleName.value.trim(),
    content: newRuleContent.value.trim(),
    scope: newRuleScope.value,
    applicableAgentId:
      newRuleScope.value === "agent" ? store.state.activeAgentId : undefined,
    priority: Number(newRulePriority.value) || 1,
    enabled: true,
  });
  newRuleName.value = "";
  newRuleContent.value = "";
  showCreateModal.value = false;
}
</script>

<template>
  <div class="view-container">
    <div class="section-header">
      <div>
        <h2>Operational Rules & Constraints</h2>
        <p>
          Guardrails, priority order, and scope rules governing companion
          behavior.
        </p>
      </div>

      <button
        id="rules-add-btn"
        class="btn-primary"
        @click="showCreateModal = !showCreateModal"
      >
        {{ showCreateModal ? "Close" : "+ New Rule" }}
      </button>
    </div>

    <!-- Create Rule Form -->
    <div v-if="showCreateModal" class="create-card">
      <h3>Add Behavioral Rule</h3>
      <div class="form-grid">
        <div class="form-group">
          <label>Rule Name</label>
          <input
            id="rule-create-name"
            v-model="newRuleName"
            class="custom-input"
            placeholder="e.g. Do Not Disturb During Meetings"
          />
        </div>
        <div class="form-group">
          <label>Scope</label>
          <select
            id="rule-create-scope"
            v-model="newRuleScope"
            class="custom-input"
          >
            <option value="global">Global (All Agents & App)</option>
            <option value="agent">Agent-Specific (Active Agent)</option>
          </select>
        </div>
        <div class="form-group full-width">
          <label>Rule Statement</label>
          <textarea
            id="rule-create-content"
            v-model="newRuleContent"
            class="custom-textarea"
            rows="3"
            placeholder="Precise constraint the companion must observe..."
          ></textarea>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn-primary" @click="handleCreateRule">Save Rule</button>
      </div>
    </div>

    <!-- Rules List -->
    <div class="rules-list">
      <div v-for="rule in store.state.rules" :key="rule.id" class="rule-card">
        <div class="rule-header">
          <div class="rule-badges">
            <span :class="['scope-pill', rule.scope]">
              {{ rule.scope === "global" ? "Global Scope" : "Agent Specific" }}
            </span>
            <span class="priority-tag">Priority {{ rule.priority }}</span>
          </div>

          <label class="switch">
            <input
              type="checkbox"
              :checked="rule.enabled"
              @change="
                (e) =>
                  store.updateRule(rule.id, {
                    enabled: (e.target as HTMLInputElement).checked,
                  })
              "
            />
            <span class="slider"></span>
          </label>
        </div>

        <h4 class="rule-title">{{ rule.name }}</h4>
        <p class="rule-content">{{ rule.content }}</p>

        <div class="rule-footer">
          <button class="delete-btn" @click="store.deleteRule(rule.id)">
            Remove
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.view-container {
  max-width: 860px;
  margin: 0 auto;
  padding: 40px 24px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.section-header h2 {
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.section-header p {
  color: var(--text-secondary);
}

.btn-primary {
  padding: 8px 18px;
  background: var(--text-primary);
  color: #101114;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  font-weight: 600;
  transition: all var(--transition-fast);
}

.btn-primary:hover {
  background: #ffffff;
}

.create-card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 24px;
  margin-bottom: 24px;
}

.create-card h3 {
  font-size: 1.1rem;
  color: var(--text-primary);
  margin-bottom: 16px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.full-width {
  grid-column: span 2;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.custom-input {
  padding: 9px 12px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 0.875rem;
}

.custom-textarea {
  padding: 10px 12px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-family: var(--font-family-sans);
  font-size: 0.875rem;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.rules-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.rule-card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.rule-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.rule-badges {
  display: flex;
  align-items: center;
  gap: 8px;
}

.scope-pill {
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-weight: 600;
  text-transform: uppercase;
}

.scope-pill.global {
  background: rgba(99, 102, 241, 0.15);
  color: #818cf8;
}

.scope-pill.agent {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid var(--border-default);
  color: var(--text-primary);
}

.priority-tag {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-family: var(--font-family-mono);
}

.rule-title {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--text-primary);
}

.rule-content {
  font-size: 0.875rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

.rule-footer {
  display: flex;
  justify-content: flex-end;
}

.delete-btn {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.delete-btn:hover {
  color: var(--accent-danger);
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
  background-color: var(--text-primary);
}

input:checked + .slider:before {
  transform: translateX(18px);
  background-color: var(--bg-primary);
}
</style>
