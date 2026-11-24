import * as THREE from "three";
import type { VRM } from "@pixiv/three-vrm";
import { VRMPoseController } from "../avatar-stage/pose-controller.js";
import { VRMBlinkController } from "../avatar-stage/blink-controller.js";

export type CompanionMotionState = "greeting" | "idle" | "thinking";
export type AnimationClipSource = "vrm-clip" | "procedural";

export interface CompanionAnimationOptions {
  reducedMotion?: boolean;
  greetingDuration?: number;
  randomFn?: () => number;
}

export interface CompanionAnimationDiagnostic {
  activeState: CompanionMotionState;
  source: AnimationClipSource;
  hasPlayedGreeting: boolean;
  isPaused: boolean;
  reducedMotion: boolean;
  clipConflictsSuppressed: {
    blink: boolean;
    expressions: boolean;
    headLookAt: boolean;
  };
  weights: {
    greeting: number;
    idle: number;
    thinking: number;
  };
  discoveredClips: string[];
}

const CLIP_PATTERNS: Record<CompanionMotionState, RegExp> = {
  greeting: /greet|wave|hello|bow|welcome/i,
  idle: /idle|stand|breath|wait|default/i,
  thinking: /think|ponder|wonder|focus|curious/i,
};

/**
 * VRMCompanionAnimationController
 *
 * Drives the 3D Authentication Companion with smooth transitions across:
 * - Greeting (one-shot welcome bow & subtle wave on open)
 * - Idle (organic breathing, subtle weight sway)
 * - Blinking (physiologicalHermite blink state machine)
 * - Look At (smooth cursor/user eye & head gaze)
 * - Head Movement (multi-harmonic natural micro-motion)
 * - Thinking (gentle contemplative head tilt & expression when typing/submitting)
 *
 * Prioritizes embedded VRM AnimationClips via THREE.AnimationMixer when present,
 * seamlessly falling back to deterministic procedural humanoid animation.
 */
export class VRMCompanionAnimationController {
  private _vrm: VRM | null = null;
  private _poseController = new VRMPoseController();
  private _blinkController = new VRMBlinkController();
  private _mixer: THREE.AnimationMixer | null = null;
  private _clipActions = new Map<CompanionMotionState, THREE.AnimationAction>();
  private _clipTrackMeta = new Map<
    CompanionMotionState,
    { hasBlink: boolean; hasExpressions: boolean; hasHead: boolean }
  >();
  private _activeClipAction: THREE.AnimationAction | null = null;
  private _discoveredClips: string[] = [];

  private _state: CompanionMotionState = "idle";
  private _hasPlayedGreeting = false;
  private _greetingElapsed = 0;
  private _greetingDuration = 2.6;
  private _thinkingRequested = false;
  private _reactionPulse = 0;

  private _isPaused = false;
  private _reducedMotion = false;
  private _elapsed = 0;

  // Damped blend weights for smooth procedural transitions
  private _greetingWeight = 0;
  private _idleWeight = 1;
  private _thinkingWeight = 0;

  // Gaze & LookAt state
  private _lookAtTarget: THREE.Object3D | null = null;
  private _currentGazePos = new THREE.Vector3(-0.18, 1.32, 2.2);
  private _desiredGazePos = new THREE.Vector3(-0.18, 1.32, 2.2);
  private _targetYaw = -0.06;
  private _targetPitch = 0.0;
  private _currentYaw = -0.06;
  private _currentPitch = 0.0;

  // Cached baseline quaternions & expression capabilities
  private _restQuats = new Map<string, THREE.Quaternion>();
  private _happyExprName: string | null = null;
  private _relaxedExprName: string | null = null;
  private _surprisedExprName: string | null = null;
  private _happyWeight = 0;
  private _relaxedWeight = 0;
  private _surprisedWeight = 0;

  // Reusable math temporaries to avoid per-frame GC pressure
  private readonly _tmpQuatA = new THREE.Quaternion();
  private readonly _tmpEuler = new THREE.Euler();

