import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import * as THREE from "three";
import type { VRM } from "@pixiv/three-vrm";
import App from "../src/workspace/App.vue";
import SignInView from "../src/workspace/views/SignInView.vue";
import SignUpView from "../src/workspace/views/SignUpView.vue";
import ResetPasswordView from "../src/workspace/views/ResetPasswordView.vue";
import SecurityView from "../src/workspace/views/SecurityView.vue";
import { useAppStore } from "@vrm/app-core";
import { PASSWORD_POLICY } from "@vrm/shared";
import {
  VRMCompanionAnimationController,
  isWebGLAvailable,
  parseVrmFromBuffer,
} from "../src/vrm/index.js";
import { buildObsidianGlassChamber } from "../src/workspace/auth/obsidian-chamber-builder.js";
import { buildAuthShaderBackdrop } from "../src/workspace/auth/auth-shader-backdrop.js";

function createMockVrm(): {
  vrm: VRM;
  bones: Record<string, THREE.Object3D>;
  expressions: Record<string, number>;
} {
  const scene = new THREE.Group();
  const boneNames = [
    "hips",
    "spine",
    "chest",
    "upperChest",
    "neck",
    "head",
    "leftUpperArm",
    "rightUpperArm",
    "leftLowerArm",
    "rightLowerArm",
    "leftHand",
    "rightHand",
    "leftEye",
    "rightEye",
  ];

  const bones: Record<string, THREE.Object3D> = {};
  for (const name of boneNames) {
    const node = new THREE.Object3D();
    node.name = name;
    scene.add(node);
    bones[name] = node;
  }

  const expressions: Record<string, number> = {
    blink: 0,
    happy: 0,
    relaxed: 0,
    surprised: 0,
    neutral: 0,
  };

  const vrm = {
    scene,
    meta: { metaVersion: "1" },
    humanoid: {
      getNormalizedBoneNode: (name: string) => bones[name] ?? null,
    },
    lookAt: {
      target: null as THREE.Object3D | null,
      autoUpdate: true,
    },
    expressionManager: {
      expressionMap: {
        blink: {},
        happy: {},
        relaxed: {},
        surprised: {},
        neutral: {},
      },
      getExpression: (name: string) =>
        name in expressions ? ({} as any) : null,
      setValue: (name: string, weight: number) => {
        if (name in expressions) {
          expressions[name] = weight;
        }
      },
    },
    update: vi.fn(),
  } as unknown as VRM;

  return { vrm, bones, expressions };
}

