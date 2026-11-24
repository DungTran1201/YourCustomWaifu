<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from "vue";
import * as THREE from "three";
import { VRMUtils, type VRM } from "@pixiv/three-vrm";
import {
  isWebGLAvailable,
  prefersReducedMotion,
  parseVrmFromBuffer,
  loadBundledDefaultVrmBuffer,
  applyOrientation,
  VRMCompanionAnimationController,
} from "../../vrm/index.js";
import {
  buildObsidianGlassChamber,
  type ObsidianChamberInstance,
} from "./obsidian-chamber-builder.js";
import type { AuthSceneState } from "./auth-environment-context.js";

const props = withDefaults(
  defineProps<{
    thinking?: boolean;
    panelSwitchTick?: number;
  }>(),
  {
    thinking: false,
    panelSwitchTick: 0,
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

// Single Owned Three.js / VRM Runtime References
let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let chamber: ObsidianChamberInstance | null = null;
let modelRoot: THREE.Group | null = null;
let lookAtTarget: THREE.Object3D | null = null;
let currentVrm: VRM | null = null;

let lastFrameTimeMs: number | null = null;
let elapsedSeconds = 0;
let entranceElapsed = 0;
const ENTRANCE_DURATION = 1.1;
const animController = new VRMCompanionAnimationController();

let rafId: number | null = null;
let isUnmounted = false;
let isWindowHiddenOrInactive = false;
let loadAbortController: AbortController | null = null;
let resizeObserver: ResizeObserver | null = null;
let reducedMotionQuery: MediaQueryList | null = null;

// Subtle camera spatial parallax state
let pointerNormX = 0;
let pointerNormY = 0;
let camOffsetX = 0;
let camOffsetY = 0;

/**
 * Computes responsive 3D Chamber framing:
 * The 2D Authentication Panel floats dead-center, while the VRM Companion stands
 * inside the right wing of the 3D Obsidian Glass Chamber so her face & silhouette
 * remain unobstructed across desktop window sizes.
 */
function computeChamberFraming(width: number, height: number) {
  const safeW = Math.max(width, 320);
  const safeH = Math.max(height, 320);
  const aspect = safeW / safeH;

  // Companion stands inside the right chamber alcove, scaling smoothly with aspect ratio
  const charX = THREE.MathUtils.clamp(0.24 + aspect * 0.36, 0.62, 0.86);
  const charZ = -0.34;
  const camZ = safeW < 920 ? 2.62 : 2.46;
  const camY = safeH < 620 ? 1.26 : 1.29;

  return { aspect, charX, charZ, camZ, camY };
}

function easeOutCubic(t: number): number {
  const clamped = THREE.MathUtils.clamp(t, 0, 1);
  return 1 - Math.pow(1 - clamped, 3);
}

function applyVrmShadowCasting(vrm: VRM) {
  vrm.scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = false;
      mesh.renderOrder = 5;
    }
  });
}

function updateViewportLayout() {
  if (!containerRef.value || !renderer || !camera) return;
  const width = Math.max(
    containerRef.value.clientWidth || window.innerWidth,
    320,
  );
  const height = Math.max(
    containerRef.value.clientHeight || window.innerHeight,
    320,
  );

  const { aspect, charX, charZ, camZ, camY } = computeChamberFraming(
    width,
    height,
  );

  const entranceProgress = isReducedMotion.value
    ? 1
    : easeOutCubic(entranceElapsed / ENTRANCE_DURATION);
  const dollyZ = THREE.MathUtils.lerp(camZ + 0.38, camZ, entranceProgress);
  const dollyY = THREE.MathUtils.lerp(camY + 0.08, camY, entranceProgress);

  camera.aspect = aspect;
  camera.position.set(camOffsetX, dollyY + camOffsetY, dollyZ);
  camera.lookAt(0.0, 1.24, -0.45);
  camera.updateProjectionMatrix();

  renderer.setSize(width, height, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));

  if (modelRoot) {
    modelRoot.position.set(charX, 0, charZ);
  }
  chamber?.setCompanionPosition(charX, charZ);
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
  entranceElapsed = Math.min(ENTRANCE_DURATION, entranceElapsed + delta);

  const entranceProgress = isReducedMotion.value
    ? 1
    : easeOutCubic(entranceElapsed / ENTRANCE_DURATION);

  // Restrained camera spatial parallax inside the 3D Chamber
  const targetCamX = isReducedMotion.value ? 0 : pointerNormX * 0.042;
  const targetCamY = isReducedMotion.value ? 0 : -pointerNormY * 0.022;
  const camLerp = 1 - Math.exp(-4.5 * delta);
  camOffsetX = THREE.MathUtils.lerp(camOffsetX, targetCamX, camLerp);
  camOffsetY = THREE.MathUtils.lerp(camOffsetY, targetCamY, camLerp);

  const height = containerRef.value?.clientHeight || window.innerHeight || 740;
  const width = containerRef.value?.clientWidth || window.innerWidth || 1100;
  const baseCamZ = width < 920 ? 2.62 : 2.46;
  const baseCamY = height < 620 ? 1.26 : 1.29;
  const dollyZ = THREE.MathUtils.lerp(
    baseCamZ + 0.38,
    baseCamZ,
    entranceProgress,
  );
  const dollyY = THREE.MathUtils.lerp(
    baseCamY + 0.08,
    baseCamY,
    entranceProgress,
  );

  camera.position.set(camOffsetX, dollyY + camOffsetY, dollyZ);
  camera.lookAt(0.0, 1.24, -0.45);

  chamber?.updateAmbient(elapsedSeconds, entranceProgress);

  if (currentVrm) {
    animController.update(delta);
  }

  renderer.render(scene, camera);

  if (isReducedMotion.value && currentVrm) {
    stopRenderLoop();
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
    animController.pause();
    stopRenderLoop();
  } else {
    animController.resume();
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
  if (
    isWindowHiddenOrInactive &&
    (typeof document === "undefined" || !document.hidden)
  ) {
    isWindowHiddenOrInactive = false;
    syncActivityState();
  }
  const rect = containerRef.value.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  pointerNormX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointerNormY = ((e.clientY - rect.top) / rect.height) * 2 - 1;
  animController.setPointerTarget(pointerNormX, pointerNormY);
}