  public setup(
    vrm: VRM,
    animations: THREE.AnimationClip[] = [],
    lookAtTarget?: THREE.Object3D,
    options?: CompanionAnimationOptions,
  ): void {
    this.dispose();

    this._vrm = vrm;
    this._lookAtTarget = lookAtTarget ?? null;
    this._reducedMotion = Boolean(options?.reducedMotion);
    this._greetingDuration = Math.max(0.8, options?.greetingDuration ?? 2.6);
    this._elapsed = 0;
    this._greetingElapsed = 0;
    this._reactionPulse = 0;

    if (vrm.humanoid) {
      this._poseController.setup(vrm, {
        armAngle: 1.22,
        inwardAngle: 0.12,
        elbowBend: 0.16,
      });

      const trackedBones = [
        "hips",
        "spine",
        "chest",
        "upperChest",
        "neck",
        "head",
        "leftShoulder",
        "rightShoulder",
        "leftUpperArm",
        "rightUpperArm",
        "leftLowerArm",
        "rightLowerArm",
        "leftHand",
        "rightHand",
        "leftEye",
        "rightEye",
      ] as const;

      for (const bone of trackedBones) {
        const node = vrm.humanoid.getNormalizedBoneNode(bone);
        if (node) {
          this._restQuats.set(bone, node.quaternion.clone());
        }
      }
    }

    if (vrm.lookAt && this._lookAtTarget) {
      this._lookAtTarget.position.copy(this._currentGazePos);
      vrm.lookAt.target = this._lookAtTarget;
      vrm.lookAt.autoUpdate = true;
    }

    this._blinkController.setup(vrm, {
      autoBlinkEnabled: !this._reducedMotion,
      randomFn: options?.randomFn,
    });

    this._discoverExpressions(vrm);
    this._setupClipMixer(vrm, animations);

    this._state = "idle";
    this._greetingWeight = 0;
    this._idleWeight = 1;
    this._thinkingWeight = 0;
    this._syncClipState("idle", 0);
  }

  /**
   * Plays the Greeting animation once when Authentication opens.
   * Subsequent calls are ignored so switching tabs does not re-trigger full greeting.
   */
  public playGreetingOnce(): boolean {
    if (!this._vrm || this._hasPlayedGreeting) {
      return false;
    }
    this._hasPlayedGreeting = true;

    if (this._reducedMotion) {
      // Respect reduced motion: gentle static warm expression only
      this._happyWeight = 0.2;
      this._applyExpressions();
      this._vrm.update(0);
      return false;
    }

    this._state = "greeting";
    this._greetingElapsed = 0;
    this._syncClipState("greeting", 0.25);
    return true;
  }

  /**
   * Transitions smoothly into or out of the Thinking state (e.g. while user types or submits).
   */
  public setThinking(active: boolean): void {
    this._thinkingRequested = active;
    if (!this._vrm || this._reducedMotion) return;

    // Do not interrupt an active initial greeting; thinking resumes once greeting completes
    if (this._state === "greeting") return;

    const nextState: CompanionMotionState = active ? "thinking" : "idle";
    if (nextState !== this._state) {
      this._state = nextState;
      this._syncClipState(nextState, 0.35);
    }
  }

  /**
   * Subtle attentive acknowledgement when switching between Sign In and Register panels.
   */
  public triggerPanelSwitchReaction(): void {
    if (!this._vrm || this._reducedMotion) return;
    this._reactionPulse = 1.0;
  }

  /**
   * Updates LookAt and head tracking from normalized viewport coordinates [-1, 1].
   */
  public setPointerTarget(normalizedX: number, normalizedY: number): void {
    const nx = THREE.MathUtils.clamp(normalizedX, -1.2, 1.2);
    const ny = THREE.MathUtils.clamp(normalizedY, -1.2, 1.2);

    // Character stands slightly right (+X); default gaze points gently toward center-left user/panel
    this._desiredGazePos.set(-0.12 + nx * 0.65, 1.32 - ny * 0.45, 2.2);
    this._targetYaw = THREE.MathUtils.clamp(-0.05 + nx * 0.18, -0.26, 0.24);
    this._targetPitch = THREE.MathUtils.clamp(ny * 0.13, -0.16, 0.16);
  }

  public setReducedMotion(enabled: boolean): void {
    this._reducedMotion = enabled;
    this._blinkController.setAutoBlinkEnabled(!enabled);
    if (enabled) {
      this._state = "idle";
      this._greetingWeight = 0;
      this._thinkingWeight = 0;
      this._idleWeight = 1;
      this._reactionPulse = 0;
      this._poseController.applyPose();
      this._vrm?.update(0);
    }
  }

  public pause(): void {
    this._isPaused = true;
    this._blinkController.pause();
  }

