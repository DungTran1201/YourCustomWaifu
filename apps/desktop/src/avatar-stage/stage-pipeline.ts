import * as THREE from "three";
import { VRMUtils, type VRM } from "@pixiv/three-vrm";
import type {
  AvatarConfig,
  AvatarOrientationMode,
} from "@vrm/platform-contracts";
import type { VRMPoseController } from "./pose-controller.js";
import type { VRMBlinkController } from "./blink-controller.js";

export type DetectedVrmVersion = "0.0" | "1.0" | "unknown";

export interface PrepareVrmParams {
  newVrm: VRM;
  currentVrm: VRM | null;
  modelRoot: THREE.Group;
  poseController: VRMPoseController;
  blinkController: VRMBlinkController;
  config?: AvatarConfig | null;
  lookAtTarget?: THREE.Object3D;
  scale?: number;
  onDisposePrevious?: (vrm: VRM) => void;
}

export interface PrepareVrmResult {
  vrm: VRM;
  detectedVersion: DetectedVrmVersion;
  orientationMode: AvatarOrientationMode;
  appliedYaw: number;
  aPoseApplied: boolean;
}

/**
 * Inspects VRM metadata to determine whether the model is VRM 0.x, VRM 1.0, or unknown.
 * Adheres to official @pixiv/three-vrm conventions:
 * - VRM 0.0 spec: metaVersion === "0" (character forward is -Z)
 * - VRM 1.0 spec: metaVersion === "1" (character forward is +Z)
 */
export function detectVrmVersion(vrm: VRM): DetectedVrmVersion {
  if (!vrm) return "unknown";

  const metaVersion = vrm.meta?.metaVersion;
  if (metaVersion === "0") return "0.0";
  if (metaVersion === "1") return "1.0";

  // Check fallback metadata attributes if metaVersion was unpopulated
  const rawMeta = vrm.meta as Record<string, any> | undefined;
  if (rawMeta) {
    if (
      rawMeta.specVersion === "0.0" ||
      (typeof rawMeta.exporterVersion === "string" &&
        rawMeta.exporterVersion.toLowerCase().includes("univrm-0"))
    ) {
      return "0.0";
    }
    if (rawMeta.specVersion === "1.0") {
      return "1.0";
    }
  }

  // Check raw glTF extensions if available on the parsed scene
  const rawGltf = (vrm as any)._rawGltf;
  if (rawGltf?.extensions?.VRMC_vrm) {
    return "1.0";
  }
  if (rawGltf?.extensions?.VRM) {
    return "0.0";
  }

  return "unknown";
}

/**
 * Applies forward-facing orientation correction aware of VRM version conventions.
 *
 * Rules:
 * - "auto": Uses VRMUtils.rotateVRM0(vrm). VRM 0.x characters (which face -Z in rest pose)
 *   are rotated 180 deg (Math.PI) around Y so they face +Z toward the camera.
 *   VRM 1.0 characters already face +Z toward the camera, so rotation.y remains 0.
 *   Applies manual yaw offset to modelRoot if configured.
 * - "0deg": Forces vrm.scene.rotation.y = 0 and modelRoot.rotation.y = 0 (standard front facing).
 * - "180deg": Forces vrm.scene.rotation.y = 0 and modelRoot.rotation.y = Math.PI (flipped).
 *
 * Ensures no double-rotation or conflicting corrections occur.
 */
