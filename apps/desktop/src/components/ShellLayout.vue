<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useAppStore } from "@vrm/app-core";
import { APP_METADATA } from "@vrm/shared";
import NavigationBar from "./NavigationBar.vue";
import StatusBadge from "./StatusBadge.vue";
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

const platformLabel = computed(() =>
  store.platform.value === "electron" ? "Desktop App" : "Web Client",
);

const activeTabTitle = computed(() => {
  switch (store.state.currentTab) {
    case "chat":
      return "Companion Chatspace";
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
      return "AI Credentials & Keys";
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
    <!-- Consistent Native Desktop Topbar -->
    <header class="shell-topbar" role="banner">
      <div class="topbar-left">
        <!-- Sidebar Collapse / Expand Toggle Button -->
        <button
          id="sidebar-toggle-btn"
          class="sidebar-toggle-btn"
          :title="
            store.state.sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'
          "
          @click="store.toggleSidebar()"
        >
          <span class="toggle-icon">{{
            store.state.sidebarCollapsed ? "❯" : "❮"
          }}</span>
        </button>

        <div class="brand">
          <div class="logo-mark">⚡</div>
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
            <span class="user-pill-icon">👤</span>
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
          @click="
            store.updateSettings({
              theme: store.state.settings.theme === 'dark' ? 'light' : 'dark',
            })
          "
        >
          {{ store.state.settings.theme === "dark" ? "☀️" : "🌙" }}
        </button>
      </div>
    </header>

    <!-- Shell Body: Collapsible Left Sidebar + Central Content Area -->
    <div class="shell-body">
      <NavigationBar />

      <main class="shell-main" role="main">
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

    <!-- Minimal Desktop Status Footer -->
    <footer class="shell-footer" role="contentinfo">
      <div class="footer-left">
        <span>{{ APP_METADATA.name }} &copy; 2026 Dung Tran</span>
        <span class="divider">&bull;</span>
        <span>Licensed under {{ APP_METADATA.license }}</span>
      </div>
      <div class="footer-right">
        <a
          id="footer-github-link"
          :href="APP_METADATA.repositoryUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub Repository
        </a>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.shell-layout {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  overflow: hidden;
}

/* Topbar Header */
.shell-topbar {
  height: 50px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  user-select: none;
  flex-shrink: 0;
  z-index: 20;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.bridge-error-badge {
  padding: 3px 8px;
  background: rgba(239, 68, 68, 0.18);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.45);
  border-radius: var(--radius-sm);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.guest-preview-badge {
  padding: 3px 8px;
  background: rgba(6, 182, 212, 0.18);
  color: var(--accent-cyan);
  border: 1px solid rgba(6, 182, 212, 0.45);
  border-radius: var(--radius-sm);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.guest-exit-btn {
  border-color: rgba(6, 182, 212, 0.4);
  color: var(--accent-cyan);
}

.guest-exit-btn:hover {
  background: rgba(6, 182, 212, 0.15);
  color: #fff;
}

.sidebar-toggle-btn {
  background: transparent;
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  width: 28px;
  height: 28px;
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

.toggle-icon {
  font-size: 0.75rem;
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo-mark {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--accent-cyan), var(--accent-indigo));
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  color: #fff;
}

.brand-text {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.app-name {
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.app-version {
  font-size: 0.7rem;
  color: var(--text-muted);
  font-family: var(--font-family-mono);
}

.topbar-center {
  display: flex;
  align-items: center;
}

.current-view-title {
  font-size: 0.825rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stage-pill-btn {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 11px;
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  font-weight: 600;
  border: 1px solid var(--border-subtle);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.stage-pill-btn.stage-active {
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
  border-color: rgba(16, 185, 129, 0.4);
}

.stage-pill-btn.stage-inactive {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.stage-pill-btn:hover {
  border-color: var(--border-default);
}

.stage-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}

.user-pill-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: 9999px;
  color: var(--text-primary);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.user-pill-btn:hover {
  border-color: var(--accent-cyan);
}

.user-pill-icon {
  font-size: 0.8rem;
}

.user-pill-name {
  max-width: 110px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-auth-btn {
  padding: 5px 10px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.8rem;
  font-weight: 500;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.nav-auth-btn:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.nav-auth-primary-btn {
  padding: 5px 12px;
  background: var(--accent-cyan);
  color: #000;
  font-size: 0.8rem;
  font-weight: 600;
  border-radius: var(--radius-sm);
  border: none;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.nav-auth-primary-btn:hover {
  background: #22d3ee;
}

.action-icon-btn {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  background: transparent;
  border: 1px solid var(--border-subtle);
  font-size: 0.95rem;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.action-icon-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

/* Shell Body */
.shell-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

.shell-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-primary);
  position: relative;
}

/* Shell Footer */
.shell-footer {
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-subtle);
  font-size: 0.725rem;
  color: var(--text-muted);
  user-select: none;
  flex-shrink: 0;
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.divider {
  color: var(--text-muted);
}

.footer-right a {
  color: var(--text-muted);
  text-decoration: none;
  transition: color var(--transition-fast);
}

.footer-right a:hover {
  color: var(--text-secondary);
}
</style>
