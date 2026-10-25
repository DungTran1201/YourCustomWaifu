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

export function isElectronEnvironment(): boolean {
  return (
    typeof window !== "undefined" &&
    window.desktopAPI !== undefined &&
    typeof window.desktopAPI.getDiagnostics === "function"
  );
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
    stage: {
      getStatus: async () => ({ ...webFallbackStageStatus }),
      getConfig: async () => ({ ...webFallbackAvatarConfig }),
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
      onStatusChanged: () => () => {},
      onConfigChanged: () => () => {},
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
  return createWebFallbackAPI();
}