export function applyOrientation(
  vrm: VRM,
  modelRoot: THREE.Group,
  mode: AvatarOrientationMode = "auto",
  manualYaw = 0,
): {
  effectiveMode: AvatarOrientationMode;
  detectedVersion: DetectedVrmVersion;
  sceneRotationY: number;
  rootRotationY: number;
} {
  const detectedVersion = detectVrmVersion(vrm);

  // Clear any existing rotations to ensure an idempotent, deterministic baseline
  vrm.scene.rotation.y = 0;
  modelRoot.rotation.y = 0;

  if (mode === "0deg") {
    vrm.scene.rotation.y = 0;
    modelRoot.rotation.y = 0;
  } else if (mode === "180deg") {
    vrm.scene.rotation.y = 0;
    modelRoot.rotation.y = Math.PI;
  } else {
    // "auto" (default):
    // If VRM 0.0, VRMUtils.rotateVRM0 sets vrm.scene.rotation.y = Math.PI
    if (detectedVersion === "0.0") {
      vrm.scene.rotation.y = Math.PI;
    } else {
      VRMUtils.rotateVRM0(vrm);
    }
    // Application-level root yaw for user fine-tuning
    modelRoot.rotation.y = manualYaw;
  }

  return {
    effectiveMode: mode,
    detectedVersion,
    sceneRotationY: vrm.scene.rotation.y,
    rootRotationY: modelRoot.rotation.y,
  };
}

/**
 * Shared VRM Preparation Pipeline.
 *
 * Invoked whenever ANY new VRM is loaded, restored, replaced, or retried.
 * Performs the 9 mandatory stages in sequence:
 * 1. Validate parsed VRM and humanoid structure.
 * 2. Detect VRM version (0.0 vs 1.0 vs unknown) and apply version-aware orientation.
 * 3. Apply default natural A-pose to humanoid rig.
 * 4. Initialize model root transform, grounding, and display scale.
 * 5. Bind lookAt gaze target and configure facial blink controllers.
 * 6. Attach prepared avatar scene to active modelRoot.
 * 7. Safely dispose previous avatar resources ONLY after the new model is fully ready.
 */
export function prepareVrmForStage(params: PrepareVrmParams): PrepareVrmResult {
  const {
    newVrm,
    currentVrm,
    modelRoot,
    poseController,
    blinkController,
    config,
    lookAtTarget,
    scale,
    onDisposePrevious,
  } = params;

  // Stage 1: Validate parsed VRM structure
  if (!newVrm || !newVrm.scene) {
    throw new Error("Invalid VRM: missing VRM scene object");
  }

  if (!newVrm.humanoid) {
    console.warn(
      "[StagePipeline] VRM model lacks humanoid rig — A-pose and bone tracking will be skipped",
    );
  }

  // Stage 2: Orientation correction
  const orientationMode = config?.orientationMode || "auto";
  const manualYaw = config?.rotationY ?? 0;
  const { detectedVersion } = applyOrientation(
    newVrm,
    modelRoot,
    orientationMode,
    manualYaw,
  );

  // Stage 3: Apply default A-pose to humanoid rig
  let aPoseApplied = false;
  if (newVrm.humanoid) {
    aPoseApplied = poseController.setup(newVrm);
  }

  // Stage 4: Scale and root transform
  const effectiveScale = scale ?? config?.scale ?? 1.0;
  modelRoot.scale.set(effectiveScale, effectiveScale, effectiveScale);

  // Stage 5: Animation & gaze references
  if (newVrm.lookAt && lookAtTarget) {
    newVrm.lookAt.target = lookAtTarget;
    newVrm.lookAt.autoUpdate = true;
  }

  blinkController.setup(newVrm, {
    autoBlinkEnabled: config?.autoBlinkEnabled !== false,
    customExpressionName: config?.customBlinkExpression,
  });

  // Stage 6: Attach prepared avatar to scene
  modelRoot.add(newVrm.scene);

  // Stage 7: Cleanly dispose previous avatar only after new model is attached
  if (currentVrm && currentVrm !== newVrm) {
    try {
      modelRoot.remove(currentVrm.scene);
      VRMUtils.deepDispose(currentVrm.scene);
      if (onDisposePrevious) {
        onDisposePrevious(currentVrm);
      }
    } catch (err) {
      console.warn("[StagePipeline] Error disposing previous VRM:", err);
    }
  }

  return {
    vrm: newVrm,
    detectedVersion,
    orientationMode,
    appliedYaw: modelRoot.rotation.y,
    aPoseApplied,
  };
}
