<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue";
import { useAppStore, type NavigationTab } from "@vrm/app-core";
import AppIcon from "./AppIcon.vue";

const props = withDefaults(
  defineProps<{
    detached?: boolean;
  }>(),
  {
    detached: false,
  },
);

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

const isDetachedWindow = computed(
  () => props.detached || store.state.windowMode === "menubar",
);

const isEffectivelyCollapsed = computed(() => {
  if (store.state.sidebarCollapsed) {
    return true;
  }
  // In an independent Menubar OS window, width is intentionally ~228px; never auto-collapse by viewport width
  if (isDetachedWindow.value) {
    return false;
  }
  return isNarrowViewport.value;
});

const userDisplayName = computed(
  () =>
    store.state.user?.displayName ||
    store.state.user?.email?.split("@")[0] ||
    "Account",
);

const userInitial = computed(() =>
  (userDisplayName.value.trim().charAt(0) || "U").toUpperCase(),
);

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
    :class="[
      'workspace-sidebar',
      {
        collapsed: isEffectivelyCollapsed,
        detached: isDetachedWindow,
      },
    ]"
    role="navigation"
    aria-label="Sidebar Navigation"
  >
    <!-- Slim Draggable Handle & Compact Window Controls (No bulky header bar) -->
    <div class="sidebar-drag-bar">
      <div class="sidebar-drag-grip" title="Drag to move Menubar">
        <AppIcon name="grip" size="13" class="grip-icon" />
      </div>

      <div class="sidebar-top-controls">
        <button
          id="sidebar-toggle-btn"
          type="button"
          class="sidebar-micro-btn"
          :title="
            store.state.sidebarCollapsed
              ? 'Expand Menubar (Ctrl+Shift+B)'
              : 'Collapse Menubar (Ctrl+Shift+B)'
          "
          :aria-label="
            store.state.sidebarCollapsed ? 'Expand Menubar' : 'Collapse Menubar'
          "
          @click="store.toggleSidebar()"
        >
          <AppIcon
            :name="
              store.state.sidebarCollapsed ? 'chevron-right' : 'chevron-left'
            "
            size="13"
          />
        </button>

        <button
          v-if="isDetachedWindow"
          id="menubar-hide-btn"
          type="button"
          class="sidebar-micro-btn hide-btn"
          title="Hide Menubar (Ctrl+B)"
          aria-label="Hide Menubar"
          @click="store.toggleMenubar(false)"
        >
          <AppIcon name="close" size="12" />
        </button>
      </div>
    </div>

    <!-- Navigation Sections -->
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

    <!-- Bottom Pinned User Account & Quick Utility Dock -->
    <div class="sidebar-footer">
      <!-- Compact Utility Bar (Avatar Stage, Panel Toggle, Theme Switch) -->
      <div
        :class="[
          'sidebar-utility-row',
          { 'utility-vertical': isEffectivelyCollapsed },
        ]"
      >
        <button
          id="nav-stage-toggle-btn"
          type="button"
          :class="[
            'utility-pill-btn',
            store.state.stageStatus.stageVisible
              ? 'stage-active'
              : 'stage-inactive',
          ]"
          :title="
            store.state.stageStatus.stageVisible
              ? 'Hide Avatar Stage (Ctrl+Shift+A)'
              : 'Show Avatar Stage (Ctrl+Shift+A)'
          "
          :aria-label="
            store.state.stageStatus.stageVisible
              ? 'Hide Avatar Stage'
              : 'Show Avatar Stage'
          "
          @click="store.toggleStage()"
        >
          <span class="stage-dot"></span>
          <span v-if="!isEffectivelyCollapsed" class="utility-label">{{
            store.state.stageStatus.stageVisible ? "Stage On" : "Stage"
          }}</span>
        </button>

        <button
          id="panel-visibility-btn"
          type="button"
          :class="['utility-icon-btn', { active: store.state.panelVisible }]"
          :aria-pressed="store.state.panelVisible"
          :title="
            store.state.panelVisible
              ? 'Hide Panel Window (Ctrl+\\)'
              : 'Show Panel Window (Ctrl+\\)'
          "
          :aria-label="
            store.state.panelVisible
              ? 'Hide Workspace Panel'
              : 'Show Workspace Panel'
          "
          @click="store.togglePanel()"
        >
          <AppIcon name="panel" size="14" />
        </button>

        <button
          id="theme-toggle-btn"
          type="button"
          class="utility-icon-btn"
          :title="
            store.resolvedTheme.value === 'dark'
              ? 'Switch to Light Glass'
              : 'Switch to Dark Glass'
          "
          :aria-label="
            store.resolvedTheme.value === 'dark'
              ? 'Switch to Light Glass Mode'
              : 'Switch to Dark Glass Mode'
          "
          @click="store.toggleTheme()"
        >
          <AppIcon
            :name="store.resolvedTheme.value === 'dark' ? 'sun' : 'moon'"
            size="14"
          />
        </button>
      </div>

      <!-- Authenticated User Account Dock (Bottom of Menubar) -->
      <div
        v-if="store.state.isAuthenticated"
        :class="[
          'account-dock',
          { 'account-dock-collapsed': isEffectivelyCollapsed },
        ]"
      >
        <button
          id="nav-user-pill"
          type="button"
          class="account-profile-btn"
          :title="`${userDisplayName}${store.state.user?.email ? ' (' + store.state.user.email + ')' : ''} — Open Profile`"
          aria-label="Account Profile"
          @click="store.setTab('profile')"
        >
          <span class="account-avatar" aria-hidden="true">{{
            userInitial
          }}</span>
          <span v-if="!isEffectivelyCollapsed" class="account-meta">
            <span class="account-name">{{ userDisplayName }}</span>
            <span v-if="store.state.user?.email" class="account-email">
              {{ store.state.user.email }}
            </span>
          </span>
        </button>

        <button
          id="nav-signout-btn"
          type="button"
          class="account-signout-btn"
          title="Sign Out"
          aria-label="Sign Out"
          @click="store.logout()"
        >
          <AppIcon name="logout" size="14" />
        </button>
      </div>

      <!-- Guest Preview Footer -->
      <div
        v-else-if="store.state.isGuest"
        :class="[
          'guest-dock',
          { 'account-dock-collapsed': isEffectivelyCollapsed },
        ]"
      >
        <span
          v-if="!isEffectivelyCollapsed"
          id="guest-preview-badge"
          class="guest-dock-badge"
          >GUEST PREVIEW</span
        >
        <button
          id="nav-exit-guest-btn"
          type="button"
          class="guest-exit-btn"
          title="Exit Guest Preview"
          aria-label="Exit Guest Preview"
          @click="store.exitGuestPreview()"
        >
          <AppIcon name="logout" size="13" />
          <span v-if="!isEffectivelyCollapsed">Exit Guest Preview</span>
        </button>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.workspace-sidebar {
  width: 224px;
  background: var(--glass-surface);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: none;
  border-radius: var(--radius-shell-major, 24px) var(--radius-shell-minor, 12px)
    var(--radius-shell-minor, 12px) var(--radius-shell-major, 24px);
  box-shadow: var(--glass-specular), var(--glass-shadow);
  display: flex;
  flex-direction: column;
  user-select: none;
  transition:
    width var(--transition-normal),
    background-color var(--transition-normal),
    box-shadow var(--transition-normal);
  overflow: hidden;
  flex-shrink: 0;
  min-height: 0;
}

