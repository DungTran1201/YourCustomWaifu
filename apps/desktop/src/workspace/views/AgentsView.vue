<script setup lang="ts">
import { ref, computed } from "vue";
import { useAppStore } from "@vrm/app-core";
import type { AgentProfile } from "@vrm/platform-contracts";

const store = useAppStore();

const defaultAgent: AgentProfile = {
  id: "agent_aiko",
  name: "Aiko",
  description: "Personal desktop AI companion and attentive daily assistant",
  personality: "Warm, perceptive, supportive, and subtly playful",
  conversationalStyle: "Natural, direct, caring, and engaging",
  systemInstructions:
    "You are Aiko, the user's dedicated personal companion on their desktop workspace.",
  preferredModel: "gemini-2.5-flash",
  preferredProvider: "gemini",
  associatedSkillIds: ["skill_daily_briefing"],
  associatedRuleIds: ["rule_concise"],
  associatedToolIds: ["tool_stage_expression"],
  behaviorPreferences: {
    proactiveEngagement: true,
    memoryRetention: true,
    expressiveness: "standard",
  },
};

const activeAgent = computed<AgentProfile>(() => {
  return (
    store.state.agents.find((a) => a.id === store.state.activeAgentId) ||
    store.state.agents[0] ||
    defaultAgent
  );
});

const isEditing = ref(false);
const editForm = ref<AgentProfile>({ ...activeAgent.value });
const saveNotice = ref<string | null>(null);
const showPromptPreview = ref(false);

const effectivePromptPreview = computed(() => {
  const parts = [
    `You are ${editForm.value.name}, an attentive personal desktop AI companion.`,
    `Personality: ${editForm.value.personality}. Conversational Style: ${editForm.value.conversationalStyle}.`,
  ];
  if (editForm.value.systemInstructions) {
    parts.push(`Instructions: ${editForm.value.systemInstructions}`);
  }
  const enabledRules = store.state.rules.filter(
    (r) =>
      r.enabled &&
      (r.scope === "global" || r.applicableAgentId === activeAgent.value.id),
  );
  if (enabledRules.length > 0) {
    parts.push(
      `Operational Rules to obey:\n` +
        enabledRules.map((r) => `- [${r.name}] ${r.content}`).join("\n"),
    );
  }
  const enabledSkills = store.state.skills.filter(
    (s) => s.enabled && editForm.value.associatedSkillIds?.includes(s.id),
  );
  if (enabledSkills.length > 0) {
    parts.push(
      `Active Skills:\n` +
        enabledSkills.map((s) => `- [${s.name}] ${s.content}`).join("\n"),
    );
  }
  return parts.join("\n\n");
});

function startEditing() {
  editForm.value = { ...activeAgent.value };
  isEditing.value = true;
  saveNotice.value = null;
}

function cancelEditing() {
  isEditing.value = false;
  editForm.value = { ...activeAgent.value };
}

function saveAgent() {
  store.updateAgent(activeAgent.value.id, { ...editForm.value });
  isEditing.value = false;
  saveNotice.value = "Agent configuration updated successfully";
  setTimeout(() => {
    saveNotice.value = null;
  }, 3000);
}
</script>

