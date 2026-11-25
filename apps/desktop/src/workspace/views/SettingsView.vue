<script setup lang="ts">
import { useAppStore } from "@vrm/app-core";

const store = useAppStore();

const themes = [
  { id: "light", label: "White (Default)" },
  { id: "dark", label: "Black" },
  { id: "system", label: "Follow System" },
] as const;

const logLevels = ["debug", "info", "warn", "error"] as const;
</script>

<template>
  <div class="view-container">
    <div class="section-header">
      <h2>Application Settings</h2>
      <p>
        Configure theme appearance, logging verbosity, and runtime behavior.
      </p>
    </div>

    <div class="settings-group">
      <div class="setting-row">
        <div class="setting-info">
          <label class="setting-label">Interface Theme</label>
          <span class="setting-desc"
            >Select visual color theme for the shell layout</span
          >
        </div>
        <div class="setting-control">
          <div class="radio-pill-group">
            <button
              v-for="t in themes"
              :key="t.id"
              :id="`theme-btn-${t.id}`"
              :class="[
                'pill-btn',
                { active: store.state.settings.theme === t.id },
              ]"
              @click="store.updateSettings({ theme: t.id })"
            >
              {{ t.label }}
            </button>
          </div>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <label class="setting-label">Log Level</label>
          <span class="setting-desc"
            >Verbosity threshold for console and diagnostic outputs</span
          >
        </div>
        <div class="setting-control">
          <select
            id="log-level-select"
            class="custom-select"
            :value="store.state.settings.logLevel"
            @change="
              (e) =>
                store.updateSettings({
                  logLevel: (e.target as HTMLSelectElement).value as any,
                })
            "
          >
            <option v-for="lvl in logLevels" :key="lvl" :value="lvl">
              {{ lvl.toUpperCase() }}
            </option>
          </select>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <label class="setting-label">Anonymous Crash Telemetry</label>
          <span class="setting-desc"
            >Disabled by default per strict privacy baseline</span
          >
        </div>
        <div class="setting-control">
          <label class="switch">
            <input
              id="telemetry-toggle-checkbox"
              type="checkbox"
              :checked="store.state.settings.telemetryEnabled"
              @change="
                (e) =>
                  store.updateSettings({
                    telemetryEnabled: (e.target as HTMLInputElement).checked,
                  })
              "
            />
            <span class="slider"></span>
          </label>
        </div>
      </div>
    </div>

    <div class="settings-group">
      <div class="setting-row">
        <div class="setting-info">
          <label class="setting-label">Menubar Window</label>
          <span class="setting-desc">
            Show or hide the independent floating Menubar window
            <span class="shortcut-badge">Ctrl+B</span>
            <span class="shortcut-badge">Global: Ctrl+Alt+B</span>
          </span>
        </div>
        <div class="setting-control">
          <label class="switch">
            <input
              id="settings-menubar-toggle"
              type="checkbox"
              :checked="store.state.menubarVisible"
              @change="
                (e) =>
                  store.toggleMenubar((e.target as HTMLInputElement).checked)
              "
            />
            <span class="slider"></span>
          </label>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <label class="setting-label">Compact Menubar</label>
          <span class="setting-desc">
            Collapse Menubar to icon rail width
            <span class="shortcut-badge">Ctrl+Shift+B</span>
          </span>
        </div>
        <div class="setting-control">
          <label class="switch">
            <input
              id="settings-menubar-collapse-toggle"
              type="checkbox"
              :checked="store.state.sidebarCollapsed"
              @change="
                (e) =>
                  store.toggleSidebar((e.target as HTMLInputElement).checked)
              "
            />
            <span class="slider"></span>
          </label>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <label class="setting-label">Functional Panel Window</label>
          <span class="setting-desc">
            Show or hide the independent Workspace Panel window
            <span class="shortcut-badge">Ctrl+\</span>
            <span class="shortcut-badge">Global: Ctrl+Alt+\</span>
          </span>
        </div>
        <div class="setting-control">
          <label class="switch">
            <input
              id="settings-panel-toggle"
              type="checkbox"
              :checked="store.state.panelVisible"
              @change="
                (e) => store.togglePanel((e.target as HTMLInputElement).checked)
              "
            />
            <span class="slider"></span>
          </label>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <label class="setting-label">Window Positioning</label>
          <span class="setting-desc">
            Drag the top edge of either window to move freely, or reset both
            side-by-side
          </span>
        </div>
        <div class="setting-control">
          <button
            id="settings-reset-layout-btn"
            type="button"
            class="layout-reset-btn"
            @click="store.resetWorkspaceLayout()"
          >
            Arrange Side-by-Side
          </button>
        </div>
      </div>
    </div>

    <div class="info-card">
      <h4>Runtime Environment Details</h4>
      <p>
        Running on
        <strong>{{ store.platform.value.toUpperCase() }}</strong> runtime.
        <span v-if="store.platform.value === 'electron'">
          Operating inside native desktop shell with secure IPC bridge.
        </span>
        <span v-else> Operating with desktop standalone runtime. </span>
      </p>
    </div>
  </div>
