import * as THREE from "three";
import type { VRM } from "@pixiv/three-vrm";

export interface APoseOptions {
  /** Upper arm downward angle from horizontal in radians (default ~39 deg = 0.68 rad) */
  armAngle?: number;
  /** Subtle natural inward/forward rotation in radians (default 0.06 rad) */
  inwardAngle?: number;
  /** Gentle elbow bend angle in radians (default ~4.5 deg = 0.08 rad) */
  elbowBend?: number;
}

/**
 * VRMPoseController: Manages procedural default poses for VRM avatars.
 * Converts the default horizontal T-pose into a natural, relaxed, symmetric A-pose.
 *
 * Coordinates adhere to standard VRM normalized humanoid rig:
 * - Normalized bones in rest pose have identity rotation.
 * - +X is character's Left, -X is character's Right.
 * - +Y is Up, +Z is Forward.
 * - Left Upper Arm: rotating around Z by negative angle tilts the arm downward.
 * - Right Upper Arm: rotating around Z by positive angle tilts the arm downward.
 */
export class VRMPoseController {
  private _vrm: VRM | null = null;
  private _baselineRotations = new Map<string, THREE.Quaternion>();
  private _targetRotations = new Map<string, THREE.Quaternion>();
  private _isPoseApplied = false;

  /**
   * Initializes the pose controller for a loaded VRM instance.
   * Reads rest transforms, computes target A-pose quaternions, and applies them.
   */
  public setup(vrm: VRM, options?: APoseOptions): boolean {
    this._vrm = vrm;
    this._baselineRotations.clear();
    this._targetRotations.clear();
    this._isPoseApplied = false;

    const humanoid = vrm.humanoid;
    if (!humanoid) {
      console.warn("[PoseController] VRM model has no humanoid rig");
      return false;
    }

    const armAngle = options?.armAngle ?? 0.74; // ~42.4 degrees downward
    const inwardAngle = options?.inwardAngle ?? 0.08; // slight forward/inward hang
    const elbowBend = options?.elbowBend ?? 0.1; // ~5.7 degrees subtle elbow flexion

    const armBones = [
      "leftUpperArm",
      "rightUpperArm",
      "leftLowerArm",
      "rightLowerArm",
      "leftHand",
      "rightHand",
    ] as const;

    // Cache baseline rest rotations
    for (const boneName of armBones) {
      const node = humanoid.getNormalizedBoneNode(boneName);
      if (node) {
        this._baselineRotations.set(boneName, node.quaternion.clone());
      }
    }

    // 1. Left Upper Arm: Tilt downward (-Z) with subtle forward/inward hang
    const leftUpperArmNode = humanoid.getNormalizedBoneNode("leftUpperArm");
    if (leftUpperArmNode) {
      const base =
        this._baselineRotations.get("leftUpperArm") || new THREE.Quaternion();
      const offset = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0.04, inwardAngle, -armAngle, "ZYX"),
      );
      this._targetRotations.set("leftUpperArm", base.clone().multiply(offset));
    }

    // 2. Right Upper Arm: Tilt downward (+Z) with symmetric subtle forward/inward hang
    const rightUpperArmNode = humanoid.getNormalizedBoneNode("rightUpperArm");
    if (rightUpperArmNode) {
      const base =
        this._baselineRotations.get("rightUpperArm") || new THREE.Quaternion();
      const offset = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0.04, -inwardAngle, armAngle, "ZYX"),
      );
      this._targetRotations.set("rightUpperArm", base.clone().multiply(offset));
    }

    // 3. Gentle natural elbow relaxation
    const leftLowerArmNode = humanoid.getNormalizedBoneNode("leftLowerArm");
    if (leftLowerArmNode) {
      const base =
        this._baselineRotations.get("leftLowerArm") || new THREE.Quaternion();
      const offset = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0, -elbowBend, 0),
      );
      this._targetRotations.set("leftLowerArm", base.clone().multiply(offset));
    }

    const rightLowerArmNode = humanoid.getNormalizedBoneNode("rightLowerArm");
    if (rightLowerArmNode) {
      const base =
        this._baselineRotations.get("rightLowerArm") || new THREE.Quaternion();
      const offset = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0, elbowBend, 0),
      );
      this._targetRotations.set("rightLowerArm", base.clone().multiply(offset));
    }

    // Apply immediately to the normalized rig
    this.applyPose();
    return true;
  }

  /**
   * Applies target A-pose quaternions to the normalized bone nodes.
   * Completely idempotent: sets precomputed quaternions rather than accumulating deltas.
   */
  public applyPose(): void {
    if (!this._vrm?.humanoid) return;

    for (const [boneName, targetQuat] of this._targetRotations.entries()) {
      const node = this._vrm.humanoid.getNormalizedBoneNode(boneName as any);
      if (node) {
        node.quaternion.copy(targetQuat);
      }
    }
    this._isPoseApplied = true;
  }

  /**
   * Restores bones to their rest T-pose.
   */
  public resetToRest(): void {
    if (!this._vrm?.humanoid) return;

    for (const [boneName, baseQuat] of this._baselineRotations.entries()) {
      const node = this._vrm.humanoid.getNormalizedBoneNode(boneName as any);
      if (node) {
        node.quaternion.copy(baseQuat);
      }
    }
    this._isPoseApplied = false;
  }

  public get isApplied(): boolean {
    return this._isPoseApplied;
  }

  public dispose(): void {
    this._vrm = null;
    this._baselineRotations.clear();
    this._targetRotations.clear();
    this._isPoseApplied = false;
  }
}
