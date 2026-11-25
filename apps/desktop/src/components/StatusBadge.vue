<script setup lang="ts">
defineProps<{
  status: "active" | "ready" | "offline" | "error" | "warning";
  label?: string;
}>();
</script>

<template>
  <span :class="['status-badge', `status-${status}`]" role="status">
    <span class="dot"></span>
    <span class="text">{{ label || status }}</span>
  </span>
</template>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 9999px;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border: none;
  box-shadow: var(--glass-specular);
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-active,
.status-ready {
  background: var(--alert-success-bg);
  color: var(--alert-success-text);
}
.status-active .dot,
.status-ready .dot {
  background: var(--accent-success);
  box-shadow: 0 0 8px var(--accent-success);
}

.status-offline {
  background: var(--glass-surface-subtle);
  color: var(--status-muted-text);
}
.status-offline .dot {
  background: var(--status-muted-text);
}

.status-warning {
  background: var(--alert-warning-bg);
  color: var(--alert-warning-text);
}
.status-warning .dot {
  background: var(--accent-warning);
}

.status-error {
  background: var(--alert-error-bg);
  color: var(--alert-error-text);
}
.status-error .dot {
  background: var(--accent-danger);
  box-shadow: 0 0 8px var(--accent-danger);
}
</style>
