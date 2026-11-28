<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue";
import { useAppStore, type NavigationTab } from "@vrm/app-core";
import {
  NOTCH_CORNER_OUTER_SIZE,
  NOTCH_CORNER_THICKNESS,
  NOTCH_HORIZONTAL_HEIGHT,
  NOTCH_HORIZONTAL_WIDTH,
  NOTCH_VERTICAL_HEIGHT,
  NOTCH_VERTICAL_WIDTH,
  buildNotchContour,
  contourToSvgPath,
} from "@vrm/shared";
import AppIcon from "./AppIcon.vue";
import DesktopBlurBackdrop from "./DesktopBlurBackdrop.vue";

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
const viewportW = ref(
  typeof window !== "undefined" && window.innerWidth > 0
    ? window.innerWidth
    : 0,
);
const viewportH = ref(
  typeof window !== "undefined" && window.innerHeight > 0
    ? window.innerHeight
    : 0,
);

function checkWidth() {
  if (typeof window !== "undefined") {
    isNarrowViewport.value = window.innerWidth <= 860;
    if (window.innerWidth > 0) viewportW.value = window.innerWidth;
    if (window.innerHeight > 0) viewportH.value = window.innerHeight;
  }
}

const isDetachedWindow = computed(
  () => props.detached || store.state.windowMode === "menubar",
);

const activeDock = computed(() =>
  isDetachedWindow.value ? store.state.menubarDock : "floating",
);

const isCornerFolded = computed(
  () =>
    activeDock.value === "top-left" ||
    activeDock.value === "top-right" ||
    activeDock.value === "bottom-left" ||
    activeDock.value === "bottom-right",
);

const isHorizontalNotch = computed(
  () => activeDock.value === "top" || activeDock.value === "bottom",
);

const isVerticalNotch = computed(
  () => activeDock.value === "left" || activeDock.value === "right",
);

const isEdgeNotch = computed(
  () => isHorizontalNotch.value || isVerticalNotch.value,
);

const notchClipId = "menubar-notch-silhouette-clip";

const notchDimensions = computed(() => {
  if (isCornerFolded.value) {
    const w =
      viewportW.value >= 120 && viewportW.value <= 420
        ? viewportW.value
        : NOTCH_CORNER_OUTER_SIZE;
    const h =
      viewportH.value >= 120 && viewportH.value <= 420
        ? viewportH.value
        : NOTCH_CORNER_OUTER_SIZE;
    return { width: w, height: h };
  }
  if (isHorizontalNotch.value) {
    const w =
      viewportW.value >= 200 && viewportH.value <= 120
        ? viewportW.value
        : NOTCH_HORIZONTAL_WIDTH;
    const h =
      viewportH.value >= 32 && viewportH.value <= 120
        ? viewportH.value
        : NOTCH_HORIZONTAL_HEIGHT;
    return { width: w, height: h };
  }
  if (isVerticalNotch.value) {
    const w =
      viewportW.value >= 32 && viewportW.value <= 120
        ? viewportW.value
        : NOTCH_VERTICAL_WIDTH;
    const h =
      viewportH.value >= 200 && viewportW.value <= 120
        ? viewportH.value
        : NOTCH_VERTICAL_HEIGHT;
    return { width: w, height: h };
  }
  return {
    width: NOTCH_HORIZONTAL_WIDTH,
    height: NOTCH_HORIZONTAL_HEIGHT,
  };
});

const notchSvgPath = computed(() => {
  const dock = activeDock.value;
  if (dock === "floating") return "";
  const { width, height } = notchDimensions.value;
  return contourToSvgPath(
    buildNotchContour(dock, width, height, {
      armThickness: NOTCH_CORNER_THICKNESS,
    }),
  );
});

const notchClipStyle = computed(() =>
  notchSvgPath.value
    ? {
        clipPath: `url(#${notchClipId})`,
        WebkitClipPath: `url(#${notchClipId})`,
      }
    : undefined,
);

