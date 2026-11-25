<script setup lang="ts">
import AppIcon from "./AppIcon.vue";

defineProps<{
  type: "loading" | "empty" | "error" | "not-available";
  title: string;
  description: string;
  actionLabel?: string;
}>();

const emit = defineEmits<{
  (e: "action"): void;
}>();
</script>

<template>
  <div :class="['state-view', `state-${type}`]">
    <div class="state-icon">
      <span v-if="type === 'loading'" class="spinner"></span>
      <AppIcon
        v-else-if="type === 'empty'"
        name="box"
        size="32"
        stroke-width="1.5"
      />
      <AppIcon
        v-else-if="type === 'error'"
        name="alert"
        size="32"
        stroke-width="1.5"
      />
      <AppIcon
        v-else-if="type === 'not-available'"
        name="lock"
        size="32"
        stroke-width="1.5"
      />
    </div>
    <h3 class="state-title">{{ title }}</h3>
    <p class="state-description">{{ description }}</p>
    <button
      v-if="actionLabel"
      id="state-view-action-btn"
      class="state-action-btn"
      @click="emit('action')"
    >
      {{ actionLabel }}
    </button>
  </div>
</template>

<style scoped>
.state-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
  background: var(--glass-surface-strong);
  border: none;
  border-radius: var(--radius-lg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  box-shadow: var(--glass-specular), var(--glass-shadow-sm);
}

.state-icon {
  font-size: 2.5rem;
  margin-bottom: 16px;
  color: var(--text-secondary);
}

.spinner {
  display: inline-block;
  width: 36px;
  height: 36px;
  border: 3px solid var(--border-subtle);
  border-top-color: var(--accent-cyan);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.state-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.state-description {
  font-size: 0.95rem;
  color: var(--text-secondary);
  max-width: 480px;
  margin-bottom: 20px;
}

.state-action-btn {
  padding: 9px 18px;
  background: var(--btn-primary-bg);
  color: var(--btn-primary-text);
  border: none;
  font-weight: 600;
  font-size: 0.875rem;
  border-radius: var(--radius-sm);
  box-shadow: var(--glass-shadow-sm);
  transition: all var(--transition-fast);
}

.state-action-btn:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}
</style>
