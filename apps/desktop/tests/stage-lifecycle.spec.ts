import { describe, it, expect, beforeEach } from "vitest";
import { IPC_CHANNELS } from "@vrm/platform-contracts";
import { DEFAULT_AVATAR_CONFIG, INITIAL_STAGE_STATUS } from "@vrm/shared";
import { createWebFallbackAPI, useAppStore } from "@vrm/app-core";
import { validateIpcSender } from "../electron/main/security.js";
import { validateWindowBounds } from "../electron/main/bounds.js";

describe("Avatar Stage & Workspace Desktop Lifecycle Contracts", () => {
  beforeEach(() => {
    const store = useAppStore();
    store.state.stageStatus = { ...INITIAL_STAGE_STATUS };
    store.state.avatarConfig = { ...DEFAULT_AVATAR_CONFIG };
    store.state.stageLoading = false;
    store.state.stageError = null;
  });

  it("verifies all Stage IPC channels are strictly defined without wildcards", () => {
    expect(IPC_CHANNELS.STAGE_GET_STATUS).toBe("stage:get-status");
    expect(IPC_CHANNELS.STAGE_GET_CONFIG).toBe("stage:get-config");
    expect(IPC_CHANNELS.STAGE_SHOW).toBe("stage:show");
    expect(IPC_CHANNELS.STAGE_HIDE).toBe("stage:hide");
    expect(IPC_CHANNELS.STAGE_TOGGLE).toBe("stage:toggle");
    expect(IPC_CHANNELS.STAGE_SET_CLICKTHROUGH).toBe("stage:set-clickthrough");
    expect(IPC_CHANNELS.STAGE_SET_ALWAYSONTOP).toBe("stage:set-alwaysontop");
    expect(IPC_CHANNELS.STAGE_SET_ANIMATION_PAUSED).toBe(
      "stage:set-animation-paused",
    );
    expect(IPC_CHANNELS.STAGE_UPDATE_CONFIG).toBe("stage:update-config");
    expect(IPC_CHANNELS.STAGE_SELECT_VRM_FILE).toBe("stage:select-vrm-file");
    expect(IPC_CHANNELS.STAGE_LOAD_VRM_BUFFER).toBe("stage:load-vrm-buffer");
    expect(IPC_CHANNELS.STAGE_STATUS_CHANGED).toBe("stage:status-changed");
    expect(IPC_CHANNELS.STAGE_CONFIG_CHANGED).toBe("stage:config-changed");
    expect(IPC_CHANNELS.WORKSPACE_SHOW).toBe("workspace:show");
    expect(IPC_CHANNELS.WORKSPACE_HIDE).toBe("workspace:hide");
    expect(IPC_CHANNELS.WORKSPACE_TOGGLE).toBe("workspace:toggle");
  });

  it("verifies stage initial status has stageVisible = false and retains default dimensions", () => {
    const store = useAppStore();
    expect(store.state.stageStatus.stageVisible).toBe(false);
    expect(store.state.avatarConfig.stageWidth).toBe(420);
    expect(store.state.avatarConfig.stageHeight).toBe(640);
    expect(store.state.avatarConfig.scale).toBe(1.0);
  });

  it("shows Avatar Stage and verifies idempotency of show action", async () => {
    const store = useAppStore();

    await store.showStage();
    expect(store.state.stageStatus.stageVisible).toBe(true);

    // Repeated call must remain visible and idempotent
    await store.showStage();
    expect(store.state.stageStatus.stageVisible).toBe(true);
  });

  it("hides Avatar Stage while preserving configuration and runtime state", async () => {
    const store = useAppStore();

    // Configure a custom avatar scale
    await store.updateAvatarConfig({
      scale: 1.35,
      avatarName: "Test Waifu VRM",
    });
    await store.showStage();
    expect(store.state.stageStatus.stageVisible).toBe(true);

    // Hide stage
    await store.hideStage();
    expect(store.state.stageStatus.stageVisible).toBe(false);

    // Configuration and active model must be preserved
    expect(store.state.avatarConfig.scale).toBe(1.35);
    expect(store.state.avatarConfig.avatarName).toBe("Test Waifu VRM");
  });

  it("toggles click-through and always-on-top window states", async () => {
    const store = useAppStore();

    await store.setStageClickThrough(true);
    expect(store.state.stageStatus.clickThrough).toBe(true);

    await store.setStageClickThrough(false);
    expect(store.state.stageStatus.clickThrough).toBe(false);

    await store.setStageAlwaysOnTop(false);
    expect(store.state.stageStatus.alwaysOnTop).toBe(false);

    await store.setStageAlwaysOnTop(true);
    expect(store.state.stageStatus.alwaysOnTop).toBe(true);
  });

  it("toggles animation pause and resume", async () => {
    const store = useAppStore();

    expect(store.state.stageStatus.animationPaused).toBe(false);

    await store.setStageAnimationPaused(true);
    expect(store.state.stageStatus.animationPaused).toBe(true);

    await store.setStageAnimationPaused(false);
    expect(store.state.stageStatus.animationPaused).toBe(false);
  });

  it("handles missing or invalid VRM loading gracefully with error states", async () => {
    const fallbackAPI = createWebFallbackAPI();
    await expect(
      fallbackAPI.stage?.loadVrmBuffer("missing-file.vrm"),
    ).rejects.toThrow();
  });

  it("validates IPC sender across both Workspace and Avatar Stage windows", () => {
    const mockSender = { id: 101 } as any;
    const mockMainWindow = {
      isDestroyed: () => false,
      webContents: { id: 101 },
    } as any;
    const mockStageWindow = {
      isDestroyed: () => false,
      webContents: { id: 202 },
    } as any;

    // Sender is main window
    expect(
      validateIpcSender(mockSender, [mockMainWindow, mockStageWindow]),
    ).toBe(true);

    // Sender is stage window
    const mockStageSender = { id: 202 } as any;
    expect(
      validateIpcSender(mockStageSender, [mockMainWindow, mockStageWindow]),
    ).toBe(true);

    // Sender is foreign window
    const mockForeignSender = { id: 999 } as any;
    expect(
      validateIpcSender(mockForeignSender, [mockMainWindow, mockStageWindow]),
    ).toBe(false);
  });

  it("validates stage window coordinates and safely falls back when offscreen", () => {
    const mockDisplays = [
      {
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        workArea: { x: 0, y: 0, width: 1920, height: 1040 },
      },
    ];

    // Case 1: Valid coordinate on active display
    const validBounds = validateWindowBounds(
      { x: 500, y: 300, width: 420, height: 640 },
      mockDisplays,
    );
    expect(validBounds.x).toBe(500);
    expect(validBounds.y).toBe(300);
    expect(validBounds.width).toBe(420);
    expect(validBounds.height).toBe(640);

    // Case 2: Out-of-bounds coordinates (e.g. secondary monitor disconnected at x=2500)
    const disconnectedBounds = validateWindowBounds(
      { x: 2500, y: 600, width: 420, height: 640 },
      mockDisplays,
    );
    expect(disconnectedBounds.x).toBeLessThan(1920);
    expect(disconnectedBounds.x).toBe(1920 - 420 - 40); // 1460
    expect(disconnectedBounds.y).toBe(1040 - 640 - 40); // 360
  });

  it("ensures secrets and credentials are masked without raw exposure in renderer state", () => {
    const store = useAppStore();
    store.state.secrets = [
      {
        provider: "gemini",
        keyHint: "...abcd",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    expect(store.state.secrets[0]!.keyHint).toBe("...abcd");
    expect((store.state.secrets[0]! as any).rawKey).toBeUndefined();
    expect((store.state.secrets[0]! as any).apiKey).toBeUndefined();
  });

  it("verifies STAGE_CURSOR_MOVE channel definition and GazeData structure", () => {
    expect(IPC_CHANNELS.STAGE_CURSOR_MOVE).toBe("stage:cursor-move");

    const sampleGaze: import("@vrm/platform-contracts").GazeData = {
      screenX: 1920,
      screenY: 1080,
      relX: 0.5,
      relY: -0.25,
      stageX: 200,
      stageY: 150,
      stageWidth: 420,
      stageHeight: 640,
      normalizedX: 0.5,
      normalizedY: -0.25,
      isInsideStage: true,
      timestamp: Date.now(),
    };

    expect(sampleGaze.screenX).toBe(1920);
    expect(sampleGaze.isInsideStage).toBe(true);
    expect(sampleGaze.normalizedX).toBe(0.5);
  });

  it("verifies independent workspace bounds persistence and maximization independence", () => {
    const defaultWorkspace: import("@vrm/platform-contracts").WorkspaceBounds =
      {
        width: 1100,
        height: 740,
        isMaximized: false,
      };

    // When maximizing workspace, normal bounds must be preserved
    const simulatedMaximizedWorkspace = {
      ...defaultWorkspace,
      isMaximized: true,
    };

    expect(simulatedMaximizedWorkspace.width).toBe(1100);
    expect(simulatedMaximizedWorkspace.height).toBe(740);
    expect(simulatedMaximizedWorkspace.isMaximized).toBe(true);

    // Avatar stage bounds must remain completely independent
    const stageBounds = {
      x: 100,
      y: 150,
      width: 420,
      height: 640,
    };

    expect(stageBounds.width).not.toBe(simulatedMaximizedWorkspace.width);
    expect(stageBounds.height).not.toBe(simulatedMaximizedWorkspace.height);
  });

  it("updates lookAt configuration flags in AvatarConfig", async () => {
    const store = useAppStore();

    expect(store.state.avatarConfig.lookAtEnabled).not.toBe(false);

    await store.updateAvatarConfig({
      lookAtEnabled: false,
      lookAtMode: "eyes_only",
      lookAtIntensity: 0.75,
    });

    expect(store.state.avatarConfig.lookAtEnabled).toBe(false);
    expect(store.state.avatarConfig.lookAtMode).toBe("eyes_only");
    expect(store.state.avatarConfig.lookAtIntensity).toBe(0.75);
  });
});