</template>

<style scoped>
.view-container {
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  padding: clamp(20px, 4vw, 40px) clamp(14px, 3vw, 24px);
  box-sizing: border-box;
  min-width: 0;
}

.section-header {
  margin-bottom: 32px;
}

.section-header h2 {
  font-size: clamp(1.35rem, 3vw, 1.8rem);
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.section-header p {
  color: var(--text-secondary);
}

.settings-group {
  background: var(--bg-card);
  border: none;
  border-radius: var(--radius-lg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  box-shadow: var(--glass-shadow-sm);
  padding: 8px 24px;
  margin-bottom: 24px;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 0;
  border: none;
  gap: 16px;
}

.setting-row:last-child {
  border-bottom: none;
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1 1 200px;
}

.setting-label {
  font-weight: 600;
  color: var(--text-primary);
}

.setting-desc {
  font-size: 0.85rem;
  color: var(--text-muted);
}

.radio-pill-group {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  background: var(--glass-surface-subtle);
  padding: 4px;
  border-radius: var(--radius-sm);
  border: none;
}

.pill-btn {
  padding: 6px 12px;
  font-size: 0.8rem;
  font-weight: 500;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  border: none;
  cursor: pointer;
  background: transparent;
  transition: all var(--transition-fast);
}

.pill-btn.active {
  background: var(--btn-primary-bg);
  color: var(--btn-primary-text);
  font-weight: 600;
}

.custom-select {
  padding: 8px 16px;
  background: var(--glass-input);
  color: var(--text-primary);
  border: none;
  border-radius: var(--radius-sm);
  font-family: var(--font-family-mono);
  font-size: 0.85rem;
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
  background-color: var(--bg-tertiary);
  transition: 0.3s;
  border-radius: 24px;
  border: none;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.12);
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
  background-color: var(--text-primary);
}

input:checked + .slider:before {
  transform: translateX(20px);
  background-color: var(--bg-primary);
}

.info-card {
  padding: 20px;
  background: var(--glass-surface-subtle);
  border: none;
  box-shadow: var(--glass-specular), var(--glass-shadow-sm);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.info-card h4 {
  color: var(--text-primary);
  margin-bottom: 6px;
}

.shortcut-badge {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 7px;
  border-radius: 6px;
  background: var(--glass-surface-subtle);
  color: var(--text-primary);
  font-family: var(--font-family-mono);
  font-size: 0.72rem;
  font-weight: 500;
}

.layout-reset-btn {
  padding: 7px 14px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--glass-surface-strong);
  color: var(--text-primary);
  font-size: 0.82rem;
  font-weight: 600;
  box-shadow: var(--glass-specular), var(--glass-shadow-sm);
  cursor: pointer;
  transition:
    background-color var(--transition-fast),
    transform var(--transition-fast);
}

.layout-reset-btn:hover {
  background: var(--bg-hover);
  transform: translateY(-1px);
}

@media (max-width: 640px) {
  .setting-row {
    flex-wrap: wrap;
    gap: 12px;
  }
}
</style>
