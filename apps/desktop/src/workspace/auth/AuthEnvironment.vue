<script setup lang="ts">
import { ref, computed, watch, provide, onBeforeUnmount } from "vue";
import { useAppStore } from "@vrm/app-core";
import { prefersReducedMotion } from "../../vrm/index.js";
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

const statusLabel = computed(() => {
  switch (sceneState.value) {
    case "loading-vrm":
      return "Summoning Companion…";
    case "ready":
      return "Obsidian Chamber Ready";
    case "static-fallback":
      return "Obsidian Chamber Static";
    default:
      return "Entering Chamber…";
  }
});
</script>

<template>
  <section
    class="obsidian-auth-environment"
    data-testid="auth-3d-environment"
    aria-label="Obsidian Glass Chamber Authentication"
  >
    <!-- Invisible Native Window Drag Region (Leaves top-right 144px clear for titleBarOverlay controls) -->
    <div class="obsidian-window-drag-strip" aria-hidden="true"></div>

    <!-- Single-Instance 3D Obsidian Glass Chamber & VRM Companion -->
    <AuthVrmStage
      :thinking="isThinking"
      :panel-switch-tick="panelSwitchTick"
      @state-change="sceneState = $event"
    />

    <!-- Centered 2D Floating Authentication Panel Layer -->
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

      <!-- Minimal Companion Chamber Indicator -->
      <div class="chamber-status-pill" aria-live="polite">
        <span
          class="presence-dot"
          :class="{
            'dot-ready': sceneState === 'ready',
            'dot-loading':
              sceneState === 'loading-vrm' || sceneState === 'initializing',
            'dot-fallback': sceneState === 'static-fallback',
          }"
        ></span>
        <span class="presence-text">{{ statusLabel }}</span>
      </div>
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
  background-color: var(--obsidian-void, #05060a);
  color: var(--obsidian-text, #ececf4);
  overflow: hidden;
  display: flex;
  flex-direction: column;
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

.chamber-status-pill {
  position: fixed;
  right: 18px;
  bottom: 14px;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 5px 11px;
  border-radius: 9999px;
  background: rgba(12, 14, 22, 0.9);
  border: 1px solid var(--obsidian-border, #25283d);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.65);
  color: rgba(236, 236, 244, 0.72);
  font-size: 0.71rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  pointer-events: none;
  user-select: none;
}

.presence-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--obsidian-accent, #9185d9);
}

.presence-dot.dot-ready {
  background: var(--obsidian-accent, #9185d9);
  box-shadow: 0 0 8px rgba(145, 133, 217, 0.65);
}

.presence-dot.dot-loading {
  background: var(--obsidian-accent-secondary, #b9789b);
  animation: pulseChamberDot 1.4s ease-in-out infinite;
}

.presence-dot.dot-fallback {
  background: rgba(236, 236, 244, 0.42);
}

@keyframes pulseChamberDot {
  0%,
  100% {
    opacity: 0.45;
  }
  50% {
    opacity: 1;
  }
}

@media (max-width: 720px) {
  .obsidian-entrance-shell {
    max-width: 360px;
  }
  .chamber-status-pill {
    right: 12px;
    bottom: 10px;
    font-size: 0.67rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .obsidian-entrance-shell.entrance-animate,
  .auth-panel-slot.form-swap-animate,
  .presence-dot.dot-loading {
    animation: none;
  }
}
</style>
