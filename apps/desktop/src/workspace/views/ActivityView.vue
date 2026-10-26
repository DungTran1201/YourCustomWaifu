<script setup lang="ts">
import { computed } from "vue";
import { useAppStore } from "@vrm/app-core";

const store = useAppStore();

const activities = computed(() => {
  const items = [
    {
      id: "act_1",
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      title: "Avatar Stage Status",
      detail: store.state.stageStatus.stageVisible
        ? "Stage window active and visible on desktop"
        : "Stage window dormant / hidden",
      type: store.state.stageStatus.stageVisible ? "success" : "info",
    },
    {
      id: "act_2",
      timestamp: "Today",
      title: "Model Provider Status",
      detail: `${store.state.secrets.length} encrypted credentials configured in hardware vault`,
      type: "info",
    },
    {
      id: "act_3",
      timestamp: "Today",
      title: "Active Companion Runtime",
      detail: `Operating as ${store.state.agents[0]?.name || "Aiko"} with ${store.state.skills.length} active skills and ${store.state.rules.length} operational rules`,
      type: "success",
    },
  ];

  if (store.state.stageError) {
    items.unshift({
      id: "act_err",
      timestamp: "Recent",
      title: "Stage Warning",
      detail: store.state.stageError,
      type: "warning",
    });
  }

  return items;
});
</script>

<template>
  <div class="view-container">
    <div class="section-header">
      <div>
        <h2>Companion Activity & Status</h2>
        <p>
          Real-time audit log of companion interactions, stage visibility
          events, and capability status.
        </p>
      </div>
    </div>

    <div class="activity-timeline">
      <div v-for="act in activities" :key="act.id" class="activity-card">
        <div class="activity-header">
          <div class="activity-meta">
            <span :class="['type-dot', act.type]"></span>
            <span class="activity-title">{{ act.title }}</span>
          </div>
          <span class="activity-time">{{ act.timestamp }}</span>
        </div>
        <p class="activity-detail">{{ act.detail }}</p>
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
}

.activity-timeline {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.activity-card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.activity-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.activity-meta {
  display: flex;
  align-items: center;
  gap: 10px;
}

.type-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.type-dot.success {
  background: #10b981;
}

.type-dot.info {
  background: #06b6d4;
}

.type-dot.warning {
  background: #f59e0b;
}

.activity-title {
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--text-primary);
}

.activity-time {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-family: var(--font-family-mono);
}

.activity-detail {
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.4;
}
</style>