  public resume(): void {
    if (!this._isPaused) return;
    this._isPaused = false;
    if (!this._reducedMotion) {
      this._blinkController.resume();
    }
  }

  public update(rawDelta: number): void {
    if (!this._vrm || this._isPaused) return;

    // Cap frame delta to prevent wild spring-bone jumps after tab/window throttling
    const delta = Math.min(Math.max(rawDelta, 0), 0.1);
    this._elapsed += delta;

    // Advance greeting timer and auto-transition to thinking or idle
    if (this._state === "greeting") {
      this._greetingElapsed += delta;
      if (this._greetingElapsed >= this._greetingDuration) {
        this._state = this._thinkingRequested ? "thinking" : "idle";
        this._syncClipState(this._state, 0.45);
      }
    }

    // Exponentially damp state weights for silky procedural crossfades
    const blendAlpha = 1 - Math.exp(-5.5 * delta);
    const targetGreeting =
      !this._reducedMotion && this._state === "greeting" ? 1 : 0;
    const targetThinking =
      !this._reducedMotion && this._state === "thinking" ? 1 : 0;
    const targetIdle = this._reducedMotion ? 1 : this._state === "idle" ? 1 : 0;

    this._greetingWeight = THREE.MathUtils.lerp(
      this._greetingWeight,
      targetGreeting,
      blendAlpha,
    );
    this._thinkingWeight = THREE.MathUtils.lerp(
      this._thinkingWeight,
      targetThinking,
      blendAlpha,
    );
    this._idleWeight = THREE.MathUtils.lerp(
      this._idleWeight,
      targetIdle,
      blendAlpha,
    );

    if (this._reactionPulse > 0.001) {
      this._reactionPulse = Math.max(0, this._reactionPulse - delta * 1.8);
    } else {
      this._reactionPulse = 0;
    }

    // Smooth gaze interpolation
    const gazeAlpha = 1 - Math.exp(-8.0 * delta);
    this._currentGazePos.lerp(this._desiredGazePos, gazeAlpha);
    if (this._lookAtTarget) {
      this._lookAtTarget.position.copy(this._currentGazePos);
    }
    this._currentYaw = THREE.MathUtils.lerp(
      this._currentYaw,
      this._targetYaw,
      gazeAlpha,
    );
    this._currentPitch = THREE.MathUtils.lerp(
      this._currentPitch,
      this._targetPitch,
      gazeAlpha,
    );

    const hasActiveClip =
      this._clipActions.has(this._state) && this._mixer !== null;
    const trackMeta = hasActiveClip
      ? this._clipTrackMeta.get(this._state)
      : undefined;

    if (hasActiveClip && this._mixer) {
      this._mixer.update(delta);
      // Allow subtle gaze head tracking only when the active clip does not animate head bones
      if (!trackMeta?.hasHead && !this._reducedMotion) {
        this._applyGazeOnlyHeadOverlay();
      }
    } else {
      this._applyProceduralHumanoid(this._elapsed);
    }

    // Prevent expression/blink conflicts when embedded VRM clip already drives morph tracks
    if (!trackMeta?.hasExpressions) {
      this._updateFacialExpressions(delta);
    }
    if (!this._reducedMotion && !trackMeta?.hasBlink) {
      this._blinkController.update(delta);
    }

    // Flush normalized humanoid bones, lookAt, expressions, and spring bones
    this._vrm.update(delta);
  }

  public getDiagnostic(): CompanionAnimationDiagnostic {
    const hasActiveClip = this._clipActions.has(this._state);
    const meta = hasActiveClip
      ? this._clipTrackMeta.get(this._state)
      : undefined;
    return {
      activeState: this._state,
      source: hasActiveClip ? "vrm-clip" : "procedural",
      hasPlayedGreeting: this._hasPlayedGreeting,
      isPaused: this._isPaused,
      reducedMotion: this._reducedMotion,
      clipConflictsSuppressed: {
        blink: Boolean(meta?.hasBlink),
        expressions: Boolean(meta?.hasExpressions),
        headLookAt: Boolean(meta?.hasHead),
      },
      weights: {
        greeting: Number(this._greetingWeight.toFixed(3)),
        idle: Number(this._idleWeight.toFixed(3)),
        thinking: Number(this._thinkingWeight.toFixed(3)),
      },
      discoveredClips: [...this._discoveredClips],
    };
  }

