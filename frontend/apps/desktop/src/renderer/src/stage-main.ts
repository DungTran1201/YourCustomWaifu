import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, type VRM } from "@pixiv/three-vrm";
import type { AvatarConfig, StageStatus } from "@vrm/platform-contracts";

// HTML Elements
const canvas = document.getElementById("stage-canvas") as HTMLCanvasElement;
const loadingOverlay = document.getElementById(
  "stage-loading",
) as HTMLDivElement;
const loadingText = document.getElementById(
  "stage-loading-text",
) as HTMLSpanElement;
const errorOverlay = document.getElementById("stage-error") as HTMLDivElement;
const errorMessage = document.getElementById(
  "stage-error-message",
) as HTMLSpanElement;

// Toolbar Buttons
const btnScaleDown = document.getElementById(
  "btn-scale-down",
) as HTMLButtonElement;
const btnScaleUp = document.getElementById("btn-scale-up") as HTMLButtonElement;
const btnAlwaysOnTop = document.getElementById(
  "btn-always-on-top",
) as HTMLButtonElement;
const btnClickThrough = document.getElementById(
  "btn-click-through",
) as HTMLButtonElement;
const btnPauseAnimation = document.getElementById(
  "btn-pause-animation",
) as HTMLButtonElement;
const btnOpenWorkspace = document.getElementById(
  "btn-open-workspace",
) as HTMLButtonElement;
const btnOpenSettings = document.getElementById(
  "btn-open-settings",
) as HTMLButtonElement;
const btnHideStage = document.getElementById(
  "btn-hide-stage",
) as HTMLButtonElement;
const errorSettingsBtn = document.getElementById(
  "stage-error-settings-btn",
) as HTMLButtonElement;

// Three.js Core
let renderer: THREE.WebGLRenderer;
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let clock = new THREE.Clock();

// VRM / Model State
let currentVrm: VRM | null = null;
let fallbackGroup: THREE.Group | null = null;
let currentConfig: AvatarConfig | null = null;
let isAnimationPaused = false;
let currentScale = 1.0;

function initScene() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  // Scene
  scene = new THREE.Scene();

  // Camera
  camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 20.0);
  camera.position.set(0.0, 1.25, 1.6);
  camera.lookAt(0.0, 1.15, 0.0);

  // Renderer with transparent canvas
  renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
    premultipliedAlpha: false,
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
  dirLight.position.set(1.0, 2.0, 1.5).normalize();
  scene.add(dirLight);

  const fillLight = new THREE.DirectionalLight(0x90b0ff, 0.5);
  fillLight.position.set(-1.0, 1.0, -1.0).normalize();
  scene.add(fillLight);

  // Resize handler
  window.addEventListener("resize", handleResize);

  // Setup Procedural Fallback Mannequin (immediate visual feedback)
  setupFallbackMannequin();

  // Start Animation Loop
  animate();
}

function handleResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function setupFallbackMannequin() {
  if (fallbackGroup) return;

  fallbackGroup = new THREE.Group();

  // Stylized holographic mannequin materials
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x1f2937,
    roughness: 0.3,
    metalness: 0.7,
  });
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    emissive: 0x06b6d4,
    emissiveIntensity: 0.6,
    roughness: 0.2,
  });

  // Head
  const headGeo = new THREE.SphereGeometry(0.12, 32, 32);
  const head = new THREE.Mesh(headGeo, bodyMaterial);
  head.position.y = 1.35;
  fallbackGroup.add(head);

  // Holographic eye visor
  const visorGeo = new THREE.CylinderGeometry(
    0.125,
    0.125,
    0.03,
    32,
    1,
    false,
    0,
    Math.PI,
  );
  const visor = new THREE.Mesh(visorGeo, accentMaterial);
  visor.rotation.y = Math.PI / 2;
  visor.position.set(0, 1.35, 0.01);
  fallbackGroup.add(visor);

  // Neck
  const neckGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.08, 16);
  const neck = new THREE.Mesh(neckGeo, bodyMaterial);
  neck.position.y = 1.22;
  fallbackGroup.add(neck);

  // Torso
  const torsoGeo = new THREE.CylinderGeometry(0.11, 0.09, 0.32, 16);
  const torso = new THREE.Mesh(torsoGeo, bodyMaterial);
  torso.position.y = 1.02;
  fallbackGroup.add(torso);

  // Shoulder ring
  const ringGeo = new THREE.TorusGeometry(0.16, 0.012, 16, 32);
  const ring = new THREE.Mesh(ringGeo, accentMaterial);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 1.15;
  fallbackGroup.add(ring);

  // Floating base pedestal
  const baseGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.02, 32);
  const base = new THREE.Mesh(baseGeo, accentMaterial);
  base.position.y = 0.55;
  fallbackGroup.add(base);

  scene.add(fallbackGroup);
}

