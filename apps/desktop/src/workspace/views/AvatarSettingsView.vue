<script setup lang="ts">
import { computed } from "vue";
import { useAppStore } from "@vrm/app-core";

const store = useAppStore();

const isStageVisible = computed(() => store.state.stageStatus.stageVisible);
const isClickThrough = computed(() => store.state.stageStatus.clickThrough);
const isAlwaysOnTop = computed(() => store.state.stageStatus.alwaysOnTop);
const isAnimationPaused = computed(
  () => store.state.stageStatus.animationPaused,
);

async function handleSelectVrm() {
  await store.selectVrmFile();
}

function handleScaleChange(e: Event) {
  const val = parseFloat((e.target as HTMLInputElement).value);
  store.updateAvatarConfig({ scale: val });
}

function handleStartupToggle(e: Event) {
  const val = (e.target as HTMLInputElement).checked;
  store.updateAvatarConfig({ showStageOnStartup: val });
}
</script>

<template>
  <div class="view-container">
    <div class="section-header">
      <div class="header-content">
        <h2>Avatar & Stage Configuration</h2>
        <p>
          Configure your local VRM avatar model, desktop Stage window behavior,
          and rendering properties.
        </p>
      </div>

      <!-- Quick Stage Visibility Action -->
      <div class="header-action-panel">
        <button
          id="avatar-toggle-stage-btn"
          :class="[
            'stage-toggle-hero-btn',
            isStageVisible ? 'active' : 'inactive',
          ]"
          :disabled="store.state.stageLoading"
          @click="store.toggleStage()"
        >
          <span class="status-indicator"></span>
          {{ isStageVisible ? "Hide Avatar Stage" : "Launch Avatar Stage" }}
        </button>
      </div>
    </div>

    <!-- Active Model Status Card -->
    <div class="status-overview-card">
      <div class="model-meta">
        <span class="section-badge">CURRENT AVATAR</span>
        <h3 class="model-title">{{ store.state.avatarConfig.avatarName }}</h3>
        <p
          class="model-path"
          :title="store.state.avatarConfig.avatarPath || 'No local file chosen'"
        >
          {{
            store.state.avatarConfig.avatarPath ||
            "Default internal holographic avatar"
          }}
        </p>
      </div>

      <div class="model-actions">
        <button
          id="avatar-select-file-btn"
          class="btn-secondary"
          @click="handleSelectVrm"
        >
          Select .VRM File
        </button>
      </div>
    </div>

    <!-- Error message if any -->
    <div v-if="store.state.stageError" class="stage-error-banner">
      <span class="error-icon">⚠️</span>
      <div class="error-text">
        <strong>Stage Notice:</strong>
        <span>{{ store.state.stageError }}</span>
      </div>
    </div>

    <!-- Stage Window Controls Group -->
    <div class="settings-group">
      <h3 class="group-title">Desktop Window Invariants</h3>

      <div class="setting-row">
        <div class="setting-info">
          <label class="setting-label">Always On Top</label>
          <span class="setting-desc"
            >Keeps Avatar Stage floating above ordinary desktop
            applications</span
          >
        </div>
        <div class="setting-control">
          <label class="switch">
            <input
              id="avatar-always-on-top-toggle"
              type="checkbox"
              :checked="isAlwaysOnTop"
              @change="
                (e) =>
                  store.setStageAlwaysOnTop(
                    (e.target as HTMLInputElement).checked,
                  )
              "
            />
            <span class="slider"></span>
          </label>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <label class="setting-label">Click-Through Mode</label>
          <span class="setting-desc">
            Passes mouse clicks directly through the transparent stage to
            underlying windows.
            <br />
            <em class="shortcut-hint"
              >Use global shortcut <strong>Ctrl+Shift+M</strong> or System Tray
              to toggle interaction.</em
            >
          </span>
        </div>
        <div class="setting-control">
          <label class="switch">
            <input
              id="avatar-clickthrough-toggle"
              type="checkbox"
              :checked="isClickThrough"
              @change="
                (e) =>
                  store.setStageClickThrough(
                    (e.target as HTMLInputElement).checked,
                  )
              "
            />
            <span class="slider"></span>
          </label>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <label class="setting-label">Launch Stage at Startup</label>
          <span class="setting-desc"
            >Automatically display the Avatar Stage when the application
            boots</span
          >
        </div>
        <div class="setting-control">
          <label class="switch">
            <input
              id="avatar-startup-toggle"
              type="checkbox"
              :checked="store.state.avatarConfig.showStageOnStartup"
              @change="handleStartupToggle"
            />
            <span class="slider"></span>
          </label>
        </div>
      </div>
    </div>

    <!-- Motion & Rendering Tuning -->
    <div class="settings-group">
      <h3 class="group-title">Motion & Rendering Tuning</h3>

      <div class="setting-row">
        <div class="setting-info">
          <label class="setting-label">Global Eye & Gaze Tracking</label>
          <span class="setting-desc">
            Avatar eyes follow desktop cursor globally across Workspace, Chrome,
            VS Code, and background windows
          </span>
        </div>
        <div class="setting-control">
          <label class="switch">
            <input
              id="avatar-lookat-toggle"
              type="checkbox"
              :checked="store.state.avatarConfig.lookAtEnabled !== false"
              @change="
                (e) =>
                  store.updateAvatarConfig({
                    lookAtEnabled: (e.target as HTMLInputElement).checked,
                  })
              "
            />
            <span class="slider"></span>
          </label>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <label class="setting-label">Pause Animation</label>
          <span class="setting-desc"
            >Freezes motion loop to eliminate GPU/CPU overhead</span
          >
        </div>
        <div class="setting-control">
          <button
            id="avatar-pause-animation-btn"
            :class="['pill-btn', { active: isAnimationPaused }]"
            @click="store.setStageAnimationPaused(!isAnimationPaused)"
          >
            {{ isAnimationPaused ? "Resume Motion" : "Pause Motion" }}
          </button>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <label class="setting-label"
            >Avatar Scale ({{
              store.state.avatarConfig.scale.toFixed(2)
            }}x)</label
          >
          <span class="setting-desc"
            >Scales the 3D VRM model inside the stage viewport</span
          >
        </div>
        <div class="setting-control">
          <input
            id="avatar-scale-range"
            type="range"
            min="0.5"
            max="2.0"
            step="0.05"
            class="range-slider"
            :value="store.state.avatarConfig.scale"
            @input="handleScaleChange"
          />
        </div>
      </div>
    </div>

    <!-- Architecture & Platform Verification Card -->
    <div class="info-card">
      <h4>Two-Window Desktop Separation</h4>
      <p>
        The Avatar Stage runs as an independent, frameless, transparent native
        window in Electron. Closing or minimizing this Workspace will
        <strong>not</strong> terminate your Avatar Stage or reset companion
        runtime state.
      </p>
    </div>
  </div>
