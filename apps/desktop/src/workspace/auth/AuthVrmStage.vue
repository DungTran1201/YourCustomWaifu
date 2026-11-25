<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from "vue";
import * as THREE from "three";
import { isWebGLAvailable, prefersReducedMotion } from "../../vrm/index.js";
import {
  buildAuthShaderBackdrop,
  type AuthShaderBackdrop,
} from "./auth-shader-backdrop.js";
import type { AuthSceneState } from "./auth-environment-context.js";

const props = withDefaults(
  defineProps<{
    thinking?: boolean;
    panelSwitchTick?: number;
    theme?: "light" | "dark";
  }>(),
  {
    thinking: false,
    panelSwitchTick: 0,
    theme: "light",
  },
);

const emit = defineEmits<{
  (e: "state-change", state: AuthSceneState): void;
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const sceneState = ref<AuthSceneState>("initializing");
const isReducedMotion = ref<boolean>(false);

function setSceneState(next: AuthSceneState) {
  sceneState.value = next;
  emit("state-change", next);
}

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.OrthographicCamera | null = null;
let shaderBackdrop: AuthShaderBackdrop | null = null;

let lastFrameTimeMs: number | null = null;
let elapsedSeconds = 0;
let rafId: number | null = null;
let isUnmounted = false;
let isWindowHiddenOrInactive = false;
let resizeObserver: ResizeObserver | null = null;
let reducedMotionQuery: MediaQueryList | null = null;

function updateViewportLayout() {
  if (!containerRef.value || !renderer) return;
  const width = Math.max(containerRef.value.clientWidth || 1, 320);
  const height = Math.max(containerRef.value.clientHeight || 1, 320);
  renderer.setSize(width, height, false);
  if (scene && camera) {
    renderer.render(scene, camera);
  }
}

function renderFrame() {
  if (
    isUnmounted ||
    isWindowHiddenOrInactive ||
    !renderer ||
    !scene ||
    !camera
  ) {
    rafId = null;
    return;
  }

  rafId = requestAnimationFrame(renderFrame);

  const nowMs =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  const rawDelta =
    lastFrameTimeMs !== null
      ? Math.max(0, (nowMs - lastFrameTimeMs) / 1000)
      : 0;
  lastFrameTimeMs = nowMs;
  const delta = Math.min(rawDelta, 0.1);
  elapsedSeconds += delta;

  shaderBackdrop?.update(elapsedSeconds, delta, isReducedMotion.value);
  renderer.render(scene, camera);

  if (isReducedMotion.value) {
    stopRenderLoop();
  }
}

function applySceneTheme(theme: "light" | "dark") {
  shaderBackdrop?.setTheme(theme);
  if (renderer && scene && camera) {
    shaderBackdrop?.update(elapsedSeconds, 1, true);
    renderer.render(scene, camera);
  }
}

function startRenderLoop() {
  if (isUnmounted || isWindowHiddenOrInactive || !renderer || rafId !== null) {
    return;
  }
  lastFrameTimeMs =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  rafId = requestAnimationFrame(renderFrame);
}

function stopRenderLoop() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  lastFrameTimeMs = null;
}

function syncActivityState() {
  const docHidden = typeof document !== "undefined" && document.hidden;
  const shouldPause = docHidden || isWindowHiddenOrInactive;
  if (shouldPause) {
    stopRenderLoop();
  } else {
    startRenderLoop();
  }
}

function handleVisibilityChange() {
  isWindowHiddenOrInactive =
    typeof document !== "undefined" ? document.hidden : false;
  syncActivityState();
}

function handleWindowBlur() {
  isWindowHiddenOrInactive = true;
  syncActivityState();
}

function handleWindowFocus() {
  if (typeof document === "undefined" || !document.hidden) {
    isWindowHiddenOrInactive = false;
    syncActivityState();
  }
}

function handlePointerMove(e: PointerEvent) {
  if (!containerRef.value) return;
  const rect = containerRef.value.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
  shaderBackdrop?.setPointer(nx, ny);
}

function handleContextLost(e: Event) {
  e.preventDefault();
  stopRenderLoop();
  setSceneState("static-fallback");
}

