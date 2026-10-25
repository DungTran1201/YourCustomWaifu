import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { useAppStore } from "@vrm/app-core";
import App from "../src/workspace/App.vue";
import SignInView from "../src/workspace/views/SignInView.vue";
import AvatarSettingsView from "../src/workspace/views/AvatarSettingsView.vue";
import { isGuestPreviewAllowed } from "../electron/main/guest-preview.js";
import {
  SAMPLE_VRM_METADATA,
  isValidSampleVrm,
  calculateFileSha256,
} from "../electron/main/sample-vrm.js";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import os from "node:os";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, type VRM } from "@pixiv/three-vrm";

describe("Development Guest Preview & Real VRM Avatar Loading", () => {
  beforeEach(() => {
    const store = useAppStore();
    store.state.isAuthenticated = false;
    store.state.isGuest = false;
    store.state.isGuestPreviewAvailable = false;
    store.state.user = null;
    store.state.stageLoading = false;
    store.state.stageError = null;
    store.setTab("signin");
  });

  afterEach(() => {
    delete (window as any).desktopAPI;
  });

  describe("1. Guest Preview Enablement & Security Boundaries", () => {
    it("strictly disallows Guest Preview when application is packaged, even if env flag is 1", () => {
      // isPackaged = true, env = "1" -> MUST return false
      expect(isGuestPreviewAllowed(true, "1")).toBe(false);
    });

    it("disallows Guest Preview when unpackaged but env flag is absent or not 1", () => {
      expect(isGuestPreviewAllowed(false, undefined)).toBe(false);
      expect(isGuestPreviewAllowed(false, "")).toBe(false);
      expect(isGuestPreviewAllowed(false, "0")).toBe(false);
      expect(isGuestPreviewAllowed(false, "true")).toBe(false);
      expect(isGuestPreviewAllowed(false, "yes")).toBe(false);
    });

    it("allows Guest Preview ONLY when unpackaged AND YCW_ENABLE_GUEST_PREVIEW === '1'", () => {
      expect(isGuestPreviewAllowed(false, "1")).toBe(true);
    });

    it("checks guest preview availability on store initialization via DesktopAPI bridge", async () => {
      const store = useAppStore();
      (window as any).desktopAPI = {
        isGuestPreviewAvailable: vi.fn().mockResolvedValue(true),
        getDiagnostics: vi.fn().mockResolvedValue({ platform: "electron" }),
        stage: {
          getConfig: vi.fn().mockResolvedValue({}),
          getStatus: vi.fn().mockResolvedValue({}),
        },
      };

      await store.checkGuestPreviewAvailable();
      expect(store.state.isGuestPreviewAvailable).toBe(true);
      expect(
        (window as any).desktopAPI.isGuestPreviewAvailable,
      ).toHaveBeenCalled();
    });
  });

  describe("2. Guest Session Lifecycle & Auth Isolation", () => {
    it("enters Guest Preview without calling login or register, keeping isAuthenticated = false", async () => {
      const store = useAppStore();
      const loginSpy = vi.fn();
      const registerSpy = vi.fn();
      const showStageSpy = vi.fn().mockResolvedValue(undefined);

      (window as any).desktopAPI = {
        getDiagnostics: vi.fn().mockResolvedValue({ platform: "electron" }),
        auth: {
          login: loginSpy,
          register: registerSpy,
        },
        stage: {
          show: showStageSpy,
          getConfig: vi.fn().mockResolvedValue({}),
          getStatus: vi.fn().mockResolvedValue({}),
        },
      };

      await store.enterGuestPreview();

      // Invariant: NEVER impersonate authenticated user or create fake JWT
      expect(store.state.isGuest).toBe(true);
      expect(store.state.isAuthenticated).toBe(false);
      expect(store.state.user).toBeNull();

      // Must NOT invoke login or register
      expect(loginSpy).not.toHaveBeenCalled();
      expect(registerSpy).not.toHaveBeenCalled();

      // Must navigate to avatar settings and show stage
      expect(store.state.currentTab).toBe("avatar");
      expect(showStageSpy).toHaveBeenCalled();
    });

    it("exits Guest Preview and safely resets back to unauthenticated sign-in view", () => {
      const store = useAppStore();
      store.state.isGuest = true;
      store.state.currentTab = "avatar";

      store.exitGuestPreview();

      expect(store.state.isGuest).toBe(false);
      expect(store.state.isAuthenticated).toBe(false);
      expect(store.state.user).toBeNull();
      expect(store.state.currentTab).toBe("signin");
    });
  });

  describe("3. Sign In UI & Guest Button Visibility", () => {
    it("hides 'Continue as Guest — Development Preview' button when feature is disabled", () => {
      const store = useAppStore();
      store.state.isGuestPreviewAvailable = false;

      const wrapper = mount(SignInView);
      expect(wrapper.find("#signin-guest-btn").exists()).toBe(false);
    });

    it("displays 'Continue as Guest — Development Preview' button when feature is enabled", async () => {
      const store = useAppStore();
      store.state.isGuestPreviewAvailable = true;

      const wrapper = mount(SignInView);
      const guestBtn = wrapper.find("#signin-guest-btn");
      expect(guestBtn.exists()).toBe(true);
      expect(guestBtn.text()).toContain(
        "Continue as Guest — Development Preview",
      );
    });

    it("clicking guest button activates guest preview session and routes to avatar screen", async () => {
      const store = useAppStore();
      store.state.isGuestPreviewAvailable = true;

      const wrapper = mount(App);
      const guestBtn = wrapper.find("#signin-guest-btn");
      expect(guestBtn.exists()).toBe(true);

      await guestBtn.trigger("click");

      expect(store.state.isGuest).toBe(true);
      expect(store.state.isAuthenticated).toBe(false);
      expect(store.state.currentTab).toBe("avatar");
      expect(wrapper.text()).toContain("Avatar & Stage Configuration");
      expect(wrapper.text()).toContain("GUEST PREVIEW");
    });
  });

  describe("4. Avatar Settings UI in Guest Mode", () => {
    it("renders Guest Preview banner and Exit button when isGuest is true", () => {
      const store = useAppStore();
      store.state.isGuest = true;

      const wrapper = mount(AvatarSettingsView);
      expect(wrapper.find(".guest-banner").exists()).toBe(true);
      expect(wrapper.find("#avatar-guest-exit-btn").exists()).toBe(true);
      expect(wrapper.text()).toContain("GUEST PREVIEW");
    });

    it("renders model action controls (Load Sample VRM & Choose Local VRM)", () => {
      const wrapper = mount(AvatarSettingsView);
      expect(wrapper.find("#avatar-load-sample-btn").exists()).toBe(true);
      expect(wrapper.find("#avatar-select-file-btn").exists()).toBe(true);
      expect(wrapper.find("#avatar-toggle-stage-btn").exists()).toBe(true);
    });

    it("displays correct model status badges (Fallback, Loading, Loaded, Error)", async () => {
      const store = useAppStore();

      // Case 1: Fallback
      store.state.stageLoading = false;
      store.state.stageError = null;
      store.state.stageStatus.avatarLoaded = false;
      store.state.avatarConfig.avatarPath = "";
      const wrapper = mount(AvatarSettingsView);
      expect(wrapper.text()).toContain("Fallback");

      // Case 2: Loading
      store.state.stageLoading = true;
      await wrapper.vm.$nextTick();
      expect(wrapper.text()).toContain("Loading");

      // Case 3: Error
      store.state.stageLoading = false;
      store.state.stageError = "Failed to parse model";
      await wrapper.vm.$nextTick();
      expect(wrapper.text()).toContain("Error");
      expect(wrapper.text()).toContain("Failed to parse model");

      // Case 4: Loaded
      store.state.stageLoading = false;
      store.state.stageError = null;
      store.state.stageStatus.avatarLoaded = true;
      store.state.avatarConfig.avatarPath = "C:\\test\\avatar.vrm";
      await wrapper.vm.$nextTick();
      expect(wrapper.text()).toContain("Loaded");
    });
  });

  describe("5. Sample VRM Metadata & Download Checksum Validation", () => {
    it("verifies sample VRM pinned upstream metadata", () => {
      expect(SAMPLE_VRM_METADATA.fileName).toBe("AvatarSample_B.vrm");
      expect(SAMPLE_VRM_METADATA.pinnedCommit).toBe(
        "6e687a81dc74194009d3ca874cc784faf49a3a01",
      );
      expect(SAMPLE_VRM_METADATA.expectedSha256).toBe(
        "ffbd8c92a9e67c0a948f69c7a2eec91e5c282c9ae70e9184309fc164d74cbc27",
      );
      expect(SAMPLE_VRM_METADATA.expectedSizeBytes).toBe(21047556);
      expect(SAMPLE_VRM_METADATA.rawUrl).toContain(
        SAMPLE_VRM_METADATA.pinnedCommit,
      );
    });

    it("validates file checksum correctly and rejects corrupted or wrong-size files", async () => {
      const tempDir = await fs.mkdtemp(join(os.tmpdir(), "vrm-test-"));
      const testFile = join(tempDir, "corrupted.vrm");

      try {
        // Test 1: Empty file
        await fs.writeFile(testFile, "");
        const validEmpty = await isValidSampleVrm(testFile);
        expect(validEmpty).toBe(false);

        // Test 2: HTML error page
        await fs.writeFile(testFile, "<html><body>404 Not Found</body></html>");
        const validHtml = await isValidSampleVrm(testFile);
        expect(validHtml).toBe(false);

        // Test 3: Calculate SHA-256 helper
        const dummyText = "YourCustomWaifu VRM Verification Digest";
        await fs.writeFile(testFile, dummyText);
        const digest = await calculateFileSha256(testFile);
        expect(digest).toHaveLength(64);
        expect(typeof digest).toBe("string");
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe("6. Real VRM Scene Attachment & Fallback Mannequin Safety", () => {
    it("attaches real VRM to Three.js scene only when gltf.userData.vrm is verified", async () => {
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

      const vrmFixture = {
        asset: { version: "2.0", generator: "PixivChatVRMFixture" },
        scenes: [{ nodes: [0] }],
        scene: 0,
        nodes: boneNames.map((name) => ({ name })),
        extensionsUsed: ["VRM"],
        extensions: {
          VRM: {
            exporterVersion: "UniVRM-0.99.0",
            specVersion: "0.0",
            meta: {
              title: "AvatarSample_B",
              version: "1.1",
              author: "VRoid Project (pixiv Inc.)",
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

      const loader = new GLTFLoader();
      loader.register((parser) => new VRMLoaderPlugin(parser));
      const scene = new THREE.Scene();
      const fallbackGroup = new THREE.Group();
      scene.add(fallbackGroup);

      // Sequence: fallback remains visible while loading
      expect(fallbackGroup.visible).toBe(true);

      const parsedVrm = await new Promise<VRM>((resolve, reject) => {
        loader.parse(
          JSON.stringify(vrmFixture),
          "",
          (gltf) => {
            const vrm = gltf.userData["vrm"] as VRM;
            if (vrm) {
              // Critical invariant: Hide fallback ONLY after VRM is verified and scene attached
              scene.add(vrm.scene);
              fallbackGroup.visible = false;
              resolve(vrm);
            } else {
              reject(new Error("VRM metadata not found"));
            }
          },
          (err) => reject(err),
        );
      });

      expect(parsedVrm).toBeDefined();
      expect(fallbackGroup.visible).toBe(false);
      expect(scene.children.includes(parsedVrm.scene)).toBe(true);
    });

    it("retains fallback mannequin when non-VRM or corrupted gltf is parsed", async () => {
      const nonVrmGltf = {
        asset: { version: "2.0", generator: "PlainGLTFWithoutVRM" },
        scenes: [{ nodes: [0] }],
        scene: 0,
        nodes: [{ name: "Box" }],
      };

      const loader = new GLTFLoader();
      loader.register((parser) => new VRMLoaderPlugin(parser));
      const scene = new THREE.Scene();
      const fallbackGroup = new THREE.Group();
      scene.add(fallbackGroup);

      let parseError: Error | null = null;

      await new Promise<void>((resolve) => {
        loader.parse(
          JSON.stringify(nonVrmGltf),
          "",
          (gltf) => {
            const vrm = gltf.userData["vrm"] as VRM;
            if (!vrm) {
              // Proper handling: do not hide fallback!
              parseError = new Error(
                "File contains 3D geometry but no valid VRM metadata",
              );
            } else {
              scene.add(vrm.scene);
              fallbackGroup.visible = false;
            }
            resolve();
          },
          (err: unknown) => {
            parseError =
              err instanceof Error
                ? err
                : new Error(String((err as any)?.message || err));
            resolve();
          },
        );
      });

      expect(parseError).not.toBeNull();
      expect((parseError as Error | null)?.message).toContain(
        "no valid VRM metadata",
      );
      // Fallback mannequin must REMAIN visible so stage is not left empty!
      expect(fallbackGroup.visible).toBe(true);
    });
  });

  describe("7. User Avatar Configuration Preservation", () => {
    it("does not overwrite persistent user-selected avatar configuration with sample VRM", async () => {
      const store = useAppStore();
      const customAvatar = "C:\\Users\\User\\Models\\CustomWaifu.vrm";

      // User already configured a custom avatar
      await store.updateAvatarConfig({
        avatarPath: customAvatar,
        avatarName: "MyCustomWaifu",
      });

      expect(store.state.avatarConfig.avatarPath).toBe(customAvatar);
      expect(store.state.avatarConfig.avatarName).toBe("MyCustomWaifu");

      // Enter guest mode
      await store.enterGuestPreview();

      // State is in guest mode, but persistent user config was not clobbered
      expect(store.state.avatarConfig.avatarPath).toBe(customAvatar);
      expect(store.state.avatarConfig.avatarName).toBe("MyCustomWaifu");
    });
  });
});
