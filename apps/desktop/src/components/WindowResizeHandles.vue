<script setup lang="ts">
import { onBeforeUnmount } from "vue";

const props = withDefaults(
  defineProps<{
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
  }>(),
  {
    minWidth: 540,
    maxWidth: 3840,
    minHeight: 440,
  },
);

type ResizeDir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

let activeDir: ResizeDir | null = null;
let startScreenX = 0;
let startScreenY = 0;
let startBounds = { x: 0, y: 0, width: 800, height: 600 };
let rafScheduled = false;
let pendingBounds: {
  x: number;
  y: number;
  width: number;
  height: number;
} | null = null;

function flushBounds() {
  rafScheduled = false;
  if (!pendingBounds) return;
  const target = pendingBounds;
  pendingBounds = null;
  window.desktopAPI?.workspace?.setWindowBounds?.(target).catch(() => {});
}

function handlePointerMove(e: PointerEvent) {
  if (!activeDir) return;
  const dx = e.screenX - startScreenX;
  const dy = e.screenY - startScreenY;

  let nextX = startBounds.x;
  let nextY = startBounds.y;
  let nextW = startBounds.width;
  let nextH = startBounds.height;

  if (activeDir.includes("e")) {
    nextW = Math.max(
      props.minWidth,
      Math.min(props.maxWidth, startBounds.width + dx),
    );
  }
  if (activeDir.includes("s")) {
    nextH = Math.max(props.minHeight, Math.min(2160, startBounds.height + dy));
  }
  if (activeDir.includes("w")) {
    const clampedW = Math.max(
      props.minWidth,
      Math.min(props.maxWidth, startBounds.width - dx),
    );
    nextX = startBounds.x + (startBounds.width - clampedW);
    nextW = clampedW;
  }
  if (activeDir.includes("n")) {
    const clampedH = Math.max(
      props.minHeight,
      Math.min(2160, startBounds.height - dy),
    );
    nextY = startBounds.y + (startBounds.height - clampedH);
    nextH = clampedH;
  }

  pendingBounds = { x: nextX, y: nextY, width: nextW, height: nextH };
  if (!rafScheduled) {
    rafScheduled = true;
    requestAnimationFrame(flushBounds);
  }
}

function stopResize() {
  activeDir = null;
  if (typeof window !== "undefined") {
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", stopResize);
    window.removeEventListener("pointercancel", stopResize);
  }
}

async function startResize(dir: ResizeDir, e: PointerEvent) {
  if (
    typeof window === "undefined" ||
    !window.desktopAPI?.workspace?.getWindowBounds ||
    !window.desktopAPI?.workspace?.setWindowBounds
  ) {
    return;
  }
  e.preventDefault();
  e.stopPropagation();

  try {
    const bounds = await window.desktopAPI.workspace.getWindowBounds();
    startBounds = { ...bounds };
    startScreenX = e.screenX;
    startScreenY = e.screenY;
    activeDir = dir;

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize);
    window.addEventListener("pointercancel", stopResize);
  } catch {
    activeDir = null;
  }
}

onBeforeUnmount(() => {
  stopResize();
});
</script>

<template>
  <div class="window-resize-layer" aria-hidden="true">
    <div
      class="resize-edge edge-n"
      @pointerdown="startResize('n', $event)"
    ></div>
    <div
      class="resize-edge edge-s"
      @pointerdown="startResize('s', $event)"
    ></div>
    <div
      class="resize-edge edge-e"
      @pointerdown="startResize('e', $event)"
    ></div>
    <div
      class="resize-edge edge-w"
      @pointerdown="startResize('w', $event)"
    ></div>
    <div
      class="resize-corner corner-nw"
      @pointerdown="startResize('nw', $event)"
    ></div>
    <div
      class="resize-corner corner-ne"
      @pointerdown="startResize('ne', $event)"
    ></div>
    <div
      class="resize-corner corner-sw"
      @pointerdown="startResize('sw', $event)"
    ></div>
    <div
      class="resize-corner corner-se"
      @pointerdown="startResize('se', $event)"
    ></div>
  </div>
</template>

<style scoped>
.window-resize-layer {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 60;
}

.resize-edge,
.resize-corner {
  position: absolute;
  pointer-events: auto;
  -webkit-app-region: no-drag;
}

.edge-n {
  top: 0;
  left: 14px;
  right: 14px;
  height: 5px;
  cursor: ns-resize;
}

.edge-s {
  bottom: 0;
  left: 14px;
  right: 14px;
  height: 5px;
  cursor: ns-resize;
}

.edge-e {
  top: 14px;
  bottom: 14px;
  right: 0;
  width: 5px;
  cursor: ew-resize;
}

.edge-w {
  top: 14px;
  bottom: 14px;
  left: 0;
  width: 5px;
  cursor: ew-resize;
}

.resize-corner {
  width: 14px;
  height: 14px;
}

.corner-nw {
  top: 0;
  left: 0;
  cursor: nwse-resize;
}

.corner-ne {
  top: 0;
  right: 0;
  cursor: nesw-resize;
}

.corner-sw {
  bottom: 0;
  left: 0;
  cursor: nesw-resize;
}

.corner-se {
  bottom: 0;
  right: 0;
  cursor: nwse-resize;
}
</style>