const isEffectivelyCollapsed = computed(() => {
  if (store.state.sidebarCollapsed) {
    return true;
  }
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

// Compact priority tabs shown inside compact Edge Notch & 90° Corner L-Notch
const compactNotchTabs = computed<TabDef[]>(() => {
  const flat = tabGroups.value.flatMap((g) => g.tabs);
  const priorityOrder: NavigationTab[] = [
    "chat",
    "avatar",
    "agents",
    "memory",
    "connections",
    "settings",
  ];
  const prioritized = priorityOrder
    .map((id) => flat.find((t) => t.id === id))
    .filter((t): t is TabDef => Boolean(t));
  if (prioritized.length >= 2) {
    return prioritized.slice(0, 5);
  }
  return flat.slice(0, 5);
});

const cornerArmTabs = computed<TabDef[]>(() =>
  compactNotchTabs.value.slice(0, 4),
);

// ---------------------------------------------------------------------------
// Custom Pointer Perimeter Drag (works across edges & 90-degree corners)
// ---------------------------------------------------------------------------
let isDragging = false;
let grabOffsetX = 0;
let grabOffsetY = 0;
let lastCursorX = 0;
let lastCursorY = 0;
let dragRafId: number | null = null;

function flushMenubarDrag() {
  dragRafId = null;
  if (!isDragging) return;
  store.dragMenubar({
    cursorX: lastCursorX,
    cursorY: lastCursorY,
    grabOffsetX,
    grabOffsetY,
  });
}

function handleDragMove(e: PointerEvent) {
  if (!isDragging) return;
  lastCursorX = e.screenX;
  lastCursorY = e.screenY;
  if (dragRafId === null) {
    dragRafId = requestAnimationFrame(flushMenubarDrag);
  }
}

function stopMenubarDrag() {
  if (!isDragging) return;
  isDragging = false;
  if (dragRafId !== null) {
    cancelAnimationFrame(dragRafId);
    dragRafId = null;
  }
  if (typeof window !== "undefined") {
    window.removeEventListener("pointermove", handleDragMove);
    window.removeEventListener("pointerup", stopMenubarDrag);
    window.removeEventListener("pointercancel", stopMenubarDrag);
  }
}

function startMenubarDrag(e: PointerEvent) {
  if (e.button !== 0 || !isDetachedWindow.value) return;
  const target = e.target as HTMLElement | null;
  if (target?.closest("button")) return;

  e.preventDefault();
  e.stopPropagation();

  isDragging = true;
  grabOffsetX = e.clientX;
  grabOffsetY = e.clientY;
  lastCursorX = e.screenX;
  lastCursorY = e.screenY;

  window.addEventListener("pointermove", handleDragMove);
  window.addEventListener("pointerup", stopMenubarDrag);
  window.addEventListener("pointercancel", stopMenubarDrag);
}

onMounted(() => {
  checkWidth();
  window.addEventListener("resize", checkWidth, { passive: true });
});

onUnmounted(() => {
  stopMenubarDrag();
  window.removeEventListener("resize", checkWidth);
});
</script>

<template>
  <!-- Shared Parametric iPhone-Notch / 90° Corner L-Notch SVG Clip Mask -->
  <svg
    v-if="activeDock !== 'floating' && notchSvgPath"
    width="0"
    height="0"
    class="notch-clip-defs"
    aria-hidden="true"
  >
    <defs>
      <clipPath :id="notchClipId" clipPathUnits="userSpaceOnUse">
        <path :d="notchSvgPath" />
      </clipPath>
    </defs>
  </svg>

  <!-- 1. 90-Degree Folded L-Shaped Corner Notch (`top-left`, `top-right`, `bottom-left`, `bottom-right`) -->
  <aside
    v-if="isCornerFolded"
    :class="['corner-notch-shell', `dock-${activeDock}`]"
    role="navigation"
    aria-label="Corner Folded Menubar"
  >
    <div class="corner-l-assembly" :style="notchClipStyle">
      <!-- Joint Corner Pivot Handle (Drag to slide out along either edge or detach to floating) -->
      <div
        class="corner-pivot-handle"
        title="Drag to slide around screen border or pull inward to expand"
        @pointerdown="startMenubarDrag"
        @dblclick="store.setMenubarDock('floating')"
      >
        <AppIcon name="grip" size="13" class="grip-icon" />
      </div>

      <!-- Horizontal Arm: Primary Compact Tabs -->
      <div
        class="corner-arm corner-arm-horizontal"
        @pointerdown="startMenubarDrag"
      >
        <button
          v-for="tab in cornerArmTabs"
          :key="tab.id"
          :id="`nav-tab-${tab.id}`"
          :class="[
            'notch-icon-btn',
            { active: store.state.currentTab === tab.id },
          ]"
          :title="tab.label"
          :aria-label="tab.label"
          :aria-current="store.state.currentTab === tab.id ? 'page' : undefined"
          @click="store.setTab(tab.id)"
        >
          <AppIcon :name="tab.icon" size="15" />
        </button>
      </div>

      <!-- Vertical Arm: Compact Utility Controls -->
      <div
        class="corner-arm corner-arm-vertical"
        @pointerdown="startMenubarDrag"
      >
        <button
          id="nav-stage-toggle-btn"
          type="button"
          :class="[
            'notch-icon-btn',
            store.state.stageStatus.stageVisible
              ? 'stage-dot-active'
              : undefined,
          ]"
          :title="
            store.state.stageStatus.stageVisible
              ? 'Hide Avatar Stage (Ctrl+Shift+A)'
              : 'Show Avatar Stage (Ctrl+Shift+A)'
          "
          @click="store.toggleStage()"
        >
          <span class="notch-stage-dot"></span>
        </button>

        <button
          id="panel-visibility-btn"
          type="button"
          :class="['notch-icon-btn', { active: store.state.panelVisible }]"
          :title="
            store.state.panelVisible
              ? 'Hide Panel (Ctrl+\\)'
              : 'Show Panel (Ctrl+\\)'
          "
          @click="store.togglePanel()"
        >
          <AppIcon name="panel" size="14" />
        </button>

        <button
          id="theme-toggle-btn"
          type="button"
          class="notch-icon-btn"
          :title="
            store.resolvedTheme.value === 'dark'
              ? 'Switch to White Background'
              : 'Switch to Black Background'
          "
          @click="store.toggleTheme()"
        >
          <AppIcon
            :name="store.resolvedTheme.value === 'dark' ? 'sun' : 'moon'"
            size="14"
          />
        </button>

        <button
          id="notch-undock-btn"
          type="button"
          class="notch-icon-btn"
          title="Expand to Floating Menubar"
          aria-label="Expand to Floating Menubar"
          @click="store.setMenubarDock('floating')"
        >
          <AppIcon name="maximize" size="12" />
        </button>
      </div>
    </div>
  </aside>

  <!-- 2. Compact Screen-Edge Notch (`top`, `bottom`, `left`, `right`) -->
  <aside
    v-else-if="isEdgeNotch"
    :class="[
      'edge-notch-bar',
      `dock-${activeDock}`,
      {
        'notch-horizontal': isHorizontalNotch,
        'notch-vertical': isVerticalNotch,
      },
    ]"
    :style="notchClipStyle"
    role="navigation"
    aria-label="Edge Notch Menubar"
    @pointerdown="startMenubarDrag"
    @dblclick="store.setMenubarDock('floating')"
  >
    <div
      class="notch-drag-grip"
      title="Drag along screen edge or pull inward to expand"
    >
      <AppIcon name="grip" size="13" class="grip-icon" />
    </div>

    <div class="notch-tabs-strip">
      <button
        v-for="tab in compactNotchTabs"
        :key="tab.id"
        :id="`nav-tab-${tab.id}`"
        :class="[
          'notch-icon-btn',
          { active: store.state.currentTab === tab.id },
        ]"
        :title="tab.label"
        :aria-label="tab.label"
        :aria-current="store.state.currentTab === tab.id ? 'page' : undefined"
        @click="store.setTab(tab.id)"
      >
        <AppIcon :name="tab.icon" size="15" />
      </button>
    </div>

    <span class="notch-divider-dot" aria-hidden="true"></span>

    <div class="notch-utility-strip">
      <button
        id="nav-stage-toggle-btn"
        type="button"
        :class="[
          'notch-icon-btn',
          store.state.stageStatus.stageVisible ? 'stage-dot-active' : undefined,
        ]"
        :title="
          store.state.stageStatus.stageVisible
            ? 'Hide Avatar Stage (Ctrl+Shift+A)'
            : 'Show Avatar Stage (Ctrl+Shift+A)'
        "
        @click="store.toggleStage()"
      >
        <span class="notch-stage-dot"></span>
      </button>

      <button
        id="panel-visibility-btn"
        type="button"
        :class="['notch-icon-btn', { active: store.state.panelVisible }]"
        :title="
          store.state.panelVisible
            ? 'Hide Panel (Ctrl+\\)'
            : 'Show Panel (Ctrl+\\)'
        "
        @click="store.togglePanel()"
      >
        <AppIcon name="panel" size="14" />
      </button>

      <button
        id="theme-toggle-btn"
        type="button"
        class="notch-icon-btn"
        :title="
          store.resolvedTheme.value === 'dark'
            ? 'Switch to White Background'
            : 'Switch to Black Background'
        "
        @click="store.toggleTheme()"
      >
        <AppIcon
          :name="store.resolvedTheme.value === 'dark' ? 'sun' : 'moon'"
          size="14"
        />
      </button>

      <button
        id="notch-undock-btn"
        type="button"
        class="notch-icon-btn"
        title="Expand to Floating Menubar"
        aria-label="Expand to Floating Menubar"
        @click="store.setMenubarDock('floating')"
      >
        <AppIcon name="maximize" size="12" />
      </button>
    </div>
  </aside>

  <!-- 3. Standard Floating Menubar Sidebar (`floating`) -->
  <aside
    v-else
    :class="[
      'workspace-sidebar',
      {
        collapsed: isEffectivelyCollapsed,
        detached: isDetachedWindow,
        'backdrop-active':
          isDetachedWindow && Boolean(store.state.desktopBackdrop?.imageUrl),
      },
    ]"
    role="navigation"
    aria-label="Sidebar Navigation"
  >
    <DesktopBlurBackdrop v-if="isDetachedWindow" />
    <!-- Interactive Drag Handle (Drag to any screen edge to morph into Dynamic Notch!) -->
    <div
      class="sidebar-drag-bar"
      title="Drag to move (snap to any screen edge for compact Notch)"
      @pointerdown="startMenubarDrag"
    >
      <div class="sidebar-drag-grip">
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
              ? 'Switch to White Background'
              : 'Switch to Black Background'
          "
          :aria-label="
            store.resolvedTheme.value === 'dark'
              ? 'Switch to White Background Mode'
              : 'Switch to Black Background Mode'
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
/* =========================================================================
   1. Edge Notch Mode (`top`, `bottom`, `left`, `right`)
      Clipped by exact SVG `<clipPath>` iPhone-notch contour (concave ears
      flaring flush into screen edge + smooth deep convex inner corners).
   ========================================================================= */
