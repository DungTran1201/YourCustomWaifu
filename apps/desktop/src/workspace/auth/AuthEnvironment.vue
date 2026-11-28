<script setup lang="ts">
import { ref, computed, watch, provide, onBeforeUnmount } from "vue";
import { useAppStore } from "@vrm/app-core";
import { prefersReducedMotion } from "../../vrm/index.js";
import AppIcon from "../../components/AppIcon.vue";
import AuthVrmStage from "./AuthVrmStage.vue";
import SignInView from "../views/SignInView.vue";
import SignUpView from "../views/SignUpView.vue";
import ForgotPasswordView from "../views/ForgotPasswordView.vue";
import ResetPasswordView from "../views/ResetPasswordView.vue";
import {
  AUTH_ENVIRONMENT_KEY,
  type AuthSceneState,
} from "./auth-environment-context.js";

const store = useAppStore();

const sceneState = ref<AuthSceneState>("initializing");
const reducedMotion = ref<boolean>(prefersReducedMotion());
const focusCount = ref(0);
const isTyping = ref(false);
const isSubmitting = ref(false);
const panelSwitchTick = ref(0);
const hasCompletedInitialEntrance = ref(false);
let typingTimer: ReturnType<typeof setTimeout> | null = null;
let entranceTimer: ReturnType<typeof setTimeout> | null = null;

if (!reducedMotion.value) {
  entranceTimer = setTimeout(() => {
    hasCompletedInitialEntrance.value = true;
  }, 650);
} else {
  hasCompletedInitialEntrance.value = true;
}

const isThinking = computed(
  () => isSubmitting.value || isTyping.value || focusCount.value > 0,
);

function notifyInputFocus() {
  focusCount.value += 1;
}

function notifyInputBlur() {
  focusCount.value = Math.max(0, focusCount.value - 1);
}

function notifyUserTyping() {
  isTyping.value = true;
  if (typingTimer) {
    clearTimeout(typingTimer);
  }
  typingTimer = setTimeout(() => {
    isTyping.value = false;
  }, 1500);
}

function notifySubmitting(submitting: boolean) {
  isSubmitting.value = submitting;
}

provide(AUTH_ENVIRONMENT_KEY, {
  isEmbeddedIn3DStage: true,
  sceneState,
  reducedMotion,
  notifyInputFocus,
  notifyInputBlur,
  notifyUserTyping,
  notifySubmitting,
});

const activeAuthComponent = computed(() => {
  switch (store.state.currentTab) {
    case "signup":
      return SignUpView;
    case "forgot-password":
      return ForgotPasswordView;
    case "reset-password":
      return ResetPasswordView;
    default:
      return SignInView;
  }
});

watch(
  () => store.state.currentTab,
  () => {
    focusCount.value = 0;
    isTyping.value = false;
    isSubmitting.value = false;
    hasCompletedInitialEntrance.value = true;
    panelSwitchTick.value += 1;
  },
);

onBeforeUnmount(() => {
  if (typingTimer) {
    clearTimeout(typingTimer);
    typingTimer = null;
  }
  if (entranceTimer) {
    clearTimeout(entranceTimer);
    entranceTimer = null;
  }
});

const propsSafeSceneState = sceneState;
void propsSafeSceneState;
</script>

<template>
  <section
    class="obsidian-auth-environment"
    data-testid="auth-3d-environment"
    aria-label="Authentication Workspace"
  >
    <!-- Invisible Native Window Drag Region (Leaves top-right 144px clear for titleBarOverlay controls) -->
    <div class="obsidian-window-drag-strip" aria-hidden="true"></div>

    <!-- Pattern-free Translucent Glass Shader Sheen (No 3D room, No VRM) -->
    <AuthVrmStage
      :thinking="isThinking"
      :panel-switch-tick="panelSwitchTick"
      :theme="store.resolvedTheme.value"
      @state-change="sceneState = $event"
    />

    <!-- Centered 2D Floating Glass Authentication Panel Layer -->
    <div class="obsidian-foreground-layer">
      <div
        class="obsidian-entrance-shell"
        :class="{ 'entrance-animate': !reducedMotion }"
      >
        <div
          :key="store.state.currentTab"
          class="auth-panel-slot"
          :class="{
            'form-swap-animate': !reducedMotion && hasCompletedInitialEntrance,
          }"
        >
          <component :is="activeAuthComponent" />
        </div>
      </div>

      <!-- Borderless Floating Theme Switcher Pill (White <-> Black) -->
      <button
        id="auth-theme-toggle-btn"
        type="button"
        class="auth-theme-pill"
        :title="
          store.resolvedTheme.value === 'dark'
            ? 'Switch to White Glass Theme'
            : 'Switch to Black Glass Theme'
        "
        :aria-label="
          store.resolvedTheme.value === 'dark'
            ? 'Switch to White Glass Theme'
            : 'Switch to Black Glass Theme'
        "
        @click="store.toggleTheme()"
      >
        <AppIcon
          :name="store.resolvedTheme.value === 'dark' ? 'sun' : 'moon'"
          size="14"
        />
        <span>{{
          store.resolvedTheme.value === "dark" ? "White" : "Black"
        }}</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.obsidian-auth-environment {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 100%;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: var(--radius-window, 24px);
  background: var(--window-glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  color: var(--auth-text);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition:
    background 260ms ease,
    color 200ms ease;
}

.obsidian-window-drag-strip {
  position: absolute;
  top: 0;
  left: 0;
  right: 144px;
  height: 36px;
  z-index: 4;
  -webkit-app-region: drag;
  pointer-events: auto;
}

.obsidian-foreground-layer {
  position: relative;
  z-index: 2;
  flex: 1 1 auto;
  width: 100%;
  height: 100%;
  min-height: 0;
  margin: 0;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: clamp(14px, 2.5vh, 28px) clamp(16px, 3vw, 36px);
}

.obsidian-entrance-shell {
  width: 100%;
  max-width: 404px;
  min-width: 0;
  /* Dead-center horizontally and vertically without top-clipping on short viewports */
  margin: auto;
}

.obsidian-entrance-shell.entrance-animate {
  animation: obsidianChamberEntrance 620ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes obsidianChamberEntrance {
  from {
    opacity: 0;
    transform: translateY(18px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.auth-panel-slot {
  width: 100%;
  min-width: 0;
}

.auth-panel-slot.form-swap-animate {
  animation: obsidianFormSwap 230ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes obsidianFormSwap {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.auth-theme-pill {
  position: fixed;
  left: 18px;
  bottom: 14px;
  z-index: 5;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 14px;
  border: none;
  border-radius: 9999px;
  background: var(--glass-surface);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  box-shadow: var(--glass-specular), var(--glass-shadow-sm);
  color: var(--auth-text-secondary);
  font-size: 0.74rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  cursor: pointer;
  transition:
    background-color var(--transition-fast),
    color var(--transition-fast),
    transform var(--transition-fast),
    box-shadow var(--transition-fast);
}

.auth-theme-pill:hover {
  background: var(--bg-hover);
  color: var(--auth-text);
  transform: translateY(-1px);
}

@media (max-width: 720px) {
  .obsidian-entrance-shell {
    max-width: 360px;
  }
  .auth-theme-pill {
    left: 12px;
    bottom: 10px;
    font-size: 0.69rem;
    padding: 5px 11px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .obsidian-entrance-shell.entrance-animate,
  .auth-panel-slot.form-swap-animate {
    animation: none;
  }
}
</style>
