import { describe, it, expect, vi } from "vitest";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, type VRM } from "@pixiv/three-vrm";
import { VRMPoseController } from "../src/avatar-stage/pose-controller.js";
import { VRMBlinkController } from "../src/avatar-stage/blink-controller.js";
import {
  detectVrmVersion,
  applyOrientation,
  prepareVrmForStage,
} from "../src/avatar-stage/stage-pipeline.js";

describe("VRMPoseController, Orientation & Universal Pipeline", () => {
  const boneNames = [
    "hips",
    "spine",
    "head",
    "leftEye",
    "rightEye",
    "leftUpperLeg",
    "leftLowerLeg",
    "leftFoot",
    "rightUpperLeg",
    "rightLowerLeg",
    "rightFoot",
    "leftUpperArm",
    "leftLowerArm",
    "leftHand",
    "rightUpperArm",
    "rightLowerArm",
    "rightHand",
  ];

  function createVrm0Json(title = "VRM 0.x Avatar") {
    return {
      asset: { version: "2.0", generator: "VRM0TestFixture" },
      scenes: [{ nodes: [0] }],
      scene: 0,
      nodes: boneNames.map((name) => ({ name })),
      extensionsUsed: ["VRM"],
      extensions: {
        VRM: {
          exporterVersion: "UniVRM-0.99.0",
          specVersion: "0.0",
          meta: {
            title,
            version: "0.51",
            author: "Operation Dev",
          },
          humanoid: {
            humanBones: boneNames.map((bone, index) => ({
              bone,
              node: index,
            })),
          },
        },
      },
    };
  }

  function createVrm1Json(title = "VRM 1.0 Avatar") {
    return {
      asset: { version: "2.0", generator: "VRM1TestFixture" },
      scenes: [{ nodes: [0] }],
      scene: 0,
      nodes: boneNames.map((name) => ({ name })),
      extensionsUsed: ["VRMC_vrm"],
      extensions: {
        VRMC_vrm: {
          specVersion: "1.0",
          meta: {
            name: title,
            version: "1.0",
            authors: ["Operation Dev"],
            licenseUrl: "https://vrm.dev/licenses/1.0/",
            avatarPermission: "everyone",
            allowExcessivelyViolentUsage: true,
            allowExcessivelySexualUsage: true,
            commercialUsage: "personalNonProfit",
            modification: "allowModification",
          },
          humanoid: {
            humanBones: {
              hips: { node: 0 },
              spine: { node: 1 },
              head: { node: 2 },
              leftEye: { node: 3 },
              rightEye: { node: 4 },
              leftUpperLeg: { node: 5 },
              leftLowerLeg: { node: 6 },
              leftFoot: { node: 7 },
              rightUpperLeg: { node: 8 },
              rightLowerLeg: { node: 9 },
              rightFoot: { node: 10 },
              leftUpperArm: { node: 11 },
              leftLowerArm: { node: 12 },
              leftHand: { node: 13 },
              rightUpperArm: { node: 14 },
              rightLowerArm: { node: 15 },
              rightHand: { node: 16 },
            },
          },
        },
      },
    };
  }

  async function parseVrmFromJson(jsonObj: any): Promise<VRM> {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    return new Promise<VRM>((resolve, reject) => {
      loader.parse(
        JSON.stringify(jsonObj),
        "",
        (gltf) => {
          const vrm = gltf.userData["vrm"] as VRM;
          if (vrm) resolve(vrm);
          else reject(new Error("No VRM found in glTF userData"));
        },
        reject,
      );
    });
  }

  it("converts horizontal T-pose into a symmetric A-pose with upper arms angled downward", async () => {
    const vrm = await parseVrmFromJson(createVrm0Json());
    const humanoid = vrm.humanoid;
    expect(humanoid).toBeDefined();

    const leftUpperArm = humanoid?.getNormalizedBoneNode("leftUpperArm");
    const rightUpperArm = humanoid?.getNormalizedBoneNode("rightUpperArm");
    expect(leftUpperArm).toBeDefined();
    expect(rightUpperArm).toBeDefined();

    const baseLeftQuat = leftUpperArm!.quaternion.clone();
    const baseRightQuat = rightUpperArm!.quaternion.clone();

    const poseController = new VRMPoseController();
    const setupSuccess = poseController.setup(vrm, {
      armAngle: 0.68,
    });
    expect(setupSuccess).toBe(true);
    expect(poseController.isApplied).toBe(true);

    // Left Upper Arm: in VRM normalized space, negative Z rotation slopes left arm down
    const leftEuler = new THREE.Euler().setFromQuaternion(
      leftUpperArm!.quaternion,
      "ZYX",
    );
    expect(leftEuler.z).toBeLessThan(-0.5);

    // Right Upper Arm: positive Z rotation slopes right arm down
    const rightEuler = new THREE.Euler().setFromQuaternion(
      rightUpperArm!.quaternion,
      "ZYX",
    );
    expect(rightEuler.z).toBeGreaterThan(0.5);

    // Symmetry check
    expect(Math.abs(leftEuler.z)).toBeCloseTo(Math.abs(rightEuler.z), 2);

    // Idempotency: multiple applyPose calls do not accumulate angle
    const quatAfterFirst = leftUpperArm!.quaternion.clone();
    poseController.applyPose();
    poseController.applyPose();
    expect(leftUpperArm!.quaternion.x).toBeCloseTo(quatAfterFirst.x, 5);
    expect(leftUpperArm!.quaternion.y).toBeCloseTo(quatAfterFirst.y, 5);
    expect(leftUpperArm!.quaternion.z).toBeCloseTo(quatAfterFirst.z, 5);

    // Reset restores rest pose
    poseController.resetToRest();
    expect(leftUpperArm!.quaternion.z).toBeCloseTo(baseLeftQuat.z, 4);
    expect(rightUpperArm!.quaternion.z).toBeCloseTo(baseRightQuat.z, 4);
  });

  it("handles VRMs without arm bones gracefully without throwing", () => {
    const emptyVrm = {
      scene: new THREE.Group(),
    } as unknown as VRM;

    const poseController = new VRMPoseController();
    const success = poseController.setup(emptyVrm);
    expect(success).toBe(false);
    expect(poseController.isApplied).toBe(false);

    expect(() => poseController.applyPose()).not.toThrow();
    expect(() => poseController.resetToRest()).not.toThrow();
    expect(() => poseController.dispose()).not.toThrow();
  });

  describe("Version-Aware Orientation Detection and Handling", () => {
    it("accurately detects VRM 0.x and applies 180° rotation around Y under auto mode", async () => {
      const vrm0 = await parseVrmFromJson(createVrm0Json());
      expect(detectVrmVersion(vrm0)).toBe("0.0");

      const modelRoot = new THREE.Group();
      const res = applyOrientation(vrm0, modelRoot, "auto");

      expect(res.detectedVersion).toBe("0.0");
      expect(res.effectiveMode).toBe("auto");
      // In VRM 0.x, rest pose faces -Z; vrm.scene must be rotated 180° so it faces +Z (camera)
      expect(vrm0.scene.rotation.y).toBeCloseTo(Math.PI, 4);
      expect(modelRoot.rotation.y).toBe(0);
    });

    it("accurately detects VRM 1.0 and preserves 0° rotation under auto mode", async () => {
      const vrm1 = await parseVrmFromJson(createVrm1Json());
      expect(detectVrmVersion(vrm1)).toBe("1.0");

      const modelRoot = new THREE.Group();
      const res = applyOrientation(vrm1, modelRoot, "auto");

      expect(res.detectedVersion).toBe("1.0");
      expect(res.effectiveMode).toBe("auto");
      // In VRM 1.0, rest pose already faces +Z (camera); rotation.y remains 0
      expect(vrm1.scene.rotation.y).toBe(0);
      expect(modelRoot.rotation.y).toBe(0);
    });

    it("respects per-avatar orientation overrides (0deg and 180deg)", async () => {
      const vrm0 = await parseVrmFromJson(createVrm0Json());
      const modelRoot = new THREE.Group();

      // Explicit 0deg override on VRM 0.x
      const res0 = applyOrientation(vrm0, modelRoot, "0deg");
      expect(res0.effectiveMode).toBe("0deg");
      expect(vrm0.scene.rotation.y).toBe(0);
      expect(modelRoot.rotation.y).toBe(0);

      // Explicit 180deg override on VRM 0.x
      const res180 = applyOrientation(vrm0, modelRoot, "180deg");
      expect(res180.effectiveMode).toBe("180deg");
      expect(vrm0.scene.rotation.y).toBe(0);
      expect(modelRoot.rotation.y).toBeCloseTo(Math.PI, 4);
    });

    it("does not accumulate or double-rotate when orientation is reapplied repeatedly", async () => {
      const vrm0 = await parseVrmFromJson(createVrm0Json());
      const modelRoot = new THREE.Group();

      applyOrientation(vrm0, modelRoot, "auto");
      applyOrientation(vrm0, modelRoot, "auto");
      applyOrientation(vrm0, modelRoot, "auto");

      expect(vrm0.scene.rotation.y).toBeCloseTo(Math.PI, 4);
      expect(modelRoot.rotation.y).toBe(0);
    });
  });

  describe("Shared prepareVrmForStage Pipeline", () => {
    it("executes all 7 stages: validation, orientation, A-pose, scale, bindings, scene attachment", async () => {
      const vrm0 = await parseVrmFromJson(createVrm0Json("Initial Avatar"));
      const modelRoot = new THREE.Group();
      const poseController = new VRMPoseController();
      const blinkController = new VRMBlinkController();
      const lookAtTarget = new THREE.Object3D();

      const result = prepareVrmForStage({
        newVrm: vrm0,
        currentVrm: null,
        modelRoot,
        poseController,
        blinkController,
        config: {
          scale: 1.25,
          orientationMode: "auto",
        } as any,
        lookAtTarget,
      });

      expect(result.vrm).toBe(vrm0);
      expect(result.detectedVersion).toBe("0.0");
      expect(result.aPoseApplied).toBe(true);
      expect(poseController.isApplied).toBe(true);

      // Model attached to modelRoot
      expect(modelRoot.children.includes(vrm0.scene)).toBe(true);
      // Scale applied
      expect(modelRoot.scale.x).toBe(1.25);
      // VRM 0.0 rotated Math.PI
      expect(vrm0.scene.rotation.y).toBeCloseTo(Math.PI, 4);
    });

    it("safely disposes previous avatar ONLY after replacement avatar succeeds", async () => {
      const modelRoot = new THREE.Group();
      const poseController = new VRMPoseController();
      const blinkController = new VRMBlinkController();

      const vrmA = await parseVrmFromJson(createVrm0Json("Model A"));
      prepareVrmForStage({
        newVrm: vrmA,
        currentVrm: null,
        modelRoot,
        poseController,
        blinkController,
      });

      expect(modelRoot.children.includes(vrmA.scene)).toBe(true);

      const disposeSpy = vi.fn();
      const vrmB = await parseVrmFromJson(createVrm1Json("Model B"));

      const resultB = prepareVrmForStage({
        newVrm: vrmB,
        currentVrm: vrmA,
        modelRoot,
        poseController,
        blinkController,
        onDisposePrevious: disposeSpy,
      });

      expect(resultB.detectedVersion).toBe("1.0");
      // Model B is attached
      expect(modelRoot.children.includes(vrmB.scene)).toBe(true);
      // Model A is removed
      expect(modelRoot.children.includes(vrmA.scene)).toBe(false);
      // Disposal hook called
      expect(disposeSpy).toHaveBeenCalledWith(vrmA);
    });

    it("fails safely when given invalid VRM without corrupting current avatar", async () => {
      const modelRoot = new THREE.Group();
      const poseController = new VRMPoseController();
      const blinkController = new VRMBlinkController();

      const vrmA = await parseVrmFromJson(createVrm0Json("Model A"));
      prepareVrmForStage({
        newVrm: vrmA,
        currentVrm: null,
        modelRoot,
        poseController,
        blinkController,
      });

      expect(modelRoot.children.includes(vrmA.scene)).toBe(true);

      // Invalid VRM without scene
      const invalidVrm = {} as any;
      expect(() =>
        prepareVrmForStage({
          newVrm: invalidVrm,
          currentVrm: vrmA,
          modelRoot,
          poseController,
          blinkController,
        }),
      ).toThrow("Invalid VRM: missing VRM scene object");

      // Model A must remain intact in modelRoot
      expect(modelRoot.children.includes(vrmA.scene)).toBe(true);
    });
  });
});