.notch-clip-defs {
  position: fixed;
  width: 0;
  height: 0;
  pointer-events: none;
  overflow: hidden;
}

.edge-notch-bar {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--notch-surface);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: none;
  user-select: none;
  cursor: grab;
  overflow: hidden;
  transition: background-color var(--transition-fast);
}

.edge-notch-bar:active {
  cursor: grabbing;
}

.edge-notch-bar.dock-top {
  flex-direction: row;
  padding: 2px 24px 5px;
}

.edge-notch-bar.dock-bottom {
  flex-direction: row;
  padding: 5px 24px 2px;
}

.edge-notch-bar.dock-left {
  flex-direction: column;
  padding: 24px 5px 24px 2px;
}

.edge-notch-bar.dock-right {
  flex-direction: column;
  padding: 24px 2px 24px 5px;
}

.notch-drag-grip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  opacity: 0.65;
  padding: 2px;
  flex-shrink: 0;
}

.notch-divider-dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--text-muted);
  opacity: 0.4;
  flex-shrink: 0;
}

.notch-tabs-strip,
.notch-utility-strip {
  display: flex;
  align-items: center;
  gap: 3px;
}

.notch-vertical .notch-tabs-strip,
.notch-vertical .notch-utility-strip {
  flex-direction: column;
}

