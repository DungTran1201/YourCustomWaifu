<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from "vue";
import { useAppStore } from "@vrm/app-core";
import NavigationBar from "./NavigationBar.vue";
import AppIcon from "./AppIcon.vue";
import WindowResizeHandles from "./WindowResizeHandles.vue";
import SettingsView from "../workspace/views/SettingsView.vue";
import DiagnosticsView from "../workspace/views/DiagnosticsView.vue";
import AuthEnvironment from "../workspace/auth/AuthEnvironment.vue";
import ProfileView from "../workspace/views/ProfileView.vue";
import SecurityView from "../workspace/views/SecurityView.vue";
import SecretsView from "../workspace/views/SecretsView.vue";
import ChatView from "../workspace/views/ChatView.vue";
import AvatarSettingsView from "../workspace/views/AvatarSettingsView.vue";
import AgentsView from "../workspace/views/AgentsView.vue";
import SkillsView from "../workspace/views/SkillsView.vue";
import RulesView from "../workspace/views/RulesView.vue";
import ToolsView from "../workspace/views/ToolsView.vue";
import ConnectionsView from "../workspace/views/ConnectionsView.vue";
import MemoryView from "../workspace/views/MemoryView.vue";
import ActivityView from "../workspace/views/ActivityView.vue";

const store = useAppStore();

const AUTH_MODE_TABS = new Set([
  "signin",
  "signup",
  "forgot-password",
  "reset-password",
]);

const isMenubarOnlyWindow = computed(
  () => store.state.windowMode === "menubar",
);

const isPanelOnlyWindow = computed(() => store.state.windowMode === "panel");

const isAuthenticationMode = computed(
  () =>
    !isMenubarOnlyWindow.value &&
    !store.state.isGuest &&
    !store.state.isAuthenticated &&
    (AUTH_MODE_TABS.has(store.state.currentTab) ||
      (store.state.currentTab !== "settings" &&
        store.state.currentTab !== "diagnostics")),
);

function handleWorkspaceShortcuts(e: KeyboardEvent) {
  if (e.defaultPrevented || isAuthenticationMode.value || e.repeat) return;
  const hasMod = e.ctrlKey || e.metaKey;
  if (!hasMod || e.altKey) return;

  const key = e.key.toLowerCase();

  // Ctrl+Shift+B: Expand / Collapse Menubar
  if (e.shiftKey && key === "b") {
    e.preventDefault();
    if (!store.state.menubarVisible) {
      store.toggleMenubar(true);
      store.toggleSidebar(false);
    } else {
      store.toggleSidebar();
    }
    return;
  }

  // Ctrl+B: Show / Hide Menubar Window
  if (!e.shiftKey && key === "b") {
    e.preventDefault();
    store.toggleMenubar();
    return;
  }

  // Ctrl+\: Show / Hide Main Panel Window
  if (!e.shiftKey && (e.key === "\\" || e.code === "Backslash")) {
    e.preventDefault();
    store.togglePanel();
  }
}

onMounted(() => {
  store.initTheme();
  void store.initWorkspaceSync();
  if (!isMenubarOnlyWindow.value) {
    void store.initAuth();
  }
  store.initStageSync();
  if (typeof window !== "undefined") {
    window.addEventListener("keydown", handleWorkspaceShortcuts);
  }
});

onBeforeUnmount(() => {
  if (typeof window !== "undefined") {
    window.removeEventListener("keydown", handleWorkspaceShortcuts);
  }
});
</script>