function handleContextLost(e: Event) {
  e.preventDefault();
  stopRenderLoop();
  setSceneState("static-fallback");
}

function handleReducedMotionChange(e: MediaQueryListEvent) {
  isReducedMotion.value = e.matches;
  animController.setReducedMotion(e.matches);
  if (!e.matches) {
    startRenderLoop();
  } else if (renderer && scene && camera) {
    entranceElapsed = ENTRANCE_DURATION;
    updateViewportLayout();
    renderer.render(scene, camera);
    stopRenderLoop();
  }
}

async function initObsidianScene() {
  const canvas = canvasRef.value;
  const container = containerRef.value;
  if (!canvas || !container) {
    setSceneState("static-fallback");
    return;
  }

  isReducedMotion.value = prefersReducedMotion();
  entranceElapsed = isReducedMotion.value ? ENTRANCE_DURATION : 0;

  if (!isWebGLAvailable()) {
    setSceneState("static-fallback");
    return;
  }

  try {
    const width = Math.max(container.clientWidth || window.innerWidth, 320);
    const height = Math.max(container.clientHeight || window.innerHeight, 320);
    const { aspect, charX, charZ, camZ, camY } = computeChamberFraming(
      width,
      height,
    );

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05060a);
    scene.fog = new THREE.FogExp2(0x05060a, 0.055);

    camera = new THREE.PerspectiveCamera(34, aspect, 0.1, 24);
    const startZ = isReducedMotion.value ? camZ : camZ + 0.38;
    const startY = isReducedMotion.value ? camY : camY + 0.08;
    camera.position.set(0, startY, startZ);
    camera.lookAt(0.0, 1.24, -0.45);

    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: false,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    canvas.addEventListener("webglcontextlost", handleContextLost, false);

    // 3D Obsidian Chamber Lighting & Soft Shadow System
    const hemiLight = new THREE.HemisphereLight(0x4a4d82, 0x07080e, 1.55);
    scene.add(hemiLight);

    const keyShadowLight = new THREE.DirectionalLight(0xf1eefb, 2.35);
    keyShadowLight.position.set(-0.85, 2.55, 2.15);
    keyShadowLight.castShadow = true;
    keyShadowLight.shadow.mapSize.set(1024, 1024);
    keyShadowLight.shadow.camera.near = 0.4;
    keyShadowLight.shadow.camera.far = 6.5;
    keyShadowLight.shadow.camera.left = -1.8;
    keyShadowLight.shadow.camera.right = 1.8;
    keyShadowLight.shadow.camera.top = 2.4;
    keyShadowLight.shadow.camera.bottom = -0.4;
    keyShadowLight.shadow.bias = -0.0005;
    scene.add(keyShadowLight);

    const violetRimLight = new THREE.DirectionalLight(0x9185d9, 2.2);
    violetRimLight.position.set(2.05, 1.95, -1.65);
    scene.add(violetRimLight);

    const dustyRoseLight = new THREE.PointLight(0xb9789b, 2.1, 6.5, 1.5);
    dustyRoseLight.position.set(-1.6, 1.35, -0.95);
    scene.add(dustyRoseLight);

    // Build True 3D Rectangular Smoked-Glass Obsidian Chamber
    chamber = buildObsidianGlassChamber(charX, charZ);
    scene.add(chamber.root);

    // Companion Root inside right wing of the Chamber
    modelRoot = new THREE.Group();
    modelRoot.name = "ChamberCompanionRoot";
    modelRoot.position.set(charX, 0, charZ);
    modelRoot.renderOrder = 5;
    scene.add(modelRoot);

    lookAtTarget = new THREE.Object3D();
    lookAtTarget.position.set(0.0, 1.3, 2.2);
    scene.add(lookAtTarget);

    setSceneState("loading-vrm");
    renderer.render(scene, camera);
    if (!isReducedMotion.value) {
      startRenderLoop();
    }
  } catch {
    setSceneState("static-fallback");
    return;
  }

  // Stream & attach bundled default VRM Companion inside the Obsidian Chamber
  loadAbortController = new AbortController();
  try {
    const { data } = await loadBundledDefaultVrmBuffer(
      loadAbortController.signal,
    );
    if (isUnmounted || !scene || !modelRoot) return;

    const parsed = await parseVrmFromBuffer(data, 4);
    if (isUnmounted || !scene || !modelRoot) {
      VRMUtils.deepDispose(parsed.vrm.scene);
      return;
    }

    currentVrm = parsed.vrm;
    applyVrmShadowCasting(currentVrm);
    // Angle ~19.5 deg inward toward the centered Authentication Panel & user
    applyOrientation(currentVrm, modelRoot, "auto", -0.34);
    modelRoot.add(currentVrm.scene);

    animController.setup(
      currentVrm,
      parsed.animations,
      lookAtTarget ?? undefined,
      {
        reducedMotion: isReducedMotion.value,
      },
    );

    // Settle bone transforms & reset spring-bone physics so hair/clothing start calm
    scene.updateMatrixWorld(true);
    currentVrm.springBoneManager?.reset();

    if (props.thinking) {
      animController.setThinking(true);
    }

    animController.playGreetingOnce();
    animController.update(1 / 60);

    setSceneState("ready");
    if (renderer && camera) {
      renderer.render(scene, camera);
    }

    if (!isReducedMotion.value) {
      startRenderLoop();
    }
  } catch {
    if (!isUnmounted) {
      stopRenderLoop();
      setSceneState("static-fallback");
    }
  }
}