.workspace-sidebar.detached {
  width: 100%;
  height: 100%;
  border-radius: 0;
  box-shadow: var(--glass-specular);
}

.workspace-sidebar.collapsed:not(.detached) {
  width: 68px;
}

/* Slim Draggable Top Handle */
.sidebar-drag-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 8px 4px;
  min-height: 34px;
  flex-shrink: 0;
  -webkit-app-region: drag;
}

.workspace-sidebar.collapsed .sidebar-drag-bar {
  justify-content: center;
  padding: 8px 4px 4px;
}

.sidebar-drag-grip {
  display: inline-flex;
  align-items: center;
  color: var(--text-muted);
  opacity: 0.55;
  padding: 2px 4px;
}

.workspace-sidebar.collapsed .sidebar-drag-grip {
  display: none;
}

.sidebar-top-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  -webkit-app-region: no-drag;
}

.sidebar-micro-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 8px;
  border: none;
  color: var(--text-muted);
  background: transparent;
  cursor: pointer;
  transition:
    background-color var(--transition-fast),
    color var(--transition-fast);
}

.sidebar-micro-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.sidebar-micro-btn.hide-btn:hover {
  background: var(--alert-error-bg);
  color: var(--alert-error-text);
}

.sidebar-scroll {
  flex: 1 1 auto;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 6px 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
}