function showLoading(msg = "Loading VRM Avatar...") {
  loadingText.textContent = msg;
  loadingOverlay.classList.remove("hidden");
  errorOverlay.classList.add("hidden");
}

function hideLoading() {
  loadingOverlay.classList.add("hidden");
}

function showError(msg: string) {
  hideLoading();
  errorMessage.textContent = msg;
  errorOverlay.classList.remove("hidden");
}

function hideError() {
  errorOverlay.classList.add("hidden");
}

function disposeHierarchy(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material.dispose();
        }
      }
    }
  });
}

async function loadVrmModel(filePath?: string) {
  showLoading();
  hideError();

  try {
    const desktopAPI = window.desktopAPI;
    if (!desktopAPI?.stage?.loadVrmBuffer) {
      throw new Error("Desktop IPC bridge unavailable");
    }

    const { data } = await desktopAPI.stage.loadVrmBuffer(filePath);

    // Loader setup
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    loader.parse(
      data,
      "",
      (gltf) => {
        // Dispose existing VRM if loaded
        if (currentVrm) {
          scene.remove(currentVrm.scene);
          disposeHierarchy(currentVrm.scene);
          currentVrm = null;
        }

        // Hide fallback mannequin when real VRM is present
        if (fallbackGroup) {
          fallbackGroup.visible = false;
        }

        const vrm = gltf.userData.vrm as VRM;
        if (!vrm) {
          showError("Invalid VRM: No VRM data found in glTF file");
          return;
        }

        currentVrm = vrm;
        scene.add(vrm.scene);

        // Standard VRM orientation & scaling
        vrm.scene.rotation.y = Math.PI;
        applyScale(currentScale);

        hideLoading();
      },
      (err) => {
        showError(`Failed to parse VRM: ${err.message}`);
      },
    );
  } catch (err: any) {
    showError(err.message || "Failed to load VRM model");
  }
}

function applyScale(scaleValue: number) {
  currentScale = scaleValue;
  if (currentVrm) {
    currentVrm.scene.scale.set(scaleValue, scaleValue, scaleValue);
  }
  if (fallbackGroup) {
    fallbackGroup.scale.set(scaleValue, scaleValue, scaleValue);
  }
}

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  if (!isAnimationPaused) {
    if (currentVrm) {
      currentVrm.update(delta);

      // Natural subtle idle breathing motion
      const spine = currentVrm.humanoid?.getNormalizedBoneNode("spine");
      if (spine) {
        spine.rotation.x = Math.sin(elapsed * 1.8) * 0.02;
      }

      // Subtle head sway
      const head = currentVrm.humanoid?.getNormalizedBoneNode("head");
      if (head) {
        head.rotation.y = Math.sin(elapsed * 0.7) * 0.035;
        head.rotation.z = Math.sin(elapsed * 0.9) * 0.012;
      }

      // Natural periodic blinking
      const blinkCycle = elapsed % 4.0;
      if (blinkCycle < 0.18) {
        const blinkVal = Math.sin((blinkCycle / 0.18) * Math.PI);
        currentVrm.expressionManager?.setValue("blink", blinkVal);
      } else {
        currentVrm.expressionManager?.setValue("blink", 0.0);
      }
    } else if (fallbackGroup && fallbackGroup.visible) {
      // Procedural floating for fallback mannequin
      fallbackGroup.position.y = Math.sin(elapsed * 1.6) * 0.025;
      fallbackGroup.rotation.y = Math.sin(elapsed * 0.6) * 0.08;
    }
  }

  renderer.render(scene, camera);
}