<template>
  <div
    :class="[
      'shell-layout',
      `theme-${store.resolvedTheme.value}`,
      {
        'auth-shell-active': isAuthenticationMode,
        'window-mode-menubar': isMenubarOnlyWindow,
        'window-mode-panel': isPanelOnlyWindow && !isAuthenticationMode,
      },
    ]"
  >
    <!-- 1. Independent Menubar Window Mode (?window=menubar in Electron) -->
    <template v-if="isMenubarOnlyWindow">
      <WindowResizeHandles
        v-if="
          store.platform.value === 'electron' &&
          store.state.menubarDock === 'floating'
        "
        :min-width="68"
        :max-width="320"
        :min-height="420"
      />
      <NavigationBar detached />
    </template>

    <!-- 2. Borderless Rounded Glass Authentication Mode -->
    <template v-else-if="isAuthenticationMode">
      <WindowResizeHandles
        v-if="store.platform.value === 'electron'"
        :min-width="540"
        :min-height="440"
      />
      <div
        v-if="store.platform.value === 'electron'"
        class="window-floating-controls"
        aria-label="Window Controls"
      >
        <button
          id="window-minimize-btn"
          type="button"
          class="win-ctrl-btn"
          title="Minimize"
          aria-label="Minimize window"
          @click="store.minimizeCurrentWindow()"
        >
          <AppIcon name="minus" size="12" />
        </button>
        <button
          id="window-close-btn"
          type="button"
          class="win-ctrl-btn win-ctrl-close"
          title="Hide Window"
          aria-label="Hide window"
          @click="store.togglePanel(false)"
        >
          <AppIcon name="close" size="12" />
        </button>
      </div>

      <main class="shell-main auth-scene-active" role="main">
        <AuthEnvironment />
      </main>
    </template>

    <!-- 3. Headerless Independent Functional Panel Window Mode (?window=panel in Electron) -->
    <template v-else-if="isPanelOnlyWindow">
      <WindowResizeHandles
        v-if="store.platform.value === 'electron'"
        :min-width="540"
        :min-height="440"
      />
      <!-- Slim Invisible Top Drag Edge so Panel moves freely without a visible header -->
      <div
        class="panel-drag-strip"
        title="Drag to move Panel"
        aria-hidden="true"
      ></div>

      <!-- Subtle Hover-Reveal Window Controls (Zero Header Chrome) -->
      <div class="window-floating-controls" aria-label="Panel Window Controls">
        <button
          id="window-minimize-btn"
          type="button"
          class="win-ctrl-btn"
          title="Minimize Panel"
          aria-label="Minimize Panel"
          @click="store.minimizeCurrentWindow()"
        >
          <AppIcon name="minus" size="12" />
        </button>
        <button
          id="window-maximize-btn"
          type="button"
          class="win-ctrl-btn"
          title="Maximize or Restore Panel"
          aria-label="Maximize or Restore Panel"
          @click="store.toggleMaximizeCurrentWindow()"
        >
          <AppIcon name="maximize" size="11" />
        </button>
        <button
          id="window-close-btn"
          type="button"
          class="win-ctrl-btn win-ctrl-close"
          title="Hide Panel (Ctrl+\)"
          aria-label="Hide Panel"
          @click="store.togglePanel(false)"
        >
          <AppIcon name="close" size="12" />
        </button>
      </div>

      <main
        :class="[
          'shell-main',
          'glass-panel-surface',
          'detached-panel-surface',
          {
            'chat-view-active': store.state.currentTab === 'chat',
          },
        ]"
        role="main"
      >
        <template v-if="store.state.isGuest">
          <AvatarSettingsView v-if="store.state.currentTab === 'avatar'" />
          <SettingsView v-else-if="store.state.currentTab === 'settings'" />
          <DiagnosticsView
            v-else-if="store.state.currentTab === 'diagnostics'"
          />
          <AvatarSettingsView v-else />
        </template>

        <template v-else-if="!store.state.isAuthenticated">
          <SettingsView v-if="store.state.currentTab === 'settings'" />
          <DiagnosticsView
            v-else-if="store.state.currentTab === 'diagnostics'"
          />
          <AuthEnvironment v-else />
        </template>

        <template v-else>
          <ChatView v-if="store.state.currentTab === 'chat'" />
          <AvatarSettingsView v-else-if="store.state.currentTab === 'avatar'" />
          <AgentsView v-else-if="store.state.currentTab === 'agents'" />
          <SkillsView v-else-if="store.state.currentTab === 'skills'" />
          <RulesView v-else-if="store.state.currentTab === 'rules'" />
          <ToolsView v-else-if="store.state.currentTab === 'tools'" />
          <ConnectionsView
            v-else-if="store.state.currentTab === 'connections'"
          />
          <MemoryView v-else-if="store.state.currentTab === 'memory'" />
          <ActivityView v-else-if="store.state.currentTab === 'activity'" />
          <ProfileView v-else-if="store.state.currentTab === 'profile'" />
          <SecurityView v-else-if="store.state.currentTab === 'security'" />
          <SecretsView v-else-if="store.state.currentTab === 'secrets'" />
          <SettingsView v-else-if="store.state.currentTab === 'settings'" />
          <DiagnosticsView
            v-else-if="store.state.currentTab === 'diagnostics'"
          />
          <ChatView v-else />
        </template>
      </main>
    </template>

    <!-- 4. Headerless Separated Shell Body (Fallback for Web / Unit Tests) -->
    <template v-else>
      <div class="shell-body">
        <NavigationBar v-if="store.state.menubarVisible" />

        <main
          v-if="store.state.panelVisible"
          :class="[
            'shell-main',
            'glass-panel-surface',
            {
              'chat-view-active': store.state.currentTab === 'chat',
            },
          ]"
          role="main"
        >
          <template v-if="store.state.isGuest">
            <AvatarSettingsView v-if="store.state.currentTab === 'avatar'" />
            <SettingsView v-else-if="store.state.currentTab === 'settings'" />
            <DiagnosticsView
              v-else-if="store.state.currentTab === 'diagnostics'"
            />
            <AvatarSettingsView v-else />
          </template>

          <template v-else-if="!store.state.isAuthenticated">
            <SettingsView v-if="store.state.currentTab === 'settings'" />
            <DiagnosticsView
              v-else-if="store.state.currentTab === 'diagnostics'"
            />
            <AuthEnvironment v-else />
          </template>

          <template v-else>
            <ChatView v-if="store.state.currentTab === 'chat'" />
            <AvatarSettingsView
              v-else-if="store.state.currentTab === 'avatar'"
            />
            <AgentsView v-else-if="store.state.currentTab === 'agents'" />
            <SkillsView v-else-if="store.state.currentTab === 'skills'" />
            <RulesView v-else-if="store.state.currentTab === 'rules'" />
            <ToolsView v-else-if="store.state.currentTab === 'tools'" />
            <ConnectionsView
              v-else-if="store.state.currentTab === 'connections'"
            />
            <MemoryView v-else-if="store.state.currentTab === 'memory'" />
            <ActivityView v-else-if="store.state.currentTab === 'activity'" />
            <ProfileView v-else-if="store.state.currentTab === 'profile'" />
            <SecurityView v-else-if="store.state.currentTab === 'security'" />
            <SecretsView v-else-if="store.state.currentTab === 'secrets'" />
            <SettingsView v-else-if="store.state.currentTab === 'settings'" />
            <DiagnosticsView
              v-else-if="store.state.currentTab === 'diagnostics'"
            />
            <ChatView v-else />
          </template>
        </main>

        <!-- Minimal Glass Restore Card when Panel is Hidden in Combined Fallback -->
        <section
          v-else
          class="panel-hidden-stage"
          aria-label="Workspace Panel Hidden"
        >
          <div class="panel-restore-card">
            <AppIcon name="panel" size="22" class="restore-icon" />
            <h3 class="restore-title">Workspace Panel Hidden</h3>
            <p class="restore-desc">
              Press <kbd>Ctrl+\</kbd> or toggle in Settings anytime to bring
              back your workspace panel.
            </p>
            <div class="restore-actions">
              <button
                id="panel-restore-btn"
                type="button"
                class="restore-btn"
                @click="store.togglePanel(true)"
              >
                Show Panel
              </button>
              <button
                v-if="!store.state.menubarVisible"
                id="menubar-restore-btn"
                type="button"
                class="restore-btn-secondary"
                @click="store.toggleMenubar(true)"
              >
                Show Menubar
              </button>
            </div>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.shell-layout {
  position: relative;
  height: 100vh;
  width: 100%;
  display: flex;
  flex-direction: column;
  background: var(--canvas-bg);
  color: var(--text-primary);
  overflow: hidden;
  min-width: 0;
  min-height: 0;
  transition:
    background 260ms ease,
    color 200ms ease;
}

