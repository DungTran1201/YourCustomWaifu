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

const filteredMemories = computed(() => {
  const q = searchQuery.value.toLowerCase().trim();
  if (!q) return store.state.memories;
  return store.state.memories.filter(
    (m) =>
      m.content.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q),
  );
});

function handleAddMemory() {
  if (!newContent.value.trim()) return;
  store.addMemory(newContent.value.trim(), newCategory.value);
  newContent.value = "";
  showAddModal.value = false;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return "";
  }
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
          @click="store.clearAllMemories()"
        >
          Clear All
        </button>
      </div>
    </div>

    <!-- Privacy Banner -->
    <div class="privacy-card">
      <div class="privacy-icon"><AppIcon name="security" size="20" /></div>
      <div class="privacy-text">
        <h4>Strict Local Privacy Baseline</h4>
        <p>
          Memories are retained in local secure storage. They are only injected
          into companion context during relevant conversations and are never
          shared with unauthorized telemetry or external clouds.
        </p>
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
        <div class="form-group full-width">
          <label>Memory Statement</label>
          <input
            v-model="newContent"
            class="custom-input"
            placeholder="e.g. Prefers answers formatted with concise bullet points"
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
        placeholder="Filter memories by keyword or category..."
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
          <span class="date-tag">{{ formatDate(mem.createdAt) }}</span>
          <span class="confidence-tag"
            >Confidence: {{ Math.round(mem.confidence * 100) }}%</span
          >
        </div>

        <p class="memory-content">{{ mem.content }}</p>

        <div class="memory-footer">
          <button class="delete-btn" @click="store.deleteMemory(mem.id)">
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
  transition: all var(--transition-fast);
}

.btn-primary:hover {
  background: #ffffff;
}

.btn-danger {
  padding: 8px 14px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--radius-sm);
  color: var(--accent-danger);
  font-size: 0.85rem;
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
  grid-template-columns: 1fr;
  gap: 12px;
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
  gap: 12px;
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

.date-tag {
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
}

.memory-footer {
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
</style>