.nav-group {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.group-title {
  font-size: 0.67rem;
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
  margin: 4px 10px;
}

.sidebar-nav-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: 36px;
  padding: 0 11px;
  border: none;
  border-radius: 12px;
  color: var(--text-secondary);
  font-size: 0.825rem;
  font-weight: 500;
  text-align: left;
  background: transparent;
  position: relative;
  transition:
    background-color var(--transition-fast),
    color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.sidebar-nav-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.sidebar-nav-btn.active {
  background: var(--bg-selected);
  color: var(--text-primary);
  font-weight: 600;
  box-shadow: var(--glass-shadow-sm);
}

.active-indicator {
  position: absolute;
  left: 3px;
  top: 9px;
  bottom: 9px;
  width: 3px;
  background: var(--text-primary);
  border-radius: 9999px;
}

.nav-icon {
  color: inherit;
  flex-shrink: 0;
  opacity: 0.85;
}

.sidebar-nav-btn.active .nav-icon,
.sidebar-nav-btn:hover .nav-icon {
  opacity: 1;
}

.nav-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.workspace-sidebar.collapsed .sidebar-nav-btn {
  justify-content: center;
  padding: 0;
}

/* Bottom Pinned Account & Quick Utility Footer */
.sidebar-footer {
  flex-shrink: 0;
  padding: 8px;
  border-top: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: 8px;
  -webkit-app-region: no-drag;
}

.sidebar-utility-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sidebar-utility-row.utility-vertical {
  flex-direction: column;
  gap: 5px;
}

.utility-pill-btn {
  flex: 1 1 auto;
  min-width: 0;
  height: 30px;
  padding: 0 10px;
  border-radius: 10px;
  border: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 0.74rem;
  font-weight: 600;
  cursor: pointer;
  background: var(--glass-surface-subtle);
  color: var(--text-secondary);
  transition:
    background-color var(--transition-fast),
    color var(--transition-fast);
}

.utility-vertical .utility-pill-btn {
  flex: 0 0 auto;
  width: 34px;
  height: 30px;
  padding: 0;
}

.utility-pill-btn.stage-active {
  background: var(--alert-success-bg);
  color: var(--alert-success-text);
}

.utility-pill-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.stage-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}

.utility-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.utility-icon-btn {
  width: 30px;
  height: 30px;
  border-radius: 10px;
  border: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--glass-surface-subtle);
  color: var(--text-secondary);
  cursor: pointer;
  flex-shrink: 0;
  transition:
    background-color var(--transition-fast),
    color var(--transition-fast);
}

.utility-vertical .utility-icon-btn {
  width: 34px;
}

.utility-icon-btn:hover,
.utility-icon-btn.active {
  background: var(--bg-hover);
  color: var(--text-primary);
}

/* User Account Card at Bottom of Menubar */
.account-dock {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px;
  border-radius: 14px;
  background: var(--glass-surface-subtle);
  box-shadow: var(--glass-specular);
}

.account-dock-collapsed {
  flex-direction: column;
  padding: 5px 4px;
  gap: 6px;
}

.account-profile-btn {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 5px 6px;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.account-dock-collapsed .account-profile-btn {
  padding: 2px;
  justify-content: center;
}

.account-profile-btn:hover {
  background: var(--bg-hover);
}

.account-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--btn-primary-bg);
  color: var(--btn-primary-text);
  font-size: 0.76rem;
  font-weight: 700;
  flex-shrink: 0;
}

.account-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.25;
}

.account-name {
  font-size: 0.79rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.account-email {
  font-size: 0.67rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.account-signout-btn {
  width: 30px;
  height: 30px;
  border-radius: 10px;
  border: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  background: transparent;
  cursor: pointer;
  flex-shrink: 0;
  transition:
    background-color var(--transition-fast),
    color var(--transition-fast);
}

.account-signout-btn:hover {
  background: var(--alert-error-bg);
  color: var(--alert-error-text);
}

/* Guest Dock */
.guest-dock {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px;
  border-radius: 14px;
  background: var(--glass-surface-subtle);
}

.guest-dock-badge {
  font-size: 0.64rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-align: center;
  color: var(--alert-warning-text);
  background: var(--alert-warning-bg);
  padding: 3px 8px;
  border-radius: 8px;
}

.guest-exit-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 6px 8px;
  border: none;
  border-radius: 10px;
  background: var(--bg-hover);
  color: var(--text-primary);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.guest-exit-btn:hover {
  background: var(--bg-selected);
}
</style>
