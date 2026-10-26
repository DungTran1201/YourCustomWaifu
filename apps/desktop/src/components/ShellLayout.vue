<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useAppStore } from "@vrm/app-core";
import { APP_METADATA } from "@vrm/shared";
import NavigationBar from "./NavigationBar.vue";
import StatusBadge from "./StatusBadge.vue";
import AppIcon from "./AppIcon.vue";
import SettingsView from "../workspace/views/SettingsView.vue";
import DiagnosticsView from "../workspace/views/DiagnosticsView.vue";
import SignInView from "../workspace/views/SignInView.vue";
import SignUpView from "../workspace/views/SignUpView.vue";
import ForgotPasswordView from "../workspace/views/ForgotPasswordView.vue";
import ResetPasswordView from "../workspace/views/ResetPasswordView.vue";
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

const platformLabel = computed(() => "Desktop App");

const activeTabTitle = computed(() => {
  switch (store.state.currentTab) {
    case "chat":
      return "Companion Chat";
    case "avatar":
      return "Avatar Stage Settings";
    case "agents":
      return "AI Agents";
    case "skills":
      return "Skills Configuration";
    case "rules":
      return "Operating Rules";
    case "tools":
      return "Tool Integrations";
    case "connections":
      return "Provider Connections";
    case "memory":
      return "Companion Memory";
    case "activity":
      return "System Activity";
    case "profile":
      return "Account Profile";
    case "security":
      return "Security & Sessions";
    case "secrets":
      return "AI Keys & Credentials";
    case "settings":
      return "Application Settings";
    case "diagnostics":
      return "System Diagnostics";
    case "signin":
      return "Sign In";
    case "signup":
      return "Account Registration";
    case "forgot-password":
      return "Forgot Password";
    case "reset-password":
      return "Reset Password";
    default:
      return "Workspace";
  }
});

onMounted(() => {
  store.initAuth();
  store.initStageSync();
});
</script>

<template>
  <div class="shell-layout">
    <!-- Restrained Native Desktop Topbar -->
    <header class="shell-topbar" role="banner">
      <div class="topbar-left">
        <!-- Sidebar Collapse / Expand Toggle Button -->
        <button
          id="sidebar-toggle-btn"
          class="sidebar-toggle-btn"
          :title="
            store.state.sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'
          "
          :aria-label="
            store.state.sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'
          "
          @click="store.toggleSidebar()"
        >
          <AppIcon
            :name="
              store.state.sidebarCollapsed ? 'chevron-right' : 'chevron-left'
            "
            size="14"
          />
        </button>

        <div class="brand">
          <div class="logo-mark">
            <AppIcon name="stage" size="14" />
          </div>
          <div class="brand-text">
            <span class="app-name">{{ APP_METADATA.shortName }}</span>
            <span class="app-version">v{{ APP_METADATA.version }}</span>
          </div>
        </div>

        <StatusBadge
          v-if="!store.hasBridgeError.value"
          status="ready"
          :label="platformLabel"
        />
        <span
          v-else
          id="bridge-error-badge"
          class="bridge-error-badge"
          title="Electron IPC Bridge missing. Check preload script."
        >
          BRIDGE ERROR
        </span>
        <span
          v-if="store.state.isGuest"
          id="guest-preview-badge"
          class="guest-preview-badge"
          title="Running in local development preview mode"
        >
          GUEST PREVIEW
        </span>
      </div>

      <div class="topbar-center">
        <span class="current-view-title">{{ activeTabTitle }}</span>
      </div>

      <div class="topbar-right">
        <!-- Stage Quick-Toggle Button -->
        <button
          id="nav-stage-toggle-btn"
          :class="[
            'stage-pill-btn',
            store.state.stageStatus.stageVisible
              ? 'stage-active'
              : 'stage-inactive',
          ]"
          :title="
            store.state.stageStatus.stageVisible
              ? 'Avatar Stage is visible (Click to hide)'
              : 'Avatar Stage is hidden (Click to launch)'
          "
          @click="store.toggleStage()"
        >
          <span class="stage-dot"></span>
          <span class="stage-label">{{
            store.state.stageStatus.stageVisible ? "Stage Active" : "Show Stage"
          }}</span>
        </button>

        <!-- Guest Actions -->
        <template v-if="store.state.isGuest">
          <button
            id="exit-guest-preview-btn"
            class="nav-auth-btn guest-exit-btn"
            title="Exit Guest Preview"
            @click="store.exitGuestPreview()"
          >
            Exit Guest Preview
          </button>
        </template>

        <!-- Auth Actions -->
        <template v-else-if="store.state.isAuthenticated">
          <button
            id="nav-user-pill"
            class="user-pill-btn"
            title="Account Profile"
            @click="store.setTab('profile')"
          >
            <AppIcon name="user" size="13" class="user-pill-icon" />
            <span class="user-pill-name">{{
              store.state.user?.displayName ||
              store.state.user?.email?.split("@")[0]
            }}</span>
          </button>
          <button
            id="nav-signout-btn"
            class="nav-auth-btn"
            title="Sign Out"
            @click="store.logout()"
          >
            Sign Out
          </button>
        </template>
        <template v-else>
          <button
            id="nav-signin-btn"
            class="nav-auth-btn"
            @click="store.setTab('signin')"
          >
            Sign In
          </button>
          <button
            id="nav-signup-btn"
            class="nav-auth-primary-btn"
            @click="store.setTab('signup')"
          >
            Register
          </button>
        </template>

        <!-- Theme Toggle -->
        <button
          id="theme-toggle-btn"
          class="action-icon-btn"
          title="Toggle Theme"
          :aria-label="
            store.state.settings.theme === 'dark'
              ? 'Switch to light theme'
              : 'Switch to dark theme'
          "
          @click="
            store.updateSettings({
              theme: store.state.settings.theme === 'dark' ? 'light' : 'dark',
            })
          "
        >
          <AppIcon
            :name="store.state.settings.theme === 'dark' ? 'sun' : 'moon'"
            size="14"
          />
        </button>
      </div>
    </header>

    <!-- Shell Body: Collapsible Left Sidebar + Central Content Area -->
    <div class="shell-body">
      <NavigationBar />

      <main
        :class="[
          'shell-main',
          { 'chat-view-active': store.state.currentTab === 'chat' },
        ]"
        role="main"
      >
        <!-- Guest Preview routing: focus on Avatar Stage and settings -->
        <template v-if="store.state.isGuest">
          <AvatarSettingsView v-if="store.state.currentTab === 'avatar'" />
          <SettingsView v-else-if="store.state.currentTab === 'settings'" />
          <DiagnosticsView
            v-else-if="store.state.currentTab === 'diagnostics'"
          />
          <AvatarSettingsView v-else />
        </template>

        <!-- Unauthenticated routing: display SignInView by default unless on explicit auth/system views -->
        <template v-else-if="!store.state.isAuthenticated">
          <SignUpView v-if="store.state.currentTab === 'signup'" />
          <ForgotPasswordView
            v-else-if="store.state.currentTab === 'forgot-password'"
          />
          <ResetPasswordView
            v-else-if="store.state.currentTab === 'reset-password'"
          />
          <SettingsView v-else-if="store.state.currentTab === 'settings'" />
          <DiagnosticsView
            v-else-if="store.state.currentTab === 'diagnostics'"
          />
          <SignInView v-else />
        </template>

        <!-- Authenticated routing: display Chatspace by default -->
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
    </div>
  </div>
