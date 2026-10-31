import type {
  DesktopAPI,
  DiagnosticsInfo,
  PlatformType,
  AvatarConfig,
  StageStatus,
} from "@vrm/platform-contracts";
import {
  APP_METADATA,
  DEFAULT_AVATAR_CONFIG,
  INITIAL_STAGE_STATUS,
} from "@vrm/shared";

export function isRunningInElectron(): boolean {
  if (typeof window === "undefined") return false;
  return (
    typeof (window as any).desktopAPI?.getDiagnostics === "function" ||
    (typeof navigator !== "undefined" &&
      navigator.userAgent.includes("Electron")) ||
    typeof (process as any)?.versions?.electron !== "undefined"
  );
}

export function isElectronEnvironment(): boolean {
  return (
    typeof window !== "undefined" &&
    window.desktopAPI !== undefined &&
    typeof window.desktopAPI.getDiagnostics === "function"
  );
}

export function hasPreloadBridgeError(): boolean {
  return isRunningInElectron() && !isElectronEnvironment();
}

export function detectPlatform(): PlatformType {
  return isElectronEnvironment() ? "electron" : "web";
}

let webFallbackAvatarConfig: AvatarConfig = { ...DEFAULT_AVATAR_CONFIG };
let webFallbackStageStatus: StageStatus = {
  ...INITIAL_STAGE_STATUS,
  error:
    "Avatar Stage runs as an independent desktop window in the Electron Desktop App",
};

export function createWebFallbackAPI(): DesktopAPI {
  return {
    getAppVersion: async () => APP_METADATA.version,
    getDiagnostics: async (): Promise<DiagnosticsInfo> => {
      const isBrowser = typeof window !== "undefined";
      return {
        platform: "web",
        appVersion: APP_METADATA.version,
        environment:
          process.env.NODE_ENV === "production" ? "production" : "development",
        timestamp: new Date().toISOString(),
        capabilities: {
          desktopIntegration: false,
          fileSystemAccess: false,
          nativeMenus: false,
        },
        os: isBrowser
          ? {
              platform: navigator.platform || "web-browser",
              arch: "unknown",
              release: navigator.userAgent,
            }
          : undefined,
      };
    },
    ping: async () => "pong:web-fallback",
    isGuestPreviewAvailable: async () => false,
    stage: {
      getStatus: async () => ({ ...webFallbackStageStatus }),
      getConfig: async () => ({ ...webFallbackAvatarConfig }),
      getBounds: async () => ({
        x: webFallbackAvatarConfig.stageX ?? 100,
        y: webFallbackAvatarConfig.stageY ?? 100,
        width: webFallbackAvatarConfig.stageWidth || 420,
        height: webFallbackAvatarConfig.stageHeight || 640,
      }),
      setBounds: async (bounds) => {
        if (bounds.x !== undefined) webFallbackAvatarConfig.stageX = bounds.x;
        if (bounds.y !== undefined) webFallbackAvatarConfig.stageY = bounds.y;
        if (bounds.width !== undefined)
          webFallbackAvatarConfig.stageWidth = bounds.width;
        if (bounds.height !== undefined)
          webFallbackAvatarConfig.stageHeight = bounds.height;
        return {
          x: webFallbackAvatarConfig.stageX ?? 100,
          y: webFallbackAvatarConfig.stageY ?? 100,
          width: webFallbackAvatarConfig.stageWidth || 420,
          height: webFallbackAvatarConfig.stageHeight || 640,
        };
      },
      show: async () => {
        webFallbackStageStatus.stageVisible = true;
        return { ...webFallbackStageStatus };
      },
      hide: async () => {
        webFallbackStageStatus.stageVisible = false;
        return { ...webFallbackStageStatus };
      },
      toggle: async () => {
        webFallbackStageStatus.stageVisible =
          !webFallbackStageStatus.stageVisible;
        return { ...webFallbackStageStatus };
      },
      setClickThrough: async (val: boolean) => {
        webFallbackStageStatus.clickThrough = val;
        return { ...webFallbackStageStatus };
      },
      setAlwaysOnTop: async (val: boolean) => {
        webFallbackStageStatus.alwaysOnTop = val;
        return { ...webFallbackStageStatus };
      },
      setAnimationPaused: async (val: boolean) => {
        webFallbackStageStatus.animationPaused = val;
        return { ...webFallbackStageStatus };
      },
      updateConfig: async (partial) => {
        Object.assign(webFallbackAvatarConfig, partial);
        return { ...webFallbackAvatarConfig };
      },
      selectVrmFile: async () => ({ canceled: true }),
      loadVrmBuffer: async () => {
        throw new Error(
          "Local file system direct loading requires Desktop Electron application",
        );
      },
      ensureSampleVrm: async () => ({
        success: false,
        filePath: "",
        fileName: "AvatarSample_B.vrm",
        cached: false,
        error: "Sample VRM download requires native desktop environment",
      }),
      setIgnoreMouseEvents: async () => {},
      getBlinkDiagnostic: async () => null,
      onStatusChanged: () => () => {},
      onConfigChanged: () => () => {},
      onCursorMove: () => () => {},
    },
    workspace: {
      show: async () => {},
      hide: async () => {},
      toggle: async () => {},
    },
  };
}

export function getPlatformAPI(): DesktopAPI {
  if (isElectronEnvironment() && window.desktopAPI) {
    return window.desktopAPI;
  }
  if (hasPreloadBridgeError()) {
    throw new Error(
      "Desktop IPC Preload Bridge missing or failed to initialize in native Electron environment.",
    );
  }
  return createWebFallbackAPI();
}
