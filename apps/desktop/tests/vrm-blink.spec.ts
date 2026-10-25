import { describe, it, expect } from "vitest";
import * as THREE from "three";
import type { VRM } from "@pixiv/three-vrm";
import {
  VRMBlinkController,
  BlinkState,
} from "../src/avatar-stage/blink-controller.js";

describe("VRMBlinkController", () => {
  function createMockVRM(expressionNames: string[]): {
    vrm: VRM;
    getWeights: () => Record<string, number>;
  } {
    const weights: Record<string, number> = {};
    const expressionMap: Record<string, any> = {};

    for (const name of expressionNames) {
      weights[name] = 0;
      expressionMap[name] = { expressionName: name, weight: 0 };
    }

    const expressionManager = {
      expressionMap,
      getExpression: (name: string) => expressionMap[name] || null,
      getValue: (name: string) => (name in weights ? weights[name] : null),
      setValue: (name: string, weight: number) => {
        if (name in weights) {
          weights[name] = Math.max(0, Math.min(1, weight));
          expressionMap[name].weight = weights[name];
        }
      },
      resetValues: () => {
        for (const k of Object.keys(weights)) {
          weights[k] = 0;
          expressionMap[k].weight = 0;
        }
      },
      update: () => {},
    };

    const vrm = {
      scene: new THREE.Group(),
      expressionManager: expressionManager as any,
    } as unknown as VRM;

    return {
      vrm,
      getWeights: () => ({ ...weights }),
    };
  }

  describe("Expression Discovery & Selection Strategy", () => {
    it("selects unified 'blink' expression as priority when available", () => {
      const { vrm } = createMockVRM(["blink", "blinkLeft", "blinkRight", "aa"]);
      const controller = new VRMBlinkController();
      const supported = controller.setup(vrm);

      expect(supported).toBe(true);
      expect(controller.mode).toBe("blink");
      const diag = controller.getDiagnostic();
      expect(diag.targetExpressions).toEqual(["blink"]);
      expect(diag.supported).toBe(true);
    });

    it("falls back to bilateral 'blinkLeft' + 'blinkRight' when 'blink' is absent", () => {
      const { vrm, getWeights } = createMockVRM([
        "blinkLeft",
        "blinkRight",
        "happy",
      ]);
      const controller = new VRMBlinkController();
      const supported = controller.setup(vrm);

      expect(supported).toBe(true);
      expect(controller.mode).toBe("bilateral");
      const diag = controller.getDiagnostic();
      expect(diag.targetExpressions).toEqual(["blinkLeft", "blinkRight"]);

      // Trigger a test blink to verify both eyes receive identical weights
      controller.triggerTestBlink();
      controller.update(0.04); // Halfway into closing
      const weights = getWeights();
      expect(weights["blinkLeft"]).toBeGreaterThan(0);
      expect(weights["blinkRight"]).toBeGreaterThan(0);
      expect(weights["blinkLeft"]).toBeCloseTo(weights["blinkRight"]!, 5);
    });

    it("handles asymmetric single-eye fallbacks gracefully", () => {
      const leftOnly = createMockVRM(["blinkLeft"]).vrm;
      const leftController = new VRMBlinkController();
      expect(leftController.setup(leftOnly)).toBe(true);
      expect(leftController.mode).toBe("blinkLeftOnly");
      expect(leftController.getDiagnostic().targetExpressions).toEqual([
        "blinkLeft",
      ]);

      const rightOnly = createMockVRM(["blinkRight"]).vrm;
      const rightController = new VRMBlinkController();
      expect(rightController.setup(rightOnly)).toBe(true);
      expect(rightController.mode).toBe("blinkRightOnly");
      expect(rightController.getDiagnostic().targetExpressions).toEqual([
        "blinkRight",
      ]);
    });

    it("supports custom expression override when configured", () => {
      const { vrm } = createMockVRM(["custom_eyes_closed", "blink"]);
      const controller = new VRMBlinkController();
      const supported = controller.setup(vrm, {
        customExpressionName: "custom_eyes_closed",
      });

      expect(supported).toBe(true);
      expect(controller.mode).toBe("custom");
      expect(controller.getDiagnostic().targetExpressions).toEqual([
        "custom_eyes_closed",
      ]);
    });

    it("detects unsupported models when no eye-closing expressions exist", () => {
      const { vrm } = createMockVRM(["happy", "sad", "neutral"]);
      const controller = new VRMBlinkController();
      const supported = controller.setup(vrm);

      expect(supported).toBe(false);
      expect(controller.mode).toBe("unsupported");
      expect(controller.isSupported).toBe(false);

      const diag = controller.getDiagnostic();
      expect(diag.supported).toBe(false);
      expect(diag.targetExpressions).toEqual([]);

      // Test blink on unsupported model fails cleanly with diagnostic message
      const testRes = controller.triggerTestBlink();
      expect(testRes.success).toBe(false);
      expect(testRes.error).toContain("lacks supported eye-closing");
    });

    it("handles models with null expressionManager without throwing", () => {
      const emptyVrm = { scene: new THREE.Group() } as unknown as VRM;
      const controller = new VRMBlinkController();
      const supported = controller.setup(emptyVrm);

      expect(supported).toBe(false);
      expect(controller.isSupported).toBe(false);
      expect(() => controller.update(0.016)).not.toThrow();
      expect(() => controller.reset()).not.toThrow();
      expect(() => controller.dispose()).not.toThrow();
    });
  });

  describe("State Machine Transitions (Open -> Closing -> Closed -> Opening -> Open)", () => {
    it("completes full physiological blink cycle with smooth Hermite easing", () => {
      const { vrm, getWeights } = createMockVRM(["blink"]);
      const controller = new VRMBlinkController();

      // Deterministic timing options:
      // minInterval = 3.0, maxInterval = 3.0 -> timer exactly 3.0s
      // closing = 0.08s, closed = 0.04s, opening = 0.12s
      controller.setup(vrm, {
        minInterval: 3.0,
        maxInterval: 3.0,
        closingDuration: 0.08,
        closedDuration: 0.04,
        openingDuration: 0.12,
        doubleBlinkChance: 0.0, // Disable double-blink for this test
      });

      // 1. Initial state: Open, weights are 0
      expect(controller.state).toBe(BlinkState.Open);
      expect(controller.currentWeight).toBe(0.0);
      expect(getWeights()["blink"]).toBe(0.0);

      // 2. Advance time 2.0s -> Still Open, weight 0
      controller.update(2.0);
      expect(controller.state).toBe(BlinkState.Open);
      expect(controller.currentWeight).toBe(0.0);

      // 3. Advance time 1.0s (total 3.0s) -> Timer hits 0, transitions to Closing
      controller.update(1.0);
      expect(controller.state).toBe(BlinkState.Closing);

      // 4. Advance 0.04s (halfway through 0.08s Closing)
      controller.update(0.04);
      expect(controller.state).toBe(BlinkState.Closing);
      expect(controller.currentWeight).toBeGreaterThan(0.2);
      expect(controller.currentWeight).toBeLessThan(0.8);
      expect(getWeights()["blink"]).toBeCloseTo(controller.currentWeight, 4);

      // 5. Complete Closing phase (advance another 0.04s) -> Enters Closed
      controller.update(0.04);
      expect(controller.state).toBe(BlinkState.Closed);
      expect(controller.currentWeight).toBe(1.0);
      expect(getWeights()["blink"]).toBe(1.0);

      // 6. During Closed hold (0.04s) -> remains 1.0
      controller.update(0.02);
      expect(controller.state).toBe(BlinkState.Closed);
      expect(controller.currentWeight).toBe(1.0);

      // 7. Complete Closed phase (advance 0.02s) -> Enters Opening
      controller.update(0.02);
      expect(controller.state).toBe(BlinkState.Opening);

      // 8. Halfway through Opening (advance 0.06s of 0.12s)
      controller.update(0.06);
      expect(controller.state).toBe(BlinkState.Opening);
      expect(controller.currentWeight).toBeGreaterThan(0.2);
      expect(controller.currentWeight).toBeLessThan(0.8);

      // 9. Complete Opening (advance 0.06s) -> Returns to Open with 0 weight
      controller.update(0.06);
      expect(controller.state).toBe(BlinkState.Open);
      expect(controller.currentWeight).toBe(0.0);
      expect(getWeights()["blink"]).toBe(0.0);
      expect(controller.getDiagnostic().totalBlinks).toBe(1);
    });

    it("keeps expression weights bounded strictly within [0.0, 1.0] across all steps", () => {
      const { vrm } = createMockVRM(["blink"]);
      const controller = new VRMBlinkController();
      controller.setup(vrm, {
        minInterval: 0.1,
        maxInterval: 0.2,
        closingDuration: 0.05,
        closedDuration: 0.03,
        openingDuration: 0.08,
      });

      // Simulate 500 render frames with erratic delta times
      for (let i = 0; i < 500; i++) {
        const delta = 0.008 + (i % 7) * 0.005; // 8ms to 38ms
        controller.update(delta);
        expect(controller.currentWeight).toBeGreaterThanOrEqual(0.0);
        expect(controller.currentWeight).toBeLessThanOrEqual(1.0);
      }
    });
  });

  describe("Natural Double-Blink Variation", () => {
    it("triggers a natural double-blink when random check passes", () => {
      const { vrm } = createMockVRM(["blink"]);
      const controller = new VRMBlinkController();

      // Return 0.05 from randomFn so doubleBlinkChance (0.50) triggers
      controller.setup(vrm, {
        randomFn: () => 0.05,
        minInterval: 2.0,
        maxInterval: 2.0,
        closingDuration: 0.06,
        closedDuration: 0.04,
        openingDuration: 0.08,
        doubleBlinkChance: 0.5,
        doubleBlinkInterval: 0.15,
      });

      // Advance through first blink: 2.0s wait + 0.18s cycle
      controller.update(2.0); // enters Closing
      controller.update(0.06); // enters Closed
      controller.update(0.04); // enters Opening
      controller.update(0.08); // finishes first blink -> Open

      expect(controller.getDiagnostic().totalBlinks).toBe(1);

      // Next interval should be scheduled for double-blink gap (0.15s), NOT 2.0s!
      controller.update(0.14);
      expect(controller.state).toBe(BlinkState.Open); // 140ms in: still waiting

      controller.update(0.02); // 160ms total: double-blink triggers!
      expect(controller.state).toBe(BlinkState.Closing);

      // Finish second blink
      controller.update(0.06);
      controller.update(0.04);
      controller.update(0.08);
      expect(controller.getDiagnostic().totalBlinks).toBe(2);

      // Third interval must NOT be another double-blink (prevent runaway loops)
      controller.update(0.15);
      expect(controller.state).toBe(BlinkState.Open); // Standard 2.0s interval restored
    });
  });

  describe("Manual Test Blink Action", () => {
    it("executes an immediate blink cycle regardless of pending interval", () => {
      const { vrm, getWeights } = createMockVRM(["blink"]);
      const controller = new VRMBlinkController();
      controller.setup(vrm, {
        minInterval: 10.0,
        maxInterval: 10.0,
        closingDuration: 0.06,
        closedDuration: 0.04,
        openingDuration: 0.08,
      });

      expect(controller.state).toBe(BlinkState.Open);

      // Trigger test blink immediately
      const res = controller.triggerTestBlink();
      expect(res.success).toBe(true);
      expect(controller.state).toBe(BlinkState.Closing);
      expect(controller.getDiagnostic().isTestBlinkActive).toBe(true);

      // Complete cycle
      controller.update(0.06);
      expect(controller.state).toBe(BlinkState.Closed);
      expect(getWeights()["blink"]).toBe(1.0);

      controller.update(0.04);
      expect(controller.state).toBe(BlinkState.Opening);

      controller.update(0.08);
      expect(controller.state).toBe(BlinkState.Open);
      expect(getWeights()["blink"]).toBe(0.0);
      expect(controller.getDiagnostic().isTestBlinkActive).toBe(false);
    });

    it("allows test blink to run even when spontaneous auto-blinking is disabled", () => {
      const { vrm, getWeights } = createMockVRM(["blink"]);
      const controller = new VRMBlinkController();
      controller.setup(vrm, {
        autoBlinkEnabled: false,
        closingDuration: 0.05,
        closedDuration: 0.03,
        openingDuration: 0.05,
      });

      // Spontaneous updates do not blink
      controller.update(10.0);
      expect(controller.state).toBe(BlinkState.Open);
      expect(getWeights()["blink"]).toBe(0.0);

      // Manual test blink works
      controller.triggerTestBlink();
      expect(controller.state).toBe(BlinkState.Closing);

      controller.update(0.05);
      expect(controller.state).toBe(BlinkState.Closed);
      expect(getWeights()["blink"]).toBe(1.0);

      controller.update(0.03);
      expect(controller.state).toBe(BlinkState.Opening);

      controller.update(0.05);
      expect(controller.state).toBe(BlinkState.Open);
      expect(getWeights()["blink"]).toBe(0.0);
    });
  });

  describe("Pause, Resume, and Auto-Blink Controls", () => {
    it("resets eye closure to 0 when paused to prevent frozen closed eyes", () => {
      const { vrm, getWeights } = createMockVRM(["blink"]);
      const controller = new VRMBlinkController();
      controller.setup(vrm, {
        closingDuration: 0.1,
        closedDuration: 0.1,
        openingDuration: 0.1,
      });

      // Force into closed state
      controller.triggerTestBlink();
      controller.update(0.1);
      expect(controller.state).toBe(BlinkState.Closed);
      expect(getWeights()["blink"]).toBe(1.0);

      // Pause while eyes are closed
      controller.pause();
      expect(controller.isPaused).toBe(true);
      expect(controller.state).toBe(BlinkState.Open);
      expect(controller.currentWeight).toBe(0.0);
      expect(getWeights()["blink"]).toBe(0.0); // Eyes are restored to open!

      // Time updates while paused do nothing
      controller.update(5.0);
      expect(controller.state).toBe(BlinkState.Open);
      expect(getWeights()["blink"]).toBe(0.0);

      // Resume starts cleanly
      controller.resume();
      expect(controller.isPaused).toBe(false);
    });

    it("resets weights on autoBlinkEnabled toggle", () => {
      const { vrm, getWeights } = createMockVRM(["blink"]);
      const controller = new VRMBlinkController();
      controller.setup(vrm, {
        minInterval: 1.0,
        maxInterval: 1.0,
        closingDuration: 0.1,
      });

      // Step until spontaneous blink starts (Closing)
      controller.update(1.0); // enters Closing
      controller.update(0.04);
      expect(controller.currentWeight).toBeGreaterThan(0);

      controller.setAutoBlinkEnabled(false);
      expect(controller.autoBlinkEnabled).toBe(false);
      expect(controller.currentWeight).toBe(0.0);
      expect(getWeights()["blink"]).toBe(0.0);
    });
  });

  describe("Disposal and Avatar Switching", () => {
    it("cleans up weights and unbinds VRM on disposal", () => {
      const { vrm, getWeights } = createMockVRM(["blink"]);
      const controller = new VRMBlinkController();
      controller.setup(vrm);

      controller.triggerTestBlink();
      controller.update(0.05);

      controller.dispose();
      expect(controller.isSupported).toBe(false);
      expect(controller.mode).toBe("unsupported");
      expect(controller.currentWeight).toBe(0.0);
      expect(getWeights()["blink"]).toBe(0.0);

      // Updating after dispose does not throw or mutate
      expect(() => controller.update(0.1)).not.toThrow();
    });
  });
});
