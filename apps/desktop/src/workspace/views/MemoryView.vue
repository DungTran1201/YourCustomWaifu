<script setup lang="ts">
import { ref, computed } from "vue";
import { useAppStore } from "@vrm/app-core";
import type { MemoryItem } from "@vrm/platform-contracts";
import AppIcon from "../../components/AppIcon.vue";

const store = useAppStore();
const searchQuery = ref("");
const showAddModal = ref(false);
const newContent = ref("");
const newCategory = ref<MemoryItem["category"]>("fact");
const newScope = ref<"global" | "agent">("global");
const saveNotice = ref<string | null>(null);
const errorMessage = ref<string | null>(null);
const confirmingClearAll = ref(false);
const confirmingDeleteId = ref<string | null>(null);

const activeAgent = computed(() => {
  return (
    store.state.agents.find((a) => a.id === store.state.activeAgentId) ||
    store.state.agents[0]
  );
});

const isMemoryRetentionDisabled = computed(() => {
  return activeAgent.value?.behaviorPreferences?.memoryRetention === false;
});

const filteredMemories = computed(() => {
  const q = searchQuery.value.toLowerCase().trim();
  if (!q) return store.state.memories;
  return store.state.memories.filter(
    (m) =>
      m.content.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q) ||
      (m.agentId && m.agentId.toLowerCase().includes(q)),
  );
});

function handleAddMemory() {
  const content = newContent.value.trim();
  if (!content) {
    errorMessage.value = "Memory content cannot be empty";
    return;
  }
  errorMessage.value = null;
  const targetAgentId =
    newScope.value === "agent" ? activeAgent.value?.id : undefined;

  store.addMemory(content, newCategory.value, targetAgentId);
  newContent.value = "";
  showAddModal.value = false;
  saveNotice.value = "Memory stored securely";
  setTimeout(() => {
    saveNotice.value = null;
  }, 2500);
}

function requestDeleteMemory(id: string) {
  confirmingDeleteId.value = id;
}

function cancelDeleteMemory() {
  confirmingDeleteId.value = null;
}

function executeDeleteMemory(id: string) {
  store.deleteMemory(id);
  confirmingDeleteId.value = null;
  saveNotice.value = "Memory deleted";
  setTimeout(() => {
    saveNotice.value = null;
  }, 2000);
}

function openClearAllModal() {
  confirmingClearAll.value = true;
}

function cancelClearAll() {
  confirmingClearAll.value = false;
}

function executeClearAll() {
  store.clearAllMemories();
  confirmingClearAll.value = false;
  saveNotice.value = "All memories cleared";
  setTimeout(() => {
    saveNotice.value = null;
  }, 2000);
}

function formatDate(iso?: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return "";
  }
}

function getAgentName(agentId?: string): string {
  if (!agentId) return "Global";
  const agent = store.state.agents.find((a) => a.id === agentId);
  return agent ? agent.name : "Agent-Scoped";
}
</script>