</template>

<style scoped>
.view-container {
  max-width: 860px;
  margin: 0 auto;
  padding: 40px 24px;
}

.section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 32px;
}

.header-content h2 {
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.header-content p {
  color: var(--text-secondary);
}

.stage-toggle-hero-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 20px;
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  font-weight: 600;
  border: 1px solid var(--border-subtle);
  transition: all var(--transition-fast);
}

.stage-toggle-hero-btn.active {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
  border-color: rgba(16, 185, 129, 0.4);
}

.stage-toggle-hero-btn.inactive {
  background: var(--bg-elevated);
  color: var(--text-primary);
}

.stage-toggle-hero-btn:hover {
  background: var(--bg-hover);
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.status-overview-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 24px;
  margin-bottom: 28px;
}

.section-badge {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}

.model-title {
  font-size: 1.3rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 4px 0;
}

.model-path {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-family: var(--font-family-mono);
  max-width: 500px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn-secondary {
  padding: 9px 18px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 0.85rem;
  font-weight: 500;
  transition: all var(--transition-fast);
}

.btn-secondary:hover {
  background: var(--bg-hover);
}

.stage-error-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  margin-bottom: 24px;
  font-size: 0.85rem;
}

.error-icon {
  font-size: 1.2rem;
}

.settings-group {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 16px 24px;
  margin-bottom: 28px;
}

.group-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 0;
  border-bottom: 1px solid var(--border-subtle);
}

.setting-row:last-child {
  border-bottom: none;
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 580px;
}

.setting-label {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.95rem;
}

.setting-desc {
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

.shortcut-hint {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.pill-btn {
  padding: 8px 16px;
  background: var(--bg-primary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 0.85rem;
  font-weight: 500;
  transition: all var(--transition-fast);
}

.pill-btn.active {
  background: var(--accent-warning);
  color: #000;
  font-weight: 600;
}

.range-slider {
  width: 160px;
}

.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--bg-hover);
  transition: 0.3s;
  border-radius: 24px;
  border: 1px solid var(--border-subtle);
}

.slider:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 3px;
  bottom: 3px;
  background-color: var(--text-primary);
  transition: 0.3s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: var(--accent-cyan);
}

input:checked + .slider:before {
  transform: translateX(20px);
  background-color: #000;
}

.info-card {
  padding: 20px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.info-card h4 {
  color: var(--text-primary);
  margin-bottom: 6px;
}
</style>
