<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue";
import { useAppStore, type NavigationTab } from "@vrm/app-core";
import AppIcon from "./AppIcon.vue";

const store = useAppStore();

const isNarrowViewport = ref(false);

function checkWidth() {
  if (typeof window !== "undefined") {
    isNarrowViewport.value = window.innerWidth <= 860;
  }
}

onMounted(() => {
  checkWidth();
  window.addEventListener("resize", checkWidth, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener("resize", checkWidth);
});

const isEffectivelyCollapsed = computed(() => {
  if (store.state.sidebarCollapsed) {
    return true;
  }
  return isNarrowViewport.value;
});

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
  if (store.state.isGuest) {
    return [
      {
        name: "Preview",
        tabs: [{ id: "avatar", label: "Avatar Stage", icon: "stage" }],
      },
      {
        name: "System",
        tabs: [
          { id: "settings", label: "Settings", icon: "settings" },
          { id: "diagnostics", label: "Diagnostics", icon: "diagnostics" },
        ],
      },
    ];
  }

  if (store.state.isAuthenticated) {
    return [
      {
        name: "Companion",
        tabs: [
          { id: "chat", label: "Chat", icon: "chat" },
          { id: "avatar", label: "Avatar Stage", icon: "stage" },
          { id: "agents", label: "Agents", icon: "agents" },
          { id: "memory", label: "Memory", icon: "memory" },
        ],
      },
      {
        name: "Capabilities",
        tabs: [
          { id: "skills", label: "Skills", icon: "skills" },
          { id: "rules", label: "Rules", icon: "rules" },
          { id: "tools", label: "Tools", icon: "tools" },
        ],
      },
      {
        name: "Configuration",
        tabs: [
          { id: "connections", label: "AI Connections", icon: "connections" },
          { id: "secrets", label: "AI Keys", icon: "secrets" },
          { id: "profile", label: "Profile", icon: "profile" },
          { id: "security", label: "Security", icon: "security" },
          { id: "settings", label: "Settings", icon: "settings" },
          { id: "diagnostics", label: "Diagnostics", icon: "diagnostics" },
        ],
      },
    ];
  }

  return [
    {
      name: "Authentication",
      tabs: [
        { id: "signin", label: "Sign In", icon: "signin" },
        { id: "signup", label: "Register", icon: "signup" },
      ],
    },
    {
      name: "System",
      tabs: [
        { id: "settings", label: "Settings", icon: "settings" },
        { id: "diagnostics", label: "Diagnostics", icon: "diagnostics" },
      ],
    },
  ];
});
</script>

<template>
  <aside
    :class="['workspace-sidebar', { collapsed: isEffectivelyCollapsed }]"
    role="navigation"
    aria-label="Sidebar Navigation"
  >
    <div class="sidebar-scroll">
      <div v-for="group in tabGroups" :key="group.name" class="nav-group">
        <div v-if="!isEffectivelyCollapsed" class="group-title">
          {{ group.name }}
        </div>
        <div v-else class="group-divider" aria-hidden="true"></div>

        <button
          v-for="tab in group.tabs"
          :key="tab.id"
          :id="`nav-tab-${tab.id}`"
          :class="[
            'sidebar-nav-btn',
            { active: store.state.currentTab === tab.id },
          ]"
          :title="tab.label"
          :aria-label="tab.label"
          :aria-current="store.state.currentTab === tab.id ? 'page' : undefined"
          @click="store.setTab(tab.id)"
        >
          <AppIcon :name="tab.icon" size="16" class="nav-icon" />
          <span v-if="!isEffectivelyCollapsed" class="nav-label">
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
  width: 210px;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  user-select: none;
  transition: width var(--transition-normal);
  overflow: hidden;
  flex-shrink: 0;
  min-height: 0;
}

.workspace-sidebar.collapsed {
  width: 58px;
}

.sidebar-scroll {
  flex: 1 1 auto;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px 6px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
}

.nav-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.group-title {
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 4px 10px;
  margin-bottom: 2px;
}

.group-divider {
  height: 1px;
  background: var(--border-subtle);
  margin: 6px 8px;
}

.sidebar-nav-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: 34px;
  padding: 0 10px;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 0.825rem;
  font-weight: 500;
  text-align: left;
  background: transparent;
  position: relative;
  transition: all var(--transition-fast);
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

.active-indicator {
  position: absolute;
  left: 0;
  top: 7px;
  bottom: 7px;
  width: 2px;
  background: var(--text-primary);
  border-radius: 0 2px 2px 0;
}

.nav-icon {
  color: inherit;
  opacity: 0.85;
}

.sidebar-nav-btn.active .nav-icon {
  opacity: 1;
}

.nav-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.workspace-sidebar.collapsed .sidebar-nav-btn {
  justify-content: center;
  padding: 0;
}

.workspace-sidebar.collapsed .active-indicator {
  left: 2px;
}
</style>