  public dispose(): void {
    if (this._mixer) {
      this._mixer.stopAllAction();
      if (this._vrm?.scene) {
        this._mixer.uncacheRoot(this._vrm.scene);
      }
      this._mixer = null;
    }
    this._clipActions.clear();
    this._clipTrackMeta.clear();
    this._activeClipAction = null;
    this._discoveredClips = [];
    this._restQuats.clear();
    this._poseController.dispose();
    this._blinkController.dispose();
    this._vrm = null;
    this._lookAtTarget = null;
    this._happyExprName = null;
    this._relaxedExprName = null;
    this._surprisedExprName = null;
  }

  private _discoverExpressions(vrm: VRM): void {
    const mgr = vrm.expressionManager;
    if (!mgr) return;

    for (const candidate of ["happy", "joy", "fun"]) {
      if (mgr.getExpression(candidate) != null) {
        this._happyExprName = candidate;
        break;
      }
    }
    for (const candidate of ["relaxed", "neutral"]) {
      if (mgr.getExpression(candidate) != null) {
        this._relaxedExprName = candidate;
        break;
      }
    }
    if (mgr.getExpression("surprised") != null) {
      this._surprisedExprName = "surprised";
    }
  }

  private _setupClipMixer(vrm: VRM, animations: THREE.AnimationClip[]): void {
    if (!animations || animations.length === 0) return;

    this._discoveredClips = animations.map((c, idx) => c.name || `clip_${idx}`);
    const matchedStates = new Map<CompanionMotionState, THREE.AnimationClip>();

    for (const state of ["greeting", "idle", "thinking"] as const) {
      const pattern = CLIP_PATTERNS[state];
      const found = animations.find((clip) => pattern.test(clip.name || ""));
      if (found) {
        matchedStates.set(state, found);
      }
    }

    // If VRM ships a single unnamed/generic clip, treat it as idle
    if (matchedStates.size === 0 && animations[0]) {
      matchedStates.set("idle", animations[0]);
    }

    if (matchedStates.size === 0) return;

    this._mixer = new THREE.AnimationMixer(vrm.scene);
    for (const [state, clip] of matchedStates.entries()) {
      const action = this._mixer.clipAction(clip);
      if (state === "greeting") {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      } else {
        action.setLoop(THREE.LoopRepeat, Infinity);
      }
      this._clipActions.set(state, action);

      const trackNames = (clip.tracks || []).map((t) =>
        (t.name || "").toLowerCase(),
      );
      this._clipTrackMeta.set(state, {
        hasBlink: trackNames.some((n) => n.includes("blink")),
        hasExpressions: trackNames.some(
          (n) =>
            n.includes("morph") ||
            n.includes("expression") ||
            n.includes("blendshape") ||
            n.includes("happy") ||
            n.includes("relaxed"),
        ),
        hasHead: trackNames.some(
          (n) => n.includes("head") || n.includes("neck"),
        ),
      });
    }
  }

  private _applyGazeOnlyHeadOverlay(): void {
    const head = this._vrm?.humanoid?.getNormalizedBoneNode("head");
    if (!head) return;
    const base = this._restQuats.get("head");
    if (base) head.quaternion.copy(base);
    this._tmpEuler.set(
      this._currentPitch * 0.75,
      this._currentYaw * 0.75,
      0,
      "YXZ",
    );
    head.quaternion.multiply(this._tmpQuatA.setFromEuler(this._tmpEuler));
  }

  private _syncClipState(
    nextState: CompanionMotionState,
    fadeDuration: number,
  ): void {
    if (!this._mixer) return;
    const nextAction = this._clipActions.get(nextState);
    if (!nextAction) {
      if (this._activeClipAction) {
        this._activeClipAction.fadeOut(Math.max(0.15, fadeDuration));
        this._activeClipAction = null;
      }
      return;
    }

    if (nextAction === this._activeClipAction) return;

    nextAction.reset();
    nextAction.enabled = true;
    nextAction.setEffectiveTimeScale(1);
    nextAction.setEffectiveWeight(1);

    if (this._activeClipAction && fadeDuration > 0) {
      nextAction.crossFadeFrom(this._activeClipAction, fadeDuration, false);
    } else if (fadeDuration > 0) {
      nextAction.fadeIn(fadeDuration);
    }
    nextAction.play();
    this._activeClipAction = nextAction;
  }