.shell-layout.auth-shell-active,
.shell-layout.window-mode-menubar,
.shell-layout.window-mode-panel {
  background: transparent;
}

/* Slim Invisible Top Drag Edge for Headerless Panel Window */
.panel-drag-strip {
  position: fixed;
  top: 0;
  left: 0;
  right: 98px;
  height: 18px;
  z-index: 40;
  -webkit-app-region: drag;
}

/* Discreet Floating Hover Controls (Above resize handles so Close/Minimize/Maximize always click cleanly) */
.window-floating-controls {
  position: fixed;
  top: 10px;
  right: 14px;
  z-index: 80;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 5px;
  border: none;
  border-radius: 9999px;
  background: var(--glass-surface-subtle);
  backdrop-filter: var(--glass-blur-subtle);
  -webkit-backdrop-filter: var(--glass-blur-subtle);
  opacity: 0.78;
  transition:
    opacity var(--transition-fast),
    background-color var(--transition-fast);
  -webkit-app-region: no-drag;
}

.window-floating-controls:hover,
.window-floating-controls:focus-within {
  opacity: 1;
  background: var(--glass-surface-strong);
  box-shadow: var(--glass-shadow-sm);
}

.win-ctrl-btn {
  width: 28px;
  height: 24px;
  border: none;
  border-radius: 9999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  background: transparent;
  cursor: pointer;
  transition:
    background-color var(--transition-fast),
    color var(--transition-fast);
}