</template>

<style scoped>
.shell-layout {
  height: 100vh;
  width: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  overflow: hidden;
  min-width: 0;
  min-height: 0;
}

/* Topbar Header */
.shell-topbar {
  height: 46px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  user-select: none;
  flex-shrink: 0;
  z-index: 20;
  min-width: 0;
  gap: 8px;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex-shrink: 1;
}

.bridge-error-badge {
  padding: 2px 7px;
  background: rgba(239, 68, 68, 0.15);
  color: var(--accent-danger);
  border: 1px solid rgba(239, 68, 68, 0.35);
  border-radius: var(--radius-sm);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.guest-preview-badge {
  padding: 2px 7px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.guest-exit-btn {
  border-color: var(--border-default);
  color: var(--text-secondary);
}

.guest-exit-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.sidebar-toggle-btn {
  background: transparent;
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  width: 26px;
  height: 26px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.sidebar-toggle-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border-default);
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo-mark {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
}

.brand-text {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.app-name {
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.app-version {
  font-size: 0.68rem;
  color: var(--text-muted);
  font-family: var(--font-family-mono);
}

.topbar-center {
  display: flex;
  align-items: center;
  min-width: 0;
  overflow: hidden;
  padding: 0 8px;
}

.current-view-title {
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--text-muted);
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  min-width: 0;
}

.stage-pill-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 9px;
  border-radius: var(--radius-sm);
  font-size: 0.78rem;
  font-weight: 500;
  border: 1px solid var(--border-subtle);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.stage-pill-btn.stage-active {
  background: rgba(16, 185, 129, 0.1);
  color: var(--accent-success);
  border-color: rgba(16, 185, 129, 0.3);
}

.stage-pill-btn.stage-inactive {
  background: var(--bg-surface);
  color: var(--text-secondary);
}

.stage-pill-btn:hover {
  border-color: var(--border-default);
}

.stage-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.user-pill-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 9px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 9999px;
  color: var(--text-primary);
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.user-pill-btn:hover {
  border-color: var(--border-default);
  background: var(--bg-hover);
}

.user-pill-name {
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-auth-btn {
  padding: 4px 9px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.78rem;
  font-weight: 500;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.nav-auth-btn:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
  border-color: var(--border-default);
}

.nav-auth-primary-btn {
  padding: 4px 11px;
  background: var(--text-primary);
  color: var(--bg-primary);
  font-size: 0.78rem;
  font-weight: 600;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.nav-auth-primary-btn:hover {
  opacity: 0.9;
}

.action-icon-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  background: transparent;
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.action-icon-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border-default);
}

/* Shell Body */
.shell-body {
  flex: 1 1 auto;
  display: flex;
  overflow: hidden;
  position: relative;
  min-height: 0;
  min-width: 0;
}

.shell-main {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  background: var(--bg-primary);
  position: relative;
  min-height: 0;
  min-width: 0;
}

.shell-main.chat-view-active {
  overflow: hidden;
}

/* Responsive Topbar reflow */
@media (max-width: 900px) {
  .topbar-center {
    display: none;
  }
  .app-version {
    display: none;
  }
}

@media (max-width: 820px) {
  .shell-topbar {
    padding: 0 10px;
    gap: 6px;
  }
  .user-pill-name {
    max-width: 70px;
  }
  .guest-preview-badge,
  .bridge-error-badge {
    padding: 2px 5px;
    font-size: 0.62rem;
  }
}
</style>
