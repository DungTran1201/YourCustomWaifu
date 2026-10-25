import type { VRM } from "@pixiv/three-vrm";
import {
  BlinkState,
  type BlinkDiagnostic,
  type BlinkMode,
} from "@vrm/platform-contracts";

export { BlinkState, type BlinkMode, type BlinkDiagnostic };

export interface BlinkControllerOptions {
  /** Custom random generator returning [0, 1) for deterministic unit testing (default: Math.random) */
  randomFn?: () => number;
  /** Minimum interval between spontaneous blinks in seconds (default: 2.2) */
  minInterval?: number;
  /** Maximum interval between spontaneous blinks in seconds (default: 5.5) */
  maxInterval?: number;
  /** Duration of eyelid closing phase in seconds (default: 0.07 = 70ms) */
  closingDuration?: number;
  /** Duration of eyelid fully closed hold in seconds (default: 0.04 = 40ms) */
  closedDuration?: number;
  /** Duration of eyelid opening phase in seconds (default: 0.11 = 110ms) */
  openingDuration?: number;
  /** Probability of triggering a double-blink sequence [0, 1] (default: 0.15) */
  doubleBlinkChance?: number;
  /** Interval between the first and second blink in a double blink in seconds (default: 0.18) */
  doubleBlinkInterval?: number;
  /** Maximum expression closure weight (default: 1.0) */
  maxWeight?: number;
  /** Whether spontaneous blinking is enabled (default: true) */
  autoBlinkEnabled?: boolean;
  /** Optional custom expression name override */
  customExpressionName?: string;
}

/**
 * VRMBlinkController: Natural, human-like procedural blinking state machine for VRM avatars.
 *
 * Implements:
 * 1. Intelligent capability discovery (blink, bilateral blinkLeft+blinkRight, asymmetric fallbacks, or custom).
 * 2. Physiological state machine: Open -> Closing (fast snap) -> Closed (brief hold) -> Opening (gentle lift).
 * 3. Human timing distributions with spontaneous variation and occasional natural double blinks.
 * 4. Deterministic testability via injectable random and delta-time progression.
 * 5. Safe lifecycle cleanup, pause/resume without stuck closed eyes, and manual Test Blink triggers.
 */
export class VRMBlinkController {
  private _vrm: VRM | null = null;
  private _state: BlinkState = "Open" as BlinkState;
  private _mode: BlinkMode = "unsupported";
  private _targetExpressions: string[] = [];
  private _availableExpressions: string[] = [];
  private _supported = false;

  private _stateTime = 0;
  private _intervalTimer = 0;
  private _currentWeight = 0;

  private _randomFn: () => number = Math.random;
  private _minInterval = 2.2;
  private _maxInterval = 5.5;
  private _closingDuration = 0.07;
  private _closedDuration = 0.04;
  private _openingDuration = 0.11;
  private _doubleBlinkChance = 0.15;
  private _doubleBlinkInterval = 0.18;
  private _maxWeight = 1.0;

  private _autoBlinkEnabled = true;
  private _isPaused = false;
  private _isTestBlinkActive = false;
  private _isDoubleBlinkSecond = false;
  private _totalBlinks = 0;

