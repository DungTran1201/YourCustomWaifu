<script setup lang="ts">
import { ref, computed } from "vue";
import { useAppStore } from "@vrm/app-core";

const store = useAppStore();
const searchQuery = ref("");
const showCreateModal = ref(false);

const newSkillName = ref("");
const newSkillCategory = ref("General");
const newSkillDesc = ref("");
const newSkillContent = ref("");

const filteredSkills = computed(() => {
  const q = searchQuery.value.toLowerCase().trim();
  if (!q) return store.state.skills;
  return store.state.skills.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q),
  );
});

function handleCreateSkill() {
  if (!newSkillName.value.trim()) return;
  store.addSkill({
    name: newSkillName.value.trim(),
    category: newSkillCategory.value.trim() || "General",
    description: newSkillDesc.value.trim(),
    content: newSkillContent.value.trim(),
    enabled: true,
  });
  newSkillName.value = "";
  newSkillDesc.value = "";
  newSkillContent.value = "";
  showCreateModal.value = false;
}
</script>

<template>
  <div class="view-container">
    <div class="section-header">
      <div>
        <h2>Skills Library</h2>
        <p>
          Modular capabilities, instructions, and repeatable task behaviors for
          your companion.
        </p>
      </div>

      <button
        id="skills-add-btn"
        class="btn-primary"
        @click="showCreateModal = !showCreateModal"
      >
        {{ showCreateModal ? "Close" : "+ New Skill" }}
      </button>
    </div>

    <!-- Create Skill Form -->
    <div v-if="showCreateModal" class="create-card">
      <h3>Create New Skill</h3>
      <div class="form-grid">
        <div class="form-group">
          <label>Skill Name</label>
          <input
            id="skill-create-name"
            v-model="newSkillName"
            class="custom-input"
            placeholder="e.g. Daily Standup Briefing"
          />
        </div>
        <div class="form-group">
          <label>Category</label>
          <input
            id="skill-create-category"
            v-model="newSkillCategory"
            class="custom-input"
            placeholder="e.g. Productivity"
          />
        </div>
        <div class="form-group full-width">
          <label>Description</label>
          <input
            id="skill-create-desc"
            v-model="newSkillDesc"
            class="custom-input"
            placeholder="Brief description of when this skill applies"
          />
        </div>
        <div class="form-group full-width">
          <label>Skill Instructions & Content</label>
          <textarea
            id="skill-create-content"
            v-model="newSkillContent"
            class="custom-textarea"
            rows="3"
            placeholder="Detailed directives guiding the companion on this capability..."
          ></textarea>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn-primary" @click="handleCreateSkill">
          Save Skill
        </button>
      </div>
    </div>

    <!-- Search bar -->
    <div class="search-bar">
      <input
        id="skills-search-input"
        v-model="searchQuery"
        type="search"
        class="search-input"
        placeholder="Search skills by name, description, or category..."
      />
    </div>

    <!-- Skills List -->
    <div class="skills-grid">
      <div v-for="skill in filteredSkills" :key="skill.id" class="skill-card">
        <div class="skill-header">
          <div class="skill-title-block">
            <span class="category-badge">{{ skill.category }}</span>
            <h4 class="skill-name">{{ skill.name }}</h4>
          </div>

          <label class="switch">
            <input
              type="checkbox"
              :checked="skill.enabled"
              @change="
                (e) =>
                  store.updateSkill(skill.id, {
                    enabled: (e.target as HTMLInputElement).checked,
                  })
              "
            />
            <span class="slider"></span>
          </label>
        </div>

        <p class="skill-desc">{{ skill.description }}</p>

        <div class="skill-content-preview">
          <code>{{ skill.content }}</code>
        </div>

        <div class="skill-footer">
          <button
            class="delete-btn"
            title="Delete Skill"
            @click="store.deleteSkill(skill.id)"
          >
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

.search-bar {
  margin-bottom: 24px;
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

.search-input:focus {
  border-color: var(--border-focus);
}

.skills-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

.skill-card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skill-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.skill-title-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.category-badge {
  font-size: 0.7rem;
  text-transform: uppercase;
  color: var(--accent-cyan);
  font-weight: 600;
  letter-spacing: 0.05em;
}

.skill-name {
  font-size: 1.1rem;
  color: var(--text-primary);
}

.skill-desc {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.skill-content-preview {
  background: var(--bg-surface);
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
  font-size: 0.8rem;
  color: var(--text-muted);
  font-family: var(--font-family-mono);
}

.skill-footer {
  display: flex;
  justify-content: flex-end;
}

.delete-btn {
  font-size: 0.75rem;
  color: var(--text-muted);
  transition: color var(--transition-fast);
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
  background-color: var(--accent-cyan);
}

input:checked + .slider:before {
  transform: translateX(18px);
  background-color: #000;
}
</style>
