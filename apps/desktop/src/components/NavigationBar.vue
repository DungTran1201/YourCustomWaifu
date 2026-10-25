<script setup lang="ts">
import { computed } from "vue";
import { useAppStore, type NavigationTab } from "@vrm/app-core";

const store = useAppStore();

interface TabDef {
  id: NavigationTab;
  label: string;
  icon: string;
}

interface TabGroup {
  name: string;
  tabs: TabDef[];
}

const tabGroups = computed<TabGroup[]>(() => {
  if (store.state.isAuthenticated) {
    return [
      {
        name: "Companion",
        tabs: [
          { id: "chat", label: "Chat", icon: "💬" },
          { id: "avatar", label: "Avatar Stage", icon: "🎭" },
        ],
      },
      {
        name: "Intelligence",
        tabs: [
          { id: "agents", label: "Agents", icon: "🤖" },
          { id: "skills", label: "Skills", icon: "⚡" },
          { id: "rules", label: "Rules", icon: "📜" },
          { id: "tools", label: "Tools", icon: "🛠️" },
          { id: "connections", label: "Connections", icon: "🔌" },
          { id: "memory", label: "Memory", icon: "🧠" },
        ],
      },
      {
        name: "System",
        tabs: [
          { id: "overview", label: "Overview", icon: "📊" },
          { id: "profile", label: "Profile", icon: "👤" },
          { id: "security", label: "Security", icon: "🛡️" },
          { id: "secrets", label: "AI Keys", icon: "🔑" },
          { id: "settings", label: "Settings", icon: "⚙️" },
          { id: "diagnostics", label: "Diagnostics", icon: "🩺" },
        ],
      },
    ];
  }

  return [
    {
      name: "Public",
      tabs: [
        { id: "overview", label: "Overview", icon: "📊" },
        { id: "settings", label: "Settings", icon: "⚙️" },
        { id: "diagnostics", label: "Diagnostics", icon: "🩺" },
      ],
    },
  ];
});
</script>

<template>
  <aside
    :class="['workspace-sidebar', { collapsed: store.state.sidebarCollapsed }]"
    role="navigation"
    aria-label="Sidebar Navigation"
  >
    <div class="sidebar-scroll">
      <div v-for="group in tabGroups" :key="group.name" class="nav-group">
        <div v-if="!store.state.sidebarCollapsed" class="group-title">
          {{ group.name }}
        </div>
        <div v-else class="group-divider"></div>

        <button
          v-for="tab in group.tabs"
          :key="tab.id"
          :id="`nav-tab-${tab.id}`"
          :class="[
            'sidebar-nav-btn',
            { active: store.state.currentTab === tab.id },
          ]"
          :title="tab.label"
          @click="store.setTab(tab.id)"
        >
          <span class="nav-icon">{{ tab.icon }}</span>
          <span v-if="!store.state.sidebarCollapsed" class="nav-label">
            {{ tab.label }}
          </span>
          <span
            v-if="store.state.currentTab === tab.id"
            class="active-indicator"
          ></span>
        </button>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.workspace-sidebar {
  width: 220px;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  user-select: none;
  transition: width 180ms cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  flex-shrink: 0;
}

.workspace-sidebar.collapsed {
  width: 62px;
}

.sidebar-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.nav-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.group-title {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  padding: 6px 10px 4px 10px;
}

.group-divider {
  height: 1px;
  background: var(--border-subtle);
  margin: 6px 4px;
}

.sidebar-nav-btn {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  white-space: nowrap;
  transition:
    background 120ms ease,
    color 120ms ease;
  width: 100%;
}

.workspace-sidebar.collapsed .sidebar-nav-btn {
  justify-content: center;
  padding: 9px 0;
}

.sidebar-nav-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.sidebar-nav-btn.active {
  background: var(--bg-selected);
  color: var(--text-primary);
  font-weight: 600;
}

.nav-icon {
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 20px;
}

.nav-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.active-indicator {
  position: absolute;
  left: 0;
  top: 6px;
  bottom: 6px;
  width: 3px;
  background: var(--accent-cyan);
  border-radius: 0 2px 2px 0;
}
</style>
