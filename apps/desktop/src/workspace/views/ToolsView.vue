<script setup lang="ts">
import { useAppStore } from "@vrm/app-core";
import AppIcon from "../../components/AppIcon.vue";

const store = useAppStore();
</script>

<template>
  <div class="view-container">
    <div class="section-header">
      <div>
        <h2>Agent Tools & Capabilities</h2>
        <p>
          Configured capabilities callable by the companion runtime with strict
          permission isolation.
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
      <div v-for="tool in store.state.tools" :key="tool.id" class="tool-card">
        <div class="tool-header">
          <div class="tool-title-block">
            <span class="tool-category">{{ tool.category }}</span>
            <h4 class="tool-name">{{ tool.name }}</h4>
          </div>

          <label class="switch">
            <input
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

.info-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 18px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  margin-bottom: 24px;
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.info-icon {
  font-size: 1.1rem;
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
  gap: 12px;
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
}

.tool-desc {
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

.tool-meta-tags {
  display: flex;
  align-items: center;
  gap: 20px;
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

.status-val.ready {
  color: #10b981;
  font-weight: 600;
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