  /**
   * Initializes the controller for a loaded VRM instance.
   * Discovers available expressions, configures target names, and resets the timer.
   */
  public setup(vrm: VRM, options?: BlinkControllerOptions): boolean {
    this._vrm = vrm;
    this.reset();

    if (options?.randomFn) this._randomFn = options.randomFn;
    if (options?.minInterval !== undefined)
      this._minInterval = options.minInterval;
    if (options?.maxInterval !== undefined)
      this._maxInterval = options.maxInterval;
    if (options?.closingDuration !== undefined)
      this._closingDuration = Math.max(0.01, options.closingDuration);
    if (options?.closedDuration !== undefined)
      this._closedDuration = Math.max(0.01, options.closedDuration);
    if (options?.openingDuration !== undefined)
      this._openingDuration = Math.max(0.01, options.openingDuration);
    if (options?.doubleBlinkChance !== undefined)
      this._doubleBlinkChance = options.doubleBlinkChance;
    if (options?.doubleBlinkInterval !== undefined)
      this._doubleBlinkInterval = options.doubleBlinkInterval;
    if (options?.maxWeight !== undefined)
      this._maxWeight = Math.max(0, Math.min(1, options.maxWeight));
    if (options?.autoBlinkEnabled !== undefined)
      this._autoBlinkEnabled = options.autoBlinkEnabled;

    const expMgr = vrm.expressionManager;
    if (!expMgr) {
      this._mode = "unsupported";
      this._supported = false;
      this._targetExpressions = [];
      this._availableExpressions = [];
      console.warn("[VRMBlinkController] Model lacks an expressionManager");
      return false;
    }

    // Inspect registered expressions
    try {
      this._availableExpressions = Object.keys(expMgr.expressionMap || {});
    } catch {
      this._availableExpressions = [];
    }

    // Expression Selection Strategy:
    // 1. Custom expression if explicitly requested and existing
    if (
      options?.customExpressionName &&
      expMgr.getExpression(options.customExpressionName) != null
    ) {
      this._mode = "custom";
      this._targetExpressions = [options.customExpressionName];
      this._supported = true;
    }
    // 2. Standard unified 'blink' expression (drives both eyes)
    else if (expMgr.getExpression("blink") != null) {
      this._mode = "blink";
      this._targetExpressions = ["blink"];
      this._supported = true;
    }
    // 3. Bilateral synchronized 'blinkLeft' + 'blinkRight'
    else if (
      expMgr.getExpression("blinkLeft") != null &&
      expMgr.getExpression("blinkRight") != null
    ) {
      this._mode = "bilateral";
      this._targetExpressions = ["blinkLeft", "blinkRight"];
      this._supported = true;
    }
    // 4. Asymmetric fallbacks
    else if (expMgr.getExpression("blinkLeft") != null) {
      this._mode = "blinkLeftOnly";
      this._targetExpressions = ["blinkLeft"];
      this._supported = true;
      console.warn(
        "[VRMBlinkController] Model only exposes 'blinkLeft'; symmetric blinking unavailable",
      );
    } else if (expMgr.getExpression("blinkRight") != null) {
      this._mode = "blinkRightOnly";
      this._targetExpressions = ["blinkRight"];
      this._supported = true;
      console.warn(
        "[VRMBlinkController] Model only exposes 'blinkRight'; symmetric blinking unavailable",
      );
    }
    // 5. Unsupported
    else {
      this._mode = "unsupported";
      this._targetExpressions = [];
      this._supported = false;
      console.warn(
        "[VRMBlinkController] Model lacks supported eye-closing controls (neither blink nor blinkLeft/Right found)",
      );
      return false;
    }

    // Initialize in Open state with a randomized first interval
    this._applyWeight(0.0);
    this._intervalTimer = this._getNextInterval();
    return true;
  }

  /**
   * Advances the blinking state machine by delta time (seconds).
   * Must be called in the render loop before vrm.update(delta).
   */
  public update(delta: number): void {
    if (!this._vrm || !this._supported || this._isPaused) {
      return;
    }

    // If spontaneous blinking is disabled and no manual test blink is running, stay Open with 0 weight
    if (!this._autoBlinkEnabled && !this._isTestBlinkActive) {
      if (this._currentWeight !== 0.0 || this._state !== "Open") {
        this._currentWeight = 0.0;
        this._state = "Open" as BlinkState;
        this._stateTime = 0;
        this._applyWeight(0.0);
      }
      return;
    }

    switch (this._state) {
      case "Open": {
        this._intervalTimer -= delta;
        if (this._intervalTimer <= 0) {
          this._startBlink();
        }
        break;
      }

      case "Closing": {
        this._stateTime += delta;
        const progress = Math.min(1.0, this._stateTime / this._closingDuration);

        // Natural eyelid closure curve (Hermite smoothstep for rapid snap without vertex popping)
        const eased = progress * progress * (3.0 - 2.0 * progress);
        this._currentWeight = eased * this._maxWeight;
        this._applyWeight(this._currentWeight);

        if (this._stateTime >= this._closingDuration) {
          this._state = "Closed" as BlinkState;
          this._stateTime = 0;
          this._currentWeight = this._maxWeight;
          this._applyWeight(this._currentWeight);
        }
        break;
      }

      case "Closed": {
        this._stateTime += delta;
        this._currentWeight = this._maxWeight;
        this._applyWeight(this._currentWeight);

        if (this._stateTime >= this._closedDuration) {
          this._state = "Opening" as BlinkState;
          this._stateTime = 0;
        }
        break;
      }

      case "Opening": {
        this._stateTime += delta;
        const progress = Math.min(1.0, this._stateTime / this._openingDuration);

        // Natural eyelid opening curve (Hermite smooth reverse)
        const eased = 1.0 - progress * progress * (3.0 - 2.0 * progress);
        this._currentWeight = Math.max(0.0, eased * this._maxWeight);
        this._applyWeight(this._currentWeight);

        if (this._stateTime >= this._openingDuration) {
          this._state = "Open" as BlinkState;
          this._stateTime = 0;
          this._currentWeight = 0.0;
          this._applyWeight(0.0);
          this._totalBlinks++;

          const wasTest = this._isTestBlinkActive;
          this._isTestBlinkActive = false;

          // Natural spontaneous double blink chance (if not already the second blink)
          if (
            !wasTest &&
            !this._isDoubleBlinkSecond &&
            this._randomFn() < this._doubleBlinkChance
          ) {
            this._isDoubleBlinkSecond = true;
            this._intervalTimer = this._doubleBlinkInterval;
          } else {
            this._isDoubleBlinkSecond = false;
            this._intervalTimer = this._getNextInterval();
          }
        }
        break;
      }
    }
  }