.notch-icon-btn {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 9999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  flex-shrink: 0;
  transition:
    background-color var(--transition-fast),
    color var(--transition-fast),
    transform var(--transition-fast),
    box-shadow var(--transition-fast);
}

.notch-icon-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  transform: scale(1.06);
}

.notch-icon-btn.active {
  background: var(--bg-selected);
  color: var(--text-primary);
  box-shadow: var(--glass-shadow-sm);
}

.notch-stage-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-muted);
  transition:
    background-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.notch-icon-btn.stage-dot-active .notch-stage-dot {
  background: var(--accent-success);
  box-shadow: 0 0 8px var(--accent-success);
}

/* =========================================================================
   2. 90-Degree L-Shaped Corner Notch (`top-left`, `top-right`, `bottom-*`)
      Single unified L-assembly clipped via SVG `<clipPath>` (no corner overlap).
   ========================================================================= */
.corner-notch-shell {
  width: 100%;
  height: 100%;
  position: relative;
  background: transparent;
  pointer-events: none;
  user-select: none;
}

.corner-l-assembly {
  position: relative;
  width: 100%;
  height: 100%;
  background: var(--notch-surface);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: none;
  pointer-events: auto;
  cursor: grab;
  transition: background-color var(--transition-fast);
}

.corner-l-assembly:active {
  cursor: grabbing;
}