watch(
  () => props.thinking,
  (active) => {
    animController.setThinking(Boolean(active));
  },
);

watch(
  () => props.panelSwitchTick,
  () => {
    animController.triggerPanelSwitchReaction();
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

  void initObsidianScene();
});

onBeforeUnmount(() => {
  isUnmounted = true;
  loadAbortController?.abort();
  loadAbortController = null;
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

  animController.dispose();

  if (currentVrm) {
    try {
      modelRoot?.remove(currentVrm.scene);
      VRMUtils.deepDispose(currentVrm.scene);
    } catch {
      // Safe cleanup
    }
    currentVrm = null;
  }

  chamber?.dispose();
  chamber = null;
  modelRoot = null;
  lookAtTarget = null;

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
    :data-scene-state="sceneState"
    aria-hidden="true"
  >
    <!-- Static Fallback when WebGL or VRM is unavailable (e.g. headless JSDOM or GPU disabled) -->
    <div
      v-if="sceneState === 'static-fallback'"
      class="obsidian-static-fallback"
      data-testid="auth-static-fallback"
    >
      <div class="fallback-back-glass"></div>
      <div class="fallback-floor-plane"></div>
    </div>

    <!-- Real Three.js 3D Obsidian Glass Chamber WebGL Canvas -->
    <canvas
      ref="canvasRef"
      class="obsidian-webgl-canvas"
      :class="{ 'canvas-hidden': sceneState === 'static-fallback' }"
    ></canvas>

    <!-- Subtle Perimeter Depth Vignette -->
    <div class="obsidian-vignette"></div>
  </div>
</template>

<style scoped>
.obsidian-chamber-stage {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: #05060a;
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
  background:
    radial-gradient(
      circle at 74% 44%,
      rgba(145, 133, 217, 0.14) 0%,
      rgba(10, 12, 20, 0.85) 48%,
      #05060a 85%
    ),
    radial-gradient(
      circle at 24% 48%,
      rgba(185, 120, 155, 0.08) 0%,
      transparent 50%
    ),
    #05060a;
}

.fallback-back-glass {
  position: absolute;
  inset: 10% 14% 20% 14%;
  border: 1px solid rgba(50, 54, 84, 0.45);
  background: rgba(11, 13, 22, 0.55);
}

.fallback-floor-plane {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 20%;
  border-top: 1px solid rgba(50, 54, 84, 0.4);
  background: linear-gradient(180deg, rgba(11, 13, 22, 0.6), #05060a);
}

.obsidian-vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse at 50% 50%,
    transparent 56%,
    rgba(3, 4, 8, 0.62) 100%
  );
}
</style>