  /**
   * Triggers an immediate single blink cycle (Test Blink action).
   * Overrides spontaneous timer and safely returns to natural blinking when finished.
   */
  public triggerTestBlink(): {
    success: boolean;
    mode: BlinkMode;
    error?: string;
  } {
    if (!this._supported || !this._vrm) {
      return {
        success: false,
        mode: this._mode,
        error: "Model lacks supported eye-closing expressions",
      };
    }

    this._isTestBlinkActive = true;
    this._isDoubleBlinkSecond = false;
    this._startBlink();
    return {
      success: true,
      mode: this._mode,
    };
  }

  /**
   * Pauses the blinking controller. Immediately resets eyelid weight to 0
   * so the avatar does not freeze with eyes shut.
   */
  public pause(): void {
    this._isPaused = true;
    this._currentWeight = 0.0;
    this._state = "Open" as BlinkState;
    this._stateTime = 0;
    this._isTestBlinkActive = false;
    this._applyWeight(0.0);
  }

  /**
   * Resumes the blinking controller from Open state with a randomized interval.
   */
  public resume(): void {
    this._isPaused = false;
    this._currentWeight = 0.0;
    this._state = "Open" as BlinkState;
    this._stateTime = 0;
    this._intervalTimer = this._getNextInterval();
  }

  /**
   * Enables or disables automatic spontaneous blinking.
   */
  public setAutoBlinkEnabled(enabled: boolean): void {
    this._autoBlinkEnabled = enabled;
    if (!enabled && !this._isTestBlinkActive) {
      this._currentWeight = 0.0;
      this._state = "Open" as BlinkState;
      this._stateTime = 0;
      this._applyWeight(0.0);
    } else if (enabled) {
      this._intervalTimer = this._getNextInterval();
    }
  }

  /**
   * Returns complete diagnostic snapshot for UI badges or inspection.
   */
  public getDiagnostic(): BlinkDiagnostic {
    return {
      mode: this._mode,
      targetExpressions: [...this._targetExpressions],
      availableExpressions: [...this._availableExpressions],
      supported: this._supported,
      state: this._state,
      currentWeight: this._currentWeight,
      autoBlinkEnabled: this._autoBlinkEnabled,
      isPaused: this._isPaused,
      isTestBlinkActive: this._isTestBlinkActive,
      totalBlinks: this._totalBlinks,
    };
  }

  /**
   * Resets internal timers and restores target expressions to 0.0.
   */
  public reset(): void {
    this._applyWeight(0.0);
    this._state = "Open" as BlinkState;
    this._stateTime = 0;
    this._currentWeight = 0.0;
    this._isTestBlinkActive = false;
    this._isDoubleBlinkSecond = false;
  }

  /**
   * Disposes of the controller and unbinds VRM references.
   */
  public dispose(): void {
    this.reset();
    this._vrm = null;
    this._supported = false;
    this._mode = "unsupported";
    this._targetExpressions = [];
    this._availableExpressions = [];
  }

  public get isSupported(): boolean {
    return this._supported;
  }

  public get mode(): BlinkMode {
    return this._mode;
  }

  public get state(): BlinkState {
    return this._state;
  }

  public get currentWeight(): number {
    return this._currentWeight;
  }

  public get isPaused(): boolean {
    return this._isPaused;
  }

  public get autoBlinkEnabled(): boolean {
    return this._autoBlinkEnabled;
  }

  private _startBlink(): void {
    this._state = "Closing" as BlinkState;
    this._stateTime = 0;
    this._currentWeight = 0.0;
  }

  private _getNextInterval(): number {
    const range = Math.max(0, this._maxInterval - this._minInterval);
    return this._minInterval + this._randomFn() * range;
  }

  private _applyWeight(weight: number): void {
    if (!this._vrm?.expressionManager) return;
    const clamped = Math.max(0.0, Math.min(1.0, weight));
    for (const name of this._targetExpressions) {
      this._vrm.expressionManager.setValue(name, clamped);
    }
  }
}
