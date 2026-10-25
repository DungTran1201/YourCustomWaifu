import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, type VRM } from "@pixiv/three-vrm";

describe("VRM 3D Avatar Loading and Scene Attachment", () => {
  it("registers VRMLoaderPlugin and successfully parses VRM structure", async () => {
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
            title: "Aiko Companion VRM",
            version: "1.0.0",
            author: "YourCustomWaifu Studio",
          },
          humanoid: {
            humanBones: boneNames.map((bone, index) => ({
              bone,
              node: index,
            })),
          },
          blendShapeMaster: {
            blendShapeGroups: [],
          },
          firstPerson: {
            firstPersonBone: 2,
            lookAtTypeName: "BlendShape",
          },
          lookAt: {
            curve: [0, 0, 0, 1, 1, 1, 1, 0],
          },
        },
      },
    };

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    const scene = new THREE.Scene();
    const jsonStr = JSON.stringify(minimalVrmJson);

    const parsedVrm = await new Promise<VRM>((resolve, reject) => {
      loader.parse(
        jsonStr,
        "",
        (gltf) => {
          const vrm = gltf.userData["vrm"] as VRM;
          if (vrm) {
            resolve(vrm);
          } else {
            reject(new Error("VRM data not found in userData"));
          }
        },
        (error) => {
          reject(error);
        },
      );
    });

    expect(parsedVrm).toBeDefined();
    expect(parsedVrm.scene).toBeDefined();
    const meta = parsedVrm.meta as Record<string, any> | null;
    expect(meta?.title || meta?.name).toBe("Aiko Companion VRM");

    // Verify scene attachment
    scene.add(parsedVrm.scene);
    expect(scene.children.includes(parsedVrm.scene)).toBe(true);

    // Verify lookAt capability presence
    expect(parsedVrm.lookAt).toBeDefined();

    // Verify humanoid bones
    const headNode = parsedVrm.humanoid?.getNormalizedBoneNode("head");
    expect(headNode).toBeDefined();

    // Verify orientation & scale adjustment
    parsedVrm.scene.rotation.y = Math.PI;
    parsedVrm.scene.scale.set(1.2, 1.2, 1.2);
    expect(parsedVrm.scene.rotation.y).toBe(Math.PI);
    expect(parsedVrm.scene.scale.x).toBe(1.2);
  });

  it("gracefully catches and rejects corrupted or invalid glTF data", async () => {
    const invalidData = "{ invalid: json... }";
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    await expect(
      new Promise((resolve, reject) => {
        loader.parse(
          invalidData,
          "",
          (gltf) => resolve(gltf),
          (err) => reject(err),
        );
      }),
    ).rejects.toThrow();
  });
});