// Setup floating toolbar interactions
function setupToolbarListeners() {
  const desktopAPI = window.desktopAPI;
  if (!desktopAPI) return;

  btnScaleDown.addEventListener("click", () => {
    const next = Math.max(0.5, currentScale - 0.1);
    applyScale(next);
    desktopAPI.stage?.updateConfig({ scale: next });
  });

  btnScaleUp.addEventListener("click", () => {
    const next = Math.min(2.0, currentScale + 0.1);
    applyScale(next);
    desktopAPI.stage?.updateConfig({ scale: next });
  });

  btnAlwaysOnTop.addEventListener("click", async () => {
    const next = !btnAlwaysOnTop.classList.contains("active");
    await desktopAPI.stage?.setAlwaysOnTop(next);
    btnAlwaysOnTop.classList.toggle("active", next);
  });

  btnClickThrough.addEventListener("click", async () => {
    await desktopAPI.stage?.setClickThrough(true);
    btnClickThrough.classList.add("active");
  });

  btnPauseAnimation.addEventListener("click", async () => {
    isAnimationPaused = !isAnimationPaused;
    btnPauseAnimation.classList.toggle("active", isAnimationPaused);
    await desktopAPI.stage?.setAnimationPaused(isAnimationPaused);
  });

  btnOpenWorkspace.addEventListener("click", () => {
    desktopAPI.workspace?.show("chat");
  });

  btnOpenSettings.addEventListener("click", () => {
    desktopAPI.workspace?.show("avatar");
  });

  errorSettingsBtn.addEventListener("click", () => {
    desktopAPI.workspace?.show("avatar");
  });

  btnHideStage.addEventListener("click", () => {
    desktopAPI.stage?.hide();
  });
}

// Stage Synchronization
async function setupStageSync() {
  const desktopAPI = window.desktopAPI;
  if (!desktopAPI?.stage) return;

  try {
    currentConfig = await desktopAPI.stage.getConfig();
    if (currentConfig.scale) {
      applyScale(currentConfig.scale);
    }
    if (currentConfig.avatarPath) {
      await loadVrmModel(currentConfig.avatarPath);
    }

    const status: StageStatus = await desktopAPI.stage.getStatus();
    isAnimationPaused = status.animationPaused;
    btnPauseAnimation.classList.toggle("active", isAnimationPaused);
    btnAlwaysOnTop.classList.toggle("active", status.alwaysOnTop);
    btnClickThrough.classList.toggle("active", status.clickThrough);

    // Subscribe to broadcast events
    desktopAPI.stage.onConfigChanged?.((cfg) => {
      if (cfg.scale !== undefined && cfg.scale !== currentScale) {
        applyScale(cfg.scale);
      }
      if (cfg.avatarPath && cfg.avatarPath !== currentConfig?.avatarPath) {
        currentConfig = cfg;
        loadVrmModel(cfg.avatarPath);
      }
    });

    desktopAPI.stage.onStatusChanged?.((st) => {
      isAnimationPaused = st.animationPaused;
      btnPauseAnimation.classList.toggle("active", isAnimationPaused);
      btnAlwaysOnTop.classList.toggle("active", st.alwaysOnTop);
      btnClickThrough.classList.toggle("active", st.clickThrough);
    });
  } catch (err: any) {
    showError(err.message || "Failed to synchronize Stage state");
  }
}

// Boot Stage
initScene();
setupToolbarListeners();
setupStageSync();
