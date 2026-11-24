export {
  VRMBlinkController,
  BlinkState,
  type BlinkMode,
  type BlinkDiagnostic,
  type BlinkControllerOptions,
} from "../avatar-stage/blink-controller.js";
export {
  VRMPoseController,
  type APoseOptions,
} from "../avatar-stage/pose-controller.js";
export {
  detectVrmVersion,
  applyOrientation,
  prepareVrmForStage,
  type DetectedVrmVersion,
  type PrepareVrmParams,
  type PrepareVrmResult,
} from "../avatar-stage/stage-pipeline.js";
export {
  isWebGLAvailable,
  prefersReducedMotion,
  optimizeVrmScene,
  disposeObject3D,
} from "./webgl-utils.js";
export {
  parseVrmFromBuffer,
  loadBundledDefaultVrmBuffer,
  type ParsedVrmAsset,
} from "./vrm-loader.js";
export {
  VRMCompanionAnimationController,
  type CompanionMotionState,
  type AnimationClipSource,
  type CompanionAnimationOptions,
  type CompanionAnimationDiagnostic,
} from "./vrm-animation-controller.js";