  private _applyProceduralHumanoid(elapsed: number): void {
    const humanoid = this._vrm?.humanoid;
    if (!humanoid) return;

    // 1. Reset to clean relaxed A-pose baseline
    this._poseController.applyPose();

    if (this._reducedMotion) {
      return;
    }

    const wGreet = this._greetingWeight;
    const wThink = this._thinkingWeight;
    const pulse = Math.sin(this._reactionPulse * Math.PI);

    // Greeting envelope: smooth ease-in/out bow + wave
    const greetPhase = THREE.MathUtils.clamp(
      this._greetingElapsed / this._greetingDuration,
      0,
      1,
    );
    const bowCurve =
      Math.sin(Math.min(1, greetPhase / 0.55) * Math.PI) * wGreet;
    const waveEnvelope =
      greetPhase > 0.12 && greetPhase < 0.92
        ? Math.sin(((greetPhase - 0.12) / 0.8) * Math.PI) * wGreet
        : 0;
    const waveOsc = Math.sin(elapsed * 7.2) * 0.22 * waveEnvelope;

    // 2. Hips subtle poise sway
    const hips = humanoid.getNormalizedBoneNode("hips");
    if (hips) {
      const base = this._restQuats.get("hips");
      if (base) hips.quaternion.copy(base);
      this._tmpEuler.set(
        0,
        Math.sin(elapsed * 0.45) * 0.015,
        Math.sin(elapsed * 0.65) * 0.012,
      );
      hips.quaternion.multiply(this._tmpQuatA.setFromEuler(this._tmpEuler));
    }

    // 3. Spine & Chest breathing + polite greeting bow + thinking poise
    const breath = Math.sin(elapsed * 1.65);
    const spine = humanoid.getNormalizedBoneNode("spine");
    if (spine) {
      const base = this._restQuats.get("spine");
      if (base) spine.quaternion.copy(base);
      this._tmpEuler.set(
        breath * 0.018 + bowCurve * 0.11 - wThink * 0.015,
        Math.sin(elapsed * 0.5) * 0.016,
        Math.cos(elapsed * 0.65) * 0.01 + wThink * 0.018,
      );
      spine.quaternion.multiply(this._tmpQuatA.setFromEuler(this._tmpEuler));
    }

    const chest =
      humanoid.getNormalizedBoneNode("upperChest") ||
      humanoid.getNormalizedBoneNode("chest");
    if (chest) {
      const boneKey = humanoid.getNormalizedBoneNode("upperChest")
        ? "upperChest"
        : "chest";
      const base = this._restQuats.get(boneKey);
      if (base) chest.quaternion.copy(base);
      this._tmpEuler.set(breath * 0.014 + bowCurve * 0.07, 0, -wThink * 0.012);
      chest.quaternion.multiply(this._tmpQuatA.setFromEuler(this._tmpEuler));
    }

    // 4. Right arm greeting wave & subtle thinking contemplation poise
    const rightUpperArm = humanoid.getNormalizedBoneNode("rightUpperArm");
    const rightLowerArm = humanoid.getNormalizedBoneNode("rightLowerArm");
    const rightHand = humanoid.getNormalizedBoneNode("rightHand");

    if (rightUpperArm && (waveEnvelope > 0.001 || wThink > 0.001)) {
      const restUpper =
        this._restQuats.get("rightUpperArm") || new THREE.Quaternion();
      const targetUpperZ =
        THREE.MathUtils.lerp(1.22, 0.92, waveEnvelope) - 0.08 * wThink;
      const targetUpperY = -0.12 - 0.34 * waveEnvelope - 0.18 * wThink;
      const targetUpperX = 0.04 + 0.14 * waveEnvelope + 0.08 * wThink;
      this._tmpEuler.set(targetUpperX, targetUpperY, targetUpperZ, "ZYX");
      rightUpperArm.quaternion
        .copy(restUpper)
        .multiply(this._tmpQuatA.setFromEuler(this._tmpEuler));
    }

    if (rightLowerArm && (waveEnvelope > 0.001 || wThink > 0.001)) {
      const restLower =
        this._restQuats.get("rightLowerArm") || new THREE.Quaternion();
      const elbowLiftZ = -2.05 * waveEnvelope - 1.15 * wThink + waveOsc * 0.42;
      const elbowInwardY = 0.16 + 0.22 * waveEnvelope + 0.45 * wThink;
      const palmForwardX = -0.36 * waveEnvelope - 0.18 * wThink;
      this._tmpEuler.set(palmForwardX, elbowInwardY, elbowLiftZ, "ZYX");
      rightLowerArm.quaternion
        .copy(restLower)
        .multiply(this._tmpQuatA.setFromEuler(this._tmpEuler));
    }

    if (rightHand && waveEnvelope > 0.001) {
      const base = this._restQuats.get("rightHand");
      if (base) rightHand.quaternion.copy(base);
      this._tmpEuler.set(0.06 * waveEnvelope, 0, waveOsc * 0.75);
      rightHand.quaternion.multiply(
        this._tmpQuatA.setFromEuler(this._tmpEuler),
      );
    }

    // 5. Neck & Head movement + LookAt gaze + Thinking head tilt + panel-switch nod
    const head = humanoid.getNormalizedBoneNode("head");
    if (head) {
      const base = this._restQuats.get("head");
      if (base) head.quaternion.copy(base);

      const idleYaw = Math.sin(elapsed * 0.68) * 0.032;
      const idlePitch = Math.sin(elapsed * 1.15) * 0.012;
      const idleRoll = Math.sin(elapsed * 0.85) * 0.014;

      const pitch =
        idlePitch +
        this._currentPitch +
        bowCurve * 0.09 -
        wThink * 0.035 +
        pulse * 0.045;
      const yaw = idleYaw + this._currentYaw + wThink * 0.045;
      const roll = idleRoll + wThink * 0.075 + waveEnvelope * 0.04;

      this._tmpEuler.set(pitch, yaw, roll, "YXZ");
      head.quaternion.multiply(this._tmpQuatA.setFromEuler(this._tmpEuler));
    }

    // 6. Eye bone fallback if VRM lacks VRMLookAt
    if (!this._vrm?.lookAt || !this._vrm.lookAt.target) {
      const leftEye = humanoid.getNormalizedBoneNode("leftEye");
      const rightEye = humanoid.getNormalizedBoneNode("rightEye");
      const eyeYaw = THREE.MathUtils.clamp(this._currentYaw * 1.6, -0.32, 0.32);
      const eyePitch = THREE.MathUtils.clamp(
        this._currentPitch * 1.5,
        -0.24,
        0.24,
      );
      if (leftEye) {
        const base = this._restQuats.get("leftEye");
        if (base) leftEye.quaternion.copy(base);
        this._tmpEuler.set(eyePitch, eyeYaw, 0);
        leftEye.quaternion.multiply(
          this._tmpQuatA.setFromEuler(this._tmpEuler),
        );
      }
      if (rightEye) {
        const base = this._restQuats.get("rightEye");
        if (base) rightEye.quaternion.copy(base);
        this._tmpEuler.set(eyePitch, eyeYaw, 0);
        rightEye.quaternion.multiply(
          this._tmpQuatA.setFromEuler(this._tmpEuler),
        );
      }
    }
  }