<template>
  <div class="view-container">
    <div class="section-header">
      <div>
        <h2>Memory & Privacy Vault</h2>
        <p>
          Inspect, manage, and audit personalized context remembered by your
          companion.
        </p>
      </div>

      <div class="header-actions">
        <button
          id="memory-add-btn"
          class="btn-primary"
          @click="showAddModal = !showAddModal"
        >
          {{ showAddModal ? "Close" : "+ New Memory" }}
        </button>
        <button
          v-if="store.state.memories.length > 0"
          id="memory-clear-all-btn"
          class="btn-danger"
          @click="openClearAllModal"
        >
          Clear All
        </button>
      </div>
    </div>

    <!-- User notices -->
    <div v-if="saveNotice" class="feedback-banner success-banner">
      {{ saveNotice }}
    </div>
    <div v-if="errorMessage" class="feedback-banner error-banner">
      {{ errorMessage }}
    </div>

    <!-- Retention Paused Warning -->
    <div v-if="isMemoryRetentionDisabled" class="retention-warning-card">
      <div class="warning-icon">⚠️</div>
      <div class="warning-text">
        <h4>Memory Retention Paused</h4>
        <p>
          Memory retention is currently turned off for
          <strong>{{ activeAgent?.name || "your active agent" }}</strong
          >. Stored memories will not be retrieved or sent to AI model providers
          during chat.
        </p>
      </div>
    </div>

    <!-- Truthful Privacy Banner (HR-8) -->
    <div class="privacy-card">
      <div class="privacy-icon"><AppIcon name="security" size="20" /></div>
      <div class="privacy-text">
        <h4>Local Storage & Transparent Provider Context</h4>
        <p>
          Memories are stored locally in your private SQLite database on this
          computer. When chatting with a configured AI model provider (such as
          Google Gemini, OpenAI, or Anthropic Claude), relevant retrieved
          memories are included in the request context to personalize your
          companion's responses. You can pause memory retention in Agent
          settings or delete memories below at any time.
        </p>
      </div>
    </div>

    <!-- Clear All Confirmation Modal -->
    <div v-if="confirmingClearAll" class="confirmation-modal-backdrop">
      <div class="confirmation-modal">
        <h3>Clear All Memories?</h3>
        <p>
          Are you sure you want to permanently erase all stored companion
          memories? This action cannot be undone.
        </p>
        <div class="modal-actions">
          <button class="btn-secondary" @click="cancelClearAll">Cancel</button>
          <button
            id="confirm-clear-all-btn"
            class="btn-danger-confirm"
            @click="executeClearAll"
          >
            Yes, Clear All Memories
          </button>
        </div>
      </div>
    </div>

    <!-- Add memory form -->
    <div v-if="showAddModal" class="add-memory-card">
      <h3>Add Explicit Memory</h3>
      <div class="form-grid">
        <div class="form-group">
          <label>Category</label>
          <select v-model="newCategory" class="custom-select">
            <option value="preference">Preference</option>
            <option value="fact">Fact</option>
            <option value="habit">Habit</option>
            <option value="interaction">Interaction</option>
          </select>
        </div>

        <div class="form-group">
          <label>Scope</label>
          <select v-model="newScope" class="custom-select">
            <option value="global">All Agents (Global)</option>
            <option value="agent">
              {{ activeAgent?.name || "Active Agent" }} Only
            </option>
          </select>
        </div>

        <div class="form-group full-width">
          <label>Memory Statement</label>
          <input
            v-model="newContent"
            class="custom-input"
            placeholder="e.g. Prefers answers formatted with concise bullet points"
            @keyup.enter="handleAddMemory"
          />
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn-primary" @click="handleAddMemory">
          Save Memory
        </button>
      </div>
    </div>

    <!-- Search bar -->
    <div class="search-bar">
      <input
        v-model="searchQuery"
        type="search"
        class="search-input"
        placeholder="Filter memories by keyword, category, or scope..."
      />
    </div>

    <!-- Memories List -->
    <div class="memories-list">
      <div v-if="filteredMemories.length === 0" class="empty-card">
        <p>No memory records found.</p>
      </div>

      <div v-for="mem in filteredMemories" :key="mem.id" class="memory-card">
        <div class="memory-meta">
          <span :class="['category-pill', mem.category]">{{
            mem.category
          }}</span>
          <span class="scope-pill">{{ getAgentName(mem.agentId) }}</span>
          <span class="date-tag">Created: {{ formatDate(mem.createdAt) }}</span>
          <span v-if="mem.lastRecalledAt" class="recalled-tag">
            Recalled: {{ formatDate(mem.lastRecalledAt) }}
          </span>
          <span class="confidence-tag">
            Confidence: {{ Math.round(mem.confidence * 100) }}%
          </span>
        </div>

        <p class="memory-content">{{ mem.content }}</p>

        <div class="memory-footer">
          <div
            v-if="confirmingDeleteId === mem.id"
            class="inline-confirm-actions"
          >
            <span class="confirm-prompt">Forget this memory?</span>
            <button
              class="btn-confirm-delete"
              @click="executeDeleteMemory(mem.id)"
            >
              Confirm
            </button>
            <button class="btn-cancel-delete" @click="cancelDeleteMemory">
              Cancel
            </button>
          </div>
          <button
            v-else
            class="delete-btn"
            @click="requestDeleteMemory(mem.id)"
          >
            Forget
          </button>
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
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
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
}

.header-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.btn-primary {
  padding: 8px 18px;
  background: var(--text-primary);
  color: #101114;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-primary:hover {
  background: #ffffff;
}

