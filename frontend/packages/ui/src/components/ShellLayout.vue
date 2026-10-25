<script setup lang="ts">
import { onMounted } from "vue";
import { useAppStore } from "@vrm/app-core";
import { APP_METADATA } from "@vrm/shared";
import NavigationBar from "./NavigationBar.vue";
import OverviewView from "../views/OverviewView.vue";
import SettingsView from "../views/SettingsView.vue";
import DiagnosticsView from "../views/DiagnosticsView.vue";
import SignInView from "../views/SignInView.vue";
import SignUpView from "../views/SignUpView.vue";
import ForgotPasswordView from "../views/ForgotPasswordView.vue";
import ResetPasswordView from "../views/ResetPasswordView.vue";
import ProfileView from "../views/ProfileView.vue";
import SecurityView from "../views/SecurityView.vue";
import SecretsView from "../views/SecretsView.vue";
import ChatView from "../views/ChatView.vue";
import AvatarSettingsView from "../views/AvatarSettingsView.vue";
import AgentsView from "../views/AgentsView.vue";
import SkillsView from "../views/SkillsView.vue";
import RulesView from "../views/RulesView.vue";
import ToolsView from "../views/ToolsView.vue";
import ConnectionsView from "../views/ConnectionsView.vue";
import MemoryView from "../views/MemoryView.vue";
import ActivityView from "../views/ActivityView.vue";

const store = useAppStore();

onMounted(() => {
  store.initAuth();
  store.initStageSync();
});
</script>

<template>
  <div class="shell-layout">
    <NavigationBar />

    <main class="shell-main" role="main">
      <ChatView v-if="store.state.currentTab === 'chat'" />
      <AvatarSettingsView v-else-if="store.state.currentTab === 'avatar'" />
      <AgentsView v-else-if="store.state.currentTab === 'agents'" />
      <SkillsView v-else-if="store.state.currentTab === 'skills'" />
      <RulesView v-else-if="store.state.currentTab === 'rules'" />
      <ToolsView v-else-if="store.state.currentTab === 'tools'" />
      <ConnectionsView v-else-if="store.state.currentTab === 'connections'" />
      <MemoryView v-else-if="store.state.currentTab === 'memory'" />
      <ActivityView v-else-if="store.state.currentTab === 'activity'" />
      <OverviewView v-else-if="store.state.currentTab === 'overview'" />
      <ProfileView v-else-if="store.state.currentTab === 'profile'" />
      <SecurityView v-else-if="store.state.currentTab === 'security'" />
      <SecretsView v-else-if="store.state.currentTab === 'secrets'" />
      <SignInView v-else-if="store.state.currentTab === 'signin'" />
      <SignUpView v-else-if="store.state.currentTab === 'signup'" />
      <ForgotPasswordView
        v-else-if="store.state.currentTab === 'forgot-password'"
      />
      <ResetPasswordView
        v-else-if="store.state.currentTab === 'reset-password'"
      />
      <SettingsView v-else-if="store.state.currentTab === 'settings'" />
      <DiagnosticsView v-else-if="store.state.currentTab === 'diagnostics'" />
    </main>

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
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-primary);
  color: var(--text-primary);
}

.shell-main {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.shell-footer {
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-subtle);
  font-size: 0.8rem;
  color: var(--text-muted);
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.divider {
  color: var(--text-muted);
}
</style>