  private _updateFacialExpressions(delta: number): void {
    const mgr = this._vrm?.expressionManager;
    if (!mgr) return;

    const alpha = 1 - Math.exp(-6.0 * delta);
    const pulse = Math.sin(this._reactionPulse * Math.PI);

    const targetHappy = this._reducedMotion
      ? 0.18
      : Math.min(0.58, this._greetingWeight * 0.55 + pulse * 0.22);
    const targetRelaxed = this._reducedMotion
      ? 0.15
      : this._idleWeight * 0.18 + this._thinkingWeight * 0.26;
    const targetSurprised = this._reducedMotion ? 0 : pulse * 0.12;

    this._happyWeight = THREE.MathUtils.lerp(
      this._happyWeight,
      targetHappy,
      alpha,
    );
    this._relaxedWeight = THREE.MathUtils.lerp(
      this._relaxedWeight,
      targetRelaxed,
      alpha,
    );
    this._surprisedWeight = THREE.MathUtils.lerp(
      this._surprisedWeight,
      targetSurprised,
      alpha,
    );

    this._applyExpressions();
  }

  private _applyExpressions(): void {
    const mgr = this._vrm?.expressionManager;
    if (!mgr) return;

    if (this._happyExprName) {
      mgr.setValue(this._happyExprName, this._happyWeight);
    }
    if (
      this._relaxedExprName &&
      this._relaxedExprName !== this._happyExprName
    ) {
      mgr.setValue(this._relaxedExprName, this._relaxedWeight);
    }
    if (this._surprisedExprName) {
      mgr.setValue(this._surprisedExprName, this._surprisedWeight);
    }
  }
}
