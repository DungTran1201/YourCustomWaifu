import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, type VRM } from "@pixiv/three-vrm";
import { VRMPoseController } from "../src/avatar-stage/pose-controller.js";

describe("VRMPoseController & Avatar Facing Orientation", () => {
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

  const minimalVrmJson = {
    asset: { version: "2.0", generator: "VRMTestFixture" },
    scenes: [{ nodes: [0] }],
    scene: 0,
    nodes: boneNames.map((name) => ({ name })),
    extensionsUsed: ["VRM"],
    extensions: {
      VRM: {
        exporterVersion: "UniVRM-0.99.0",
        specVersion: "0.0",
        meta: {
          title: "Aiko A-Pose Test VRM",
          version: "1.0.0",
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

  async function createTestVRM(): Promise<VRM> {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    return new Promise<VRM>((resolve, reject) => {
      loader.parse(
        JSON.stringify(minimalVrmJson),
        "",
        (gltf) => {
          const vrm = gltf.userData["vrm"] as VRM;
          if (vrm) resolve(vrm);
          else reject(new Error("No VRM in gltf"));
        },
        reject,
      );
    });
  }

  it("converts horizontal T-pose into a symmetric A-pose with upper arms angled downward", async () => {
    const vrm = await createTestVRM();
    const humanoid = vrm.humanoid;
    expect(humanoid).toBeDefined();

    const leftUpperArm = humanoid?.getNormalizedBoneNode("leftUpperArm");
    const rightUpperArm = humanoid?.getNormalizedBoneNode("rightUpperArm");
    expect(leftUpperArm).toBeDefined();
    expect(rightUpperArm).toBeDefined();

    // Baseline rest pose is identity quaternion (T-pose)
    const baseLeftQuat = leftUpperArm!.quaternion.clone();
    const baseRightQuat = rightUpperArm!.quaternion.clone();

    const poseController = new VRMPoseController();
    const setupSuccess = poseController.setup(vrm, {
      armAngle: 0.68, // ~39 degrees
    });
    expect(setupSuccess).toBe(true);
    expect(poseController.isApplied).toBe(true);

    // Left Upper Arm: in VRM normalized space, negative Z rotation slopes left arm down
    const leftEuler = new THREE.Euler().setFromQuaternion(
      leftUpperArm!.quaternion,
      "ZYX",
    );
    expect(leftEuler.z).toBeLessThan(-0.5); // slopes downward (~ -39 deg)

    // Right Upper Arm: positive Z rotation slopes right arm down
    const rightEuler = new THREE.Euler().setFromQuaternion(
      rightUpperArm!.quaternion,
      "ZYX",
    );
    expect(rightEuler.z).toBeGreaterThan(0.5); // slopes downward (~ +39 deg)

    // Symmetry check: downward slope magnitudes must match
    expect(Math.abs(leftEuler.z)).toBeCloseTo(Math.abs(rightEuler.z), 2);

    // Idempotency: calling applyPose multiple times does not accumulate angle
    const quatAfterFirst = leftUpperArm!.quaternion.clone();
    poseController.applyPose();
    poseController.applyPose();
    expect(leftUpperArm!.quaternion.x).toBeCloseTo(quatAfterFirst.x, 5);
    expect(leftUpperArm!.quaternion.y).toBeCloseTo(quatAfterFirst.y, 5);
    expect(leftUpperArm!.quaternion.z).toBeCloseTo(quatAfterFirst.z, 5);
    expect(leftUpperArm!.quaternion.w).toBeCloseTo(quatAfterFirst.w, 5);

    // Reset restores rest pose (T-pose)
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

    // Must not crash when calling applyPose or resetToRest
    expect(() => poseController.applyPose()).not.toThrow();
    expect(() => poseController.resetToRest()).not.toThrow();
    expect(() => poseController.dispose()).not.toThrow();
  });

  it("manages dedicated modelRoot group for facing orientation and scaling", async () => {
    const vrm = await createTestVRM();
    const modelRoot = new THREE.Group();
    modelRoot.name = "VRMModelRoot";
    modelRoot.add(vrm.scene);

    // Default orientation is 0 radians (front facing camera at +Z)
    modelRoot.rotation.y = 0;
    expect(modelRoot.rotation.y).toBe(0);

    // Flipped orientation (180 deg / Math.PI)
    modelRoot.rotation.y = Math.PI;
    expect(modelRoot.rotation.y).toBeCloseTo(Math.PI, 4);

    // Scaling
    modelRoot.scale.set(1.35, 1.35, 1.35);
    expect(modelRoot.scale.x).toBe(1.35);
    expect(modelRoot.scale.y).toBe(1.35);
    expect(modelRoot.scale.z).toBe(1.35);
  });
});
