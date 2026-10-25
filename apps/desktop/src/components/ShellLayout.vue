<script setup lang="ts">
import { onMounted } from "vue";
import { useAppStore } from "@vrm/app-core";
import { APP_METADATA } from "@vrm/shared";
import NavigationBar from "./NavigationBar.vue";
import OverviewView from "../workspace/views/OverviewView.vue";
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