function handleReducedMotionChange(e: MediaQueryListEvent) {
  isReducedMotion.value = e.matches;
  if (!e.matches) {
    startRenderLoop();
  } else if (renderer && scene && camera) {
    shaderBackdrop?.update(elapsedSeconds, 1, true);
    renderer.render(scene, camera);
    stopRenderLoop();
  }
}

function initGlassShader() {
  const canvas = canvasRef.value;
  const container = containerRef.value;
  if (!canvas || !container) {
    setSceneState("static-fallback");
    return;
  }

  isReducedMotion.value = prefersReducedMotion();

  if (!isWebGLAvailable()) {
    setSceneState("static-fallback");
    return;
  }

  try {
    const width = Math.max(container.clientWidth || window.innerWidth, 320);
    const height = Math.max(container.clientHeight || window.innerHeight, 320);

    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

    canvas.addEventListener("webglcontextlost", handleContextLost, false);

    shaderBackdrop = buildAuthShaderBackdrop(props.theme);
    scene.add(shaderBackdrop.mesh);
    applySceneTheme(props.theme);

    setSceneState("ready");
    renderer.render(scene, camera);
    if (!isReducedMotion.value) {
      startRenderLoop();
    }
  } catch {
    setSceneState("static-fallback");
  }
}

watch(
  () => props.theme,
  (nextTheme) => {
    applySceneTheme(nextTheme);
  },
);

onMounted(() => {
  if (typeof window !== "undefined") {
    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener("resize", updateViewportLayout, { passive: true });

    if (typeof window.matchMedia === "function") {
      reducedMotionQuery = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      );
      reducedMotionQuery.addEventListener("change", handleReducedMotionChange);
    }
  }
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }
  if (typeof ResizeObserver !== "undefined" && containerRef.value) {
    resizeObserver = new ResizeObserver(() => {
      updateViewportLayout();
    });
    resizeObserver.observe(containerRef.value);
  }

  initGlassShader();
});

onBeforeUnmount(() => {
  isUnmounted = true;
  stopRenderLoop();

  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (reducedMotionQuery) {
    reducedMotionQuery.removeEventListener("change", handleReducedMotionChange);
    reducedMotionQuery = null;
  }
  if (typeof window !== "undefined") {
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("blur", handleWindowBlur);
    window.removeEventListener("focus", handleWindowFocus);
    window.removeEventListener("resize", updateViewportLayout);
  }
  if (typeof document !== "undefined") {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  }
  if (canvasRef.value) {
    canvasRef.value.removeEventListener("webglcontextlost", handleContextLost);
  }

  shaderBackdrop?.dispose();
  shaderBackdrop = null;

  if (renderer) {
    renderer.dispose();
    renderer = null;
  }
  scene = null;
  camera = null;
});
</script>

<template>
  <div
    ref="containerRef"
    class="obsidian-chamber-stage auth-3d-stage"
    :class="[
      `state-${sceneState}`,
      props.theme === 'dark' ? 'theme-dark' : 'theme-light',
    ]"
    aria-hidden="true"
  >
    <!-- Fallback Translucent Glow when WebGL is unavailable -->
    <div
      v-if="sceneState === 'static-fallback'"
      class="obsidian-static-fallback"
      data-testid="auth-static-fallback"
    >
      <div class="fallback-center-sheen"></div>
    </div>

    <!-- Pattern-free Alpha WebGL Ambient Sheen -->
    <canvas
      ref="canvasRef"
      class="obsidian-webgl-canvas"
      :class="{ 'canvas-hidden': sceneState === 'static-fallback' }"
    ></canvas>
  </div>
</template>

<style scoped>
.obsidian-chamber-stage {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: transparent;
  pointer-events: none;
  z-index: 1;
}

.obsidian-webgl-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}

.obsidian-webgl-canvas.canvas-hidden {
  opacity: 0;
  visibility: hidden;
}

.obsidian-static-fallback {
  position: absolute;
  inset: 0;
  background: transparent;
}

.fallback-center-sheen {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    circle at 50% 48%,
    rgba(255, 255, 255, 0.22) 0%,
    transparent 62%
  );
  pointer-events: none;
}

.theme-dark .fallback-center-sheen {
  background: radial-gradient(
    circle at 50% 48%,
    rgba(96, 112, 185, 0.14) 0%,
    transparent 62%
  );
}
</style>