.win-ctrl-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.win-ctrl-btn.win-ctrl-close:hover {
  background: var(--alert-error-bg);
  color: var(--alert-error-text);
}

/* Separated Shell Body (Fallback Combined Mode) */
.shell-body {
  position: relative;
  z-index: 1;
  flex: 1 1 auto;
  display: flex;
  overflow: hidden;
  padding: 14px;
  gap: 14px;
  min-height: 0;
  min-width: 0;
}

.shell-main {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  min-height: 0;
  min-width: 0;
}

/* Borderless Rounded Translucent Glass Panel Surface */
.shell-main.glass-panel-surface {
  border: none;
  border-radius: var(--radius-window, 24px);
  background: var(--glass-surface);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  box-shadow: var(--glass-shadow);
  transition:
    background-color var(--transition-normal),
    box-shadow var(--transition-normal);
}

/* Independent Native Panel Window: Borderless Rounded Transparent Glass */
.shell-main.detached-panel-surface {
  width: 100%;
  height: 100%;
  border: none;
  border-radius: var(--radius-window, 24px);
  box-shadow: none;
  padding-top: 6px;
}

.shell-main.chat-view-active {
  overflow: hidden;
}

.shell-main.auth-scene-active {
  overflow: hidden;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: var(--radius-window, 24px);
  background: transparent;
}

/* Panel Hidden Restore Stage (Combined Fallback) */
.panel-hidden-stage {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 0;
  padding: 24px;
}

.panel-restore-card {
  max-width: 340px;
  width: 100%;
  padding: 26px 24px;
  border: none;
  border-radius: 22px;
  background: var(--glass-surface);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  box-shadow: var(--glass-specular), var(--glass-shadow);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 10px;
}

.restore-icon {
  color: var(--text-secondary);
}

.restore-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
}

.restore-desc {
  font-size: 0.82rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

.restore-desc kbd {
  padding: 2px 6px;
  border-radius: 6px;
  background: var(--glass-surface-strong);
  color: var(--text-primary);
  font-family: var(--font-family-mono);
  font-size: 0.75rem;
}

.restore-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 6px;
}

.restore-btn {
  padding: 8px 18px;
  border: none;
  border-radius: 9999px;
  background: var(--btn-primary-bg);
  color: var(--btn-primary-text);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}

.restore-btn:hover {
  opacity: 0.9;
}

.restore-btn-secondary {
  padding: 8px 16px;
  border: none;
  border-radius: 9999px;
  background: var(--glass-surface-strong);
  color: var(--text-primary);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.restore-btn-secondary:hover {
  background: var(--bg-hover);
}
</style>