describe("3D VRM Authentication Environment, Companion Animation & 8-Char Password Policy", () => {
  beforeEach(() => {
    const store = useAppStore();
    store.state.isAuthenticated = false;
    store.state.isGuest = false;
    store.state.user = null;
    store.state.authError = null;
    store.state.authNotice = null;
    store.setTab("signin");
    delete (window as any).desktopAPI;
  });

  describe("1. VRMCompanionAnimationController — Clips, Procedural Fallback & Transitions", () => {
    it("plays Greeting once on open, then smoothly transitions into Idle with breathing & blinking", () => {
      const { vrm, bones, expressions } = createMockVrm();
      const lookAtTarget = new THREE.Object3D();
      const controller = new VRMCompanionAnimationController();

      controller.setup(vrm, [], lookAtTarget, {
        greetingDuration: 1.2,
        randomFn: () => 0.5,
      });

      expect(controller.getDiagnostic().source).toBe("procedural");
      expect(controller.getDiagnostic().activeState).toBe("idle");

      // Trigger greeting once
      expect(controller.playGreetingOnce()).toBe(true);
      expect(controller.getDiagnostic().activeState).toBe("greeting");
      expect(controller.getDiagnostic().hasPlayedGreeting).toBe(true);

      // Second call must be ignored (one-shot greeting guarantee)
      expect(controller.playGreetingOnce()).toBe(false);

      // Step into mid-greeting: verify wave/bow bone motion & warm expression
      for (let i = 0; i < 6; i++) {
        controller.update(0.1);
      }
      expect(controller.getDiagnostic().weights.greeting).toBeGreaterThan(0.5);
      expect(expressions.happy).toBeGreaterThan(0.1);
      expect(
        bones.rightUpperArm!.quaternion.equals(new THREE.Quaternion()),
      ).toBe(false);

      // Advance past greetingDuration (1.2s) -> automatic transition to idle
      for (let i = 0; i < 12; i++) {
        controller.update(0.1);
      }
      expect(controller.getDiagnostic().activeState).toBe("idle");
      expect(controller.getDiagnostic().weights.idle).toBeGreaterThan(0.7);

      controller.dispose();
    });

    it("prioritizes embedded VRM AnimationClips when present and crossfades cleanly", () => {
      const { vrm } = createMockVrm();
      const greetClip = new THREE.AnimationClip("Greeting_Wave", 1.0, [
        new THREE.NumberKeyframeTrack(".position[y]", [0, 1], [0, 0.02]),
      ]);
      const idleClip = new THREE.AnimationClip("Idle_Breath", 2.0, [
        new THREE.NumberKeyframeTrack(".position[y]", [0, 2], [0, 0.01]),
      ]);
      const thinkClip = new THREE.AnimationClip("Thinking_Pose", 1.5, [
        new THREE.NumberKeyframeTrack(".position[x]", [0, 1.5], [0, 0.01]),
      ]);

      const controller = new VRMCompanionAnimationController();
      controller.setup(vrm, [greetClip, idleClip, thinkClip]);

      const diag = controller.getDiagnostic();
      expect(diag.source).toBe("vrm-clip");
      expect(diag.discoveredClips).toEqual([
        "Greeting_Wave",
        "Idle_Breath",
        "Thinking_Pose",
      ]);

      controller.setThinking(true);
      controller.update(0.05);
      expect(controller.getDiagnostic().activeState).toBe("thinking");
      expect(controller.getDiagnostic().source).toBe("vrm-clip");

      controller.dispose();
    });

    it("suppresses procedural blink, expression, and head tracks when embedded VRM clip animates them", () => {
      const { vrm, expressions } = createMockVrm();
      const conflictClip = new THREE.AnimationClip(
        "Idle_FullMorphAndHead",
        2.0,
        [
          new THREE.NumberKeyframeTrack(
            "head.quaternion",
            [0, 2],
            [0, 0, 0, 1, 0, 0, 0, 1],
          ),
          new THREE.NumberKeyframeTrack(
            "face.morphTargetInfluences[blink]",
            [0, 2],
            [0, 1],
          ),
        ],
      );

      const controller = new VRMCompanionAnimationController();
      controller.setup(vrm, [conflictClip]);
      controller.update(0.05);

      const diag = controller.getDiagnostic();
      expect(diag.source).toBe("vrm-clip");
      expect(diag.clipConflictsSuppressed).toEqual({
        blink: true,
        expressions: true,
        headLookAt: true,
      });
      // Procedural happy expression did not overwrite clip morphs
      expect(expressions.happy).toBe(0);

      controller.dispose();
    });

    it("constructs genuine 3D Obsidian Glass Chamber geometry with semi-transparent smoked glass and shadow floor", () => {
      const chamber = buildObsidianGlassChamber(0.78, -0.34);

      const namedNodes = new Set<string>();
      chamber.root.traverse((obj) => {
        if (obj.name) namedNodes.add(obj.name);
      });

      // Verify all 3D room faces & structural elements exist
      expect(namedNodes.has("ChamberFloorBase")).toBe(true);
      expect(namedNodes.has("ChamberFloorSmokedGlass")).toBe(true);
      expect(namedNodes.has("ChamberCeiling")).toBe(true);
      expect(namedNodes.has("ChamberBackGlassWall")).toBe(true);
      expect(namedNodes.has("ChamberLeftGlassWall")).toBe(true);
      expect(namedNodes.has("ChamberRightGlassWall")).toBe(true);
      expect(namedNodes.has("ChamberBoxEdges")).toBe(true);
      expect(namedNodes.has("LeftSmokedGlassBaffle")).toBe(true);
      expect(namedNodes.has("CompanionSmokedGlassAlcove")).toBe(true);

      const floorBase = chamber.root.getObjectByName(
        "ChamberFloorBase",
      ) as THREE.Mesh;
      expect(floorBase.receiveShadow).toBe(true);

      const leftWall = chamber.root.getObjectByName(
        "ChamberLeftGlassWall",
      ) as THREE.Mesh;
      const wallMat = leftWall.material as THREE.MeshPhysicalMaterial;
      expect(wallMat.transparent).toBe(true);
      expect(wallMat.depthWrite).toBe(false);

      // Dynamic responsive companion positioning updates anchor & alcove
      chamber.setCompanionPosition(0.68, -0.3);
      expect(chamber.companionAnchor.x).toBeCloseTo(0.68, 3);
      chamber.setTheme("light");
      chamber.updateAmbient(1.5, 1.0);
      chamber.setTheme("dark");
      chamber.updateAmbient(2.0, 1.0);

      expect(() => chamber.dispose()).not.toThrow();
    });

    it("creates GLSL shader backdrop supporting smooth Light/Dark glass theme transitions and pointer parallax", () => {
      const backdrop = buildAuthShaderBackdrop("light");
      expect(backdrop.mesh.name).toBe("AuthShaderBackdrop");

      const mat = backdrop.mesh.material as THREE.ShaderMaterial;
      expect(mat.uniforms.uThemeMix!.value).toBe(0);

      backdrop.setTheme("dark");
      backdrop.setPointer(0.5, -0.25);
      backdrop.update(1.2, 0.5, false);
      expect(mat.uniforms.uThemeMix!.value).toBeGreaterThan(0.5);

      backdrop.setTheme("light");
      backdrop.update(2.0, 0.5, true);
      expect(mat.uniforms.uThemeMix!.value).toBe(0);

      expect(() => backdrop.dispose()).not.toThrow();
    });

    it("drives LookAt, Head Movement, Thinking transitions, Pause/Resume, and Reduced Motion", () => {
      const { vrm, bones } = createMockVrm();
      const lookAtTarget = new THREE.Object3D();
      const controller = new VRMCompanionAnimationController();

      controller.setup(vrm, [], lookAtTarget, { reducedMotion: false });
      controller.setPointerTarget(0.6, -0.3);
      controller.setThinking(true);

      for (let i = 0; i < 8; i++) {
        controller.update(0.05);
      }

      expect(controller.getDiagnostic().activeState).toBe("thinking");
      expect(controller.getDiagnostic().weights.thinking).toBeGreaterThan(0.6);
      expect(lookAtTarget.position.x).toBeGreaterThan(-0.1);
      expect(bones.head!.rotation.z).not.toBe(0);

      // Pause freezes updates safely
      controller.pause();
      expect(controller.getDiagnostic().isPaused).toBe(true);
      const callCountBefore = (vrm.update as any).mock.calls.length;
      controller.update(0.1);
      expect((vrm.update as any).mock.calls.length).toBe(callCountBefore);

      controller.resume();
      expect(controller.getDiagnostic().isPaused).toBe(false);

      // Reduced motion disables continuous sway and resets state cleanly
      controller.setReducedMotion(true);
      expect(controller.getDiagnostic().reducedMotion).toBe(true);
      expect(controller.getDiagnostic().activeState).toBe("idle");

      controller.dispose();
    });

    it("parses valid VRM JSON buffer and extracts embedded animation clips via shared loader", async () => {
      const requiredBones = [
        "hips",
        "spine",
        "head",
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
      const minimalVrm = {
        asset: { version: "2.0" },
        scenes: [{ nodes: [0] }],
        scene: 0,
        nodes: requiredBones.map((name) => ({ name })),
        extensionsUsed: ["VRM"],
        extensions: {
          VRM: {
            specVersion: "0.0",
            meta: { title: "AuthCompanionFixture" },
            humanoid: {
              humanBones: requiredBones.map((bone, index) => ({
                bone,
                node: index,
              })),
            },
          },
        },
      };

      const parsed = await parseVrmFromBuffer(JSON.stringify(minimalVrm));
      expect(parsed.vrm).toBeDefined();
      expect(parsed.detectedVersion).toBe("0.0");
      expect(Array.isArray(parsed.animations)).toBe(true);
    });
  });

  describe("2. Floating Auth Environment, Static Fallback & Non-Stage Isolation", () => {
    it("falls back cleanly to Midnight Anime Noir static backdrop when WebGL is unavailable", async () => {
      expect(isWebGLAvailable()).toBe(false);

      const wrapper = mount(App);
      await flushPromises();

      const env = wrapper.find('[data-testid="auth-3d-environment"]');
      expect(env.exists()).toBe(true);
      expect(
        wrapper.find('[data-testid="auth-static-fallback"]').exists(),
      ).toBe(true);

      // Does NOT touch or open the independent Avatar Stage window
      const store = useAppStore();
      expect(store.state.stageStatus.stageVisible).toBe(false);
    });

    it("toggles between Light Glass and Dark Glass themes directly inside Authentication Environment", async () => {
      const store = useAppStore();
      store.updateSettings({ theme: "light" });

      const wrapper = mount(App);
      await flushPromises();

      const themeBtn = wrapper.find("#auth-theme-toggle-btn");
      expect(themeBtn.exists()).toBe(true);
      expect(document.documentElement.getAttribute("data-theme")).toBe("light");
      expect(wrapper.find(".auth-3d-stage").classes()).toContain("theme-light");

      await themeBtn.trigger("click");
      await wrapper.vm.$nextTick();

      expect(store.resolvedTheme.value).toBe("dark");
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
      expect(wrapper.find(".auth-3d-stage").classes()).toContain("theme-dark");

      await themeBtn.trigger("click");
      await wrapper.vm.$nextTick();

      expect(store.resolvedTheme.value).toBe("light");
      expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    });

    it("switches smoothly between Floating Sign In, Register, Forgot Password, and Reset Password", async () => {
      const wrapper = mount(App);
      const store = useAppStore();

      expect(wrapper.find("#signin-email").exists()).toBe(true);

      // Switch to Register via mode tab
      await wrapper.find("#auth-tab-signup").trigger("click");
      await flushPromises();
      expect(store.state.currentTab).toBe("signup");
      expect(wrapper.find("#signup-email").exists()).toBe(true);

      // Switch back to Sign In via mode tab
      await wrapper.find("#auth-tab-signin").trigger("click");
      await flushPromises();
      expect(store.state.currentTab).toBe("signin");

      // Navigate to Forgot Password -> Reset Password
      const forgotBtn = wrapper
        .findAll("button")
        .find((b) => b.text().includes("Forgot password"));
      expect(forgotBtn).toBeDefined();
      await forgotBtn!.trigger("click");
      await flushPromises();
      expect(store.state.currentTab).toBe("forgot-password");

      await wrapper.find("#goto-reset-token-btn").trigger("click");
      await flushPromises();
      expect(store.state.currentTab).toBe("reset-password");
      expect(wrapper.find("#reset-token-input").exists()).toBe(true);
    });
  });

  describe("3. Synchronized 8-Character Password Validation Across All Frontend Flows", () => {
    it("exports authoritative PASSWORD_POLICY with minLength = 8", () => {
      expect(PASSWORD_POLICY.minLength).toBe(8);
      expect(PASSWORD_POLICY.maxLength).toBe(128);
    });

    it("validates 8-character minimum and password visibility toggle in SignInView", async () => {
      const loginSpy = vi.fn().mockResolvedValue({
        user: { id: "u1", email: "user@example.com", displayName: "User" },
      });
      (window as any).desktopAPI = {
        getDiagnostics: async () => ({ platform: "electron" }),
        auth: { login: loginSpy },
      };

      const wrapper = mount(SignInView);
      await wrapper.find("#signin-email").setValue("user@example.com");
      await wrapper.find("#signin-password").setValue("7Chars!");

      // Toggle show/hide password
      const toggleBtn = wrapper.find(".pwd-toggle-btn");
      expect(
        (wrapper.find("#signin-password").element as HTMLInputElement).type,
      ).toBe("password");
      await toggleBtn.trigger("click");
      expect(
        (wrapper.find("#signin-password").element as HTMLInputElement).type,
      ).toBe("text");

      // Submit <8 chars -> blocked on client with clear error
      await wrapper.find("form").trigger("submit.prevent");
      await flushPromises();
      expect(loginSpy).not.toHaveBeenCalled();
      expect(wrapper.find(".alert-error").text()).toContain(
        "at least 8 characters",
      );

      // Submit 8 chars -> succeeds
      await wrapper.find("#signin-password").setValue("Valid8Ch");
      await wrapper.find("form").trigger("submit.prevent");
      await flushPromises();
      expect(loginSpy).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "Valid8Ch",
      });
    });

    it("validates 8-character minimum in SignUpView, ResetPasswordView, and SecurityView (Change Password)", async () => {
      // SignUpView
      const signUp = mount(SignUpView);
      await signUp.find("#signup-email").setValue("reg@example.com");
      await signUp.find("#signup-password").setValue("1234567");
      expect(
        (signUp.find("#signup-submit-btn").element as HTMLButtonElement)
          .disabled,
      ).toBe(true);
      await signUp.find("#signup-password").setValue("12345678");
      expect(
        (signUp.find("#signup-submit-btn").element as HTMLButtonElement)
          .disabled,
      ).toBe(false);

      // ResetPasswordView
      const resetView = mount(ResetPasswordView);
      await resetView.find("#reset-token-input").setValue("tok_123");
      await resetView.find("#reset-new-password").setValue("1234567");
      expect(
        (resetView.find("#reset-submit-btn").element as HTMLButtonElement)
          .disabled,
      ).toBe(true);
      await resetView.find("#reset-new-password").setValue("12345678");
      expect(
        (resetView.find("#reset-submit-btn").element as HTMLButtonElement)
          .disabled,
      ).toBe(false);

      // SecurityView (Change Password)
      const secView = mount(SecurityView);
      await secView.find("#current-pwd").setValue("OldPass8");
      await secView.find("#new-pwd").setValue("1234567");
      expect(
        (secView.find("#change-pwd-btn").element as HTMLButtonElement).disabled,
      ).toBe(true);
      await secView.find("#new-pwd").setValue("12345678");
      expect(
        (secView.find("#change-pwd-btn").element as HTMLButtonElement).disabled,
      ).toBe(false);
    });
  });
});