.btn-secondary {
  padding: 8px 16px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  cursor: pointer;
}

.btn-danger {
  padding: 8px 14px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--radius-sm);
  color: var(--accent-danger);
  font-size: 0.85rem;
  cursor: pointer;
}

.btn-danger:hover {
  background: rgba(239, 68, 68, 0.2);
}

.btn-danger-confirm {
  padding: 8px 16px;
  background: #ef4444;
  border: none;
  border-radius: var(--radius-sm);
  color: #ffffff;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.feedback-banner {
  padding: 10px 16px;
  border-radius: var(--radius-sm);
  margin-bottom: 16px;
  font-size: 0.85rem;
}

.success-banner {
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #10b981;
}

.error-banner {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;
}

.retention-warning-card {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: var(--radius-md);
  padding: 16px 20px;
  margin-bottom: 20px;
}

.warning-icon {
  font-size: 1.3rem;
}

.warning-text h4 {
  color: #f59e0b;
  margin: 0 0 4px 0;
  font-size: 0.95rem;
}

.warning-text p {
  color: var(--text-secondary);
  font-size: 0.85rem;
  margin: 0;
  line-height: 1.4;
}

.privacy-card {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 20px;
  margin-bottom: 24px;
}

.privacy-icon {
  font-size: 1.4rem;
}

.privacy-text h4 {
  color: var(--text-primary);
  margin-bottom: 4px;
}

.privacy-text p {
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

.add-memory-card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 20px;
  margin-bottom: 24px;
}

.add-memory-card h3 {
  font-size: 1.05rem;
  color: var(--text-primary);
  margin-bottom: 14px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group.full-width {
  grid-column: 1 / -1;
}

.form-group label {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.custom-select {
  padding: 8px 12px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 0.85rem;
}

.custom-input {
  padding: 9px 12px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 0.875rem;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 14px;
}

.search-bar {
  margin-bottom: 20px;
}

.search-input {
  width: 100%;
  padding: 10px 16px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 0.9rem;
}

.memories-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty-card {
  padding: 32px;
  text-align: center;
  color: var(--text-muted);
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
}

.memory-card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.memory-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 0.75rem;
}

.category-pill {
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  text-transform: uppercase;
  font-weight: 600;
  font-size: 0.7rem;
}

.category-pill.preference {
  background: rgba(6, 182, 212, 0.15);
  color: #22d3ee;
}

.category-pill.fact {
  background: rgba(99, 102, 241, 0.15);
  color: #818cf8;
}

.category-pill.habit {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
}

.category-pill.interaction {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
}

.scope-pill {
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  background: var(--surface-hover, rgba(255, 255, 255, 0.08));
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  font-size: 0.7rem;
}

.date-tag,
.recalled-tag {
  color: var(--text-muted);
  font-family: var(--font-family-mono);
}

.confidence-tag {
  color: var(--text-muted);
}

.memory-content {
  font-size: 0.9rem;
  color: var(--text-primary);
  line-height: 1.4;
  margin: 4px 0;
}

.memory-footer {
  display: flex;
  justify-content: flex-end;
}

.delete-btn {
  background: transparent;
  border: none;
  font-size: 0.75rem;
  color: var(--text-muted);
  cursor: pointer;
  transition: color 0.2s ease;
}

.delete-btn:hover {
  color: var(--accent-danger);
}

.inline-confirm-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.78rem;
}

.confirm-prompt {
  color: var(--text-secondary);
}

.btn-confirm-delete {
  background: #ef4444;
  color: #ffffff;
  border: none;
  border-radius: 4px;
  padding: 3px 8px;
  font-size: 0.75rem;
  cursor: pointer;
}

.btn-cancel-delete {
  background: transparent;
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 0.75rem;
  cursor: pointer;
}

.confirmation-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.confirmation-modal {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 24px;
  max-width: 440px;
  width: 90%;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
}

.confirmation-modal h3 {
  margin: 0 0 10px 0;
  color: var(--text-primary);
}

.confirmation-modal p {
  color: var(--text-secondary);
  font-size: 0.85rem;
  line-height: 1.5;
  margin: 0 0 20px 0;
}
</style>