<template>
  <div class="view-container">
    <div class="section-header">
      <div>
        <h2>Personal AI Agent Profile</h2>
        <p>
          Define your companion's identity, conversational temperament, and
          system guidance.
        </p>
      </div>

      <div class="header-actions">
        <button
          v-if="!isEditing"
          id="agent-edit-btn"
          class="btn-primary"
          @click="startEditing"
        >
          Edit Agent
        </button>
        <template v-else>
          <button
            id="agent-cancel-btn"
            class="btn-secondary"
            @click="cancelEditing"
          >
            Cancel
          </button>
          <button id="agent-save-btn" class="btn-primary" @click="saveAgent">
            Save Changes
          </button>
        </template>
      </div>
    </div>

    <div v-if="saveNotice" class="success-notice">
      {{ saveNotice }}
    </div>

    <!-- Agent Identity Card -->
    <div class="card">
      <h3 class="card-title">Identity & Persona</h3>

      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Companion Name</label>
          <input
            id="agent-name-input"
            v-model="editForm.name"
            class="custom-input"
            :disabled="!isEditing"
          />
        </div>

        <div class="form-group">
          <label class="form-label">Personality Tone</label>
          <input
            id="agent-personality-input"
            v-model="editForm.personality"
            class="custom-input"
            :disabled="!isEditing"
          />
        </div>

        <div class="form-group full-width">
          <label class="form-label">Short Description</label>
          <input
            id="agent-desc-input"
            v-model="editForm.description"
            class="custom-input"
            :disabled="!isEditing"
          />
        </div>

        <div class="form-group full-width">
          <label class="form-label">Conversational Style</label>
          <input
            id="agent-style-input"
            v-model="editForm.conversationalStyle"
            class="custom-input"
            :disabled="!isEditing"
          />
        </div>
      </div>
    </div>

    <!-- System Instructions -->
    <div class="card">
      <h3 class="card-title">System Guidance & Directives</h3>
      <p class="card-desc">
        Core background instructions guiding tone, safety constraints, and daily
        interaction.
      </p>

      <textarea
        id="agent-instructions-textarea"
        v-model="editForm.systemInstructions"
        class="custom-textarea"
        rows="5"
        :disabled="!isEditing"
      ></textarea>

      <div class="prompt-meta-row">
        <span class="char-count">
          {{ editForm.systemInstructions.length }} characters (~{{
            Math.round(editForm.systemInstructions.length / 4)
          }}
          tokens)
        </span>
        <button
          type="button"
          class="btn-preview-toggle"
          @click="showPromptPreview = !showPromptPreview"
        >
          {{ showPromptPreview ? "Hide Preview" : "Preview Effective Prompt" }}
        </button>
      </div>

      <div v-if="showPromptPreview" class="prompt-preview-box">
        <h4 class="preview-title">Effective Instruction Composition Preview</h4>
        <pre class="preview-content">{{ effectivePromptPreview }}</pre>
      </div>
    </div>

    <!-- Behavior Preferences -->
    <div class="card">
      <h3 class="card-title">Behavioral Preferences</h3>

      <div class="toggle-row">
        <div class="toggle-info">
          <strong>Proactive Engagement</strong>
          <span
            >Allows companion to initiate daily check-ins and contextual
            suggestions</span
          >
        </div>
        <input
          id="agent-proactive-toggle"
          type="checkbox"
          :checked="editForm.behaviorPreferences.proactiveEngagement"
          :disabled="!isEditing"
          @change="
            (e) =>
              (editForm.behaviorPreferences.proactiveEngagement = (
                e.target as HTMLInputElement
              ).checked)
          "
        />
      </div>

      <div class="toggle-row">
        <div class="toggle-info">
          <strong>Local Memory Retention</strong>
          <span
            >Permits saving preferences and facts to the local memory
            store</span
          >
        </div>
        <input
          id="agent-memory-toggle"
          type="checkbox"
          :checked="editForm.behaviorPreferences.memoryRetention"
          :disabled="!isEditing"
          @change="
            (e) =>
              (editForm.behaviorPreferences.memoryRetention = (
                e.target as HTMLInputElement
              ).checked)
          "
        />
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
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  margin-bottom: 28px;
}

.section-header h2 {
  font-size: clamp(1.35rem, 3vw, 1.8rem);
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.section-header p {
  color: var(--text-secondary);
}

.header-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
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

.btn-secondary {
  padding: 8px 18px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 0.85rem;
  font-weight: 500;
}

.success-notice {
  padding: 12px 18px;
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #10b981;
  border-radius: var(--radius-md);
  margin-bottom: 24px;
  font-size: 0.85rem;
}

.card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 24px;
  margin-bottom: 24px;
}

.card-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.card-desc {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-bottom: 16px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 16px;
}

.full-width {
  grid-column: span 2;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 0.825rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.custom-input {
  padding: 9px 14px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 0.9rem;
}

.custom-input:focus {
  border-color: var(--border-focus);
}

.custom-input:disabled {
  opacity: 0.7;
}

.custom-textarea {
  width: 100%;
  padding: 12px 14px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-family: var(--font-family-sans);
  font-size: 0.9rem;
  line-height: 1.5;
  resize: vertical;
}

.custom-textarea:focus {
  border-color: var(--border-focus);
}

.custom-textarea:disabled {
  opacity: 0.7;
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 0;
  border-bottom: 1px solid var(--border-subtle);
}

.toggle-row:last-child {
  border-bottom: none;
}

.toggle-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.toggle-info strong {
  font-size: 0.9rem;
  color: var(--text-primary);
}

.toggle-info span {
  font-size: 0.8rem;
  color: var(--text-muted);
}

@media (max-width: 680px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
  .full-width {
    grid-column: span 1;
  }
  .toggle-row {
    flex-wrap: wrap;
    gap: 10px;
  }
}

.prompt-meta-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.btn-preview-toggle {
  background: transparent;
  border: 1px solid var(--border-subtle);
  color: var(--accent);
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 0.78rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-preview-toggle:hover {
  background: var(--surface-hover);
  border-color: var(--accent);
}

.prompt-preview-box {
  margin-top: 12px;
  padding: 12px;
  background: var(--bg-alt, rgba(0, 0, 0, 0.2));
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
}

.preview-title {
  margin: 0 0 8px 0;
  font-size: 0.85rem;
  color: var(--text-primary);
  font-weight: 600;
}

.preview-content {
  margin: 0;
  font-size: 0.8rem;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  line-height: 1.5;
}
</style>