.corner-pivot-handle,
.corner-arm {
  position: absolute;
  background: transparent;
  border: none;
  pointer-events: auto;
  display: flex;
  align-items: center;
  cursor: grab;
}

.corner-pivot-handle:active,
.corner-arm:active {
  cursor: grabbing;
}

.corner-pivot-handle {
  width: 48px;
  height: 48px;
  justify-content: center;
  color: var(--text-muted);
  z-index: 3;
}

.corner-arm-horizontal {
  height: 48px;
  width: calc(100% - 66px);
  flex-direction: row;
  justify-content: space-evenly;
  padding: 0 4px;
  gap: 2px;
  z-index: 2;
}

.corner-arm-vertical {
  width: 48px;
  height: calc(100% - 66px);
  flex-direction: column;
  justify-content: space-evenly;
  padding: 4px 0;
  gap: 2px;
  z-index: 2;
}

/* Position L-shape arms cleanly around each of the 4 screen corners */
.dock-top-left .corner-pivot-handle {
  top: 0;
  left: 0;
}
.dock-top-left .corner-arm-horizontal {
  top: 0;
  left: 48px;
}
.dock-top-left .corner-arm-vertical {
  top: 48px;
  left: 0;
}

.dock-top-right .corner-pivot-handle {
  top: 0;
  right: 0;
}
.dock-top-right .corner-arm-horizontal {
  top: 0;
  right: 48px;
}
.dock-top-right .corner-arm-vertical {
  top: 48px;
  right: 0;
}

.dock-bottom-left .corner-pivot-handle {
  bottom: 0;
  left: 0;
}
.dock-bottom-left .corner-arm-horizontal {
  bottom: 0;
  left: 48px;
}
.dock-bottom-left .corner-arm-vertical {
  bottom: 48px;
  left: 0;
}

.dock-bottom-right .corner-pivot-handle {
  bottom: 0;
  right: 0;
}
.dock-bottom-right .corner-arm-horizontal {
  bottom: 0;
  right: 48px;
}
.dock-bottom-right .corner-arm-vertical {
  bottom: 48px;
  right: 0;
}

/* =========================================================================
   3. Floating Menubar Sidebar (`floating`)
   ========================================================================= */
.workspace-sidebar {
  width: 224px;
  background: var(--glass-surface);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: none;
  border-radius: var(--radius-window, 24px);
  box-shadow: var(--glass-shadow);
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
  position: relative;
  width: 100%;
  height: 100%;
  border: none;
  border-radius: var(--radius-window, 24px);
  box-shadow: none;
}

.workspace-sidebar.detached.backdrop-active {
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.workspace-sidebar.detached > .sidebar-drag-bar,
.workspace-sidebar.detached > .sidebar-scroll,
.workspace-sidebar.detached > .sidebar-footer {
  position: relative;
  z-index: 1;
}

.workspace-sidebar.collapsed:not(.detached) {
  width: 68px;
}

/* Interactive Drag Handle (JS Pointer Drag so edges/corners snap smoothly) */
.sidebar-drag-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 8px 4px;
  min-height: 34px;
  flex-shrink: 0;
  cursor: grab;
  -webkit-app-region: no-drag;
}

.sidebar-drag-bar:active {
  cursor: grabbing;
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
  height: 6px;
  background: transparent;
  margin: 2px 10px;
}

.sidebar-nav-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: 36px;
  padding: 0 11px;
  border: none;
  border-radius: 14px;
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
  padding: 10px 8px 8px;
  border: none;
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
  font-size: 0.76rem;
  font-weight: 600;
  color: var(--alert-warning-text);
  background: transparent;
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.guest-exit-btn:hover {
  background: var(--alert-warning-bg);
}
</style>
