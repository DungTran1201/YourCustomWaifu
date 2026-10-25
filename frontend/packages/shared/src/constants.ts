export const APP_METADATA = {
  name: "YourCustomWaifu — Desktop AI Companion",
  shortName: "YourCustomWaifu",
  version: "0.1.0",
  description:
    "Desktop-First Personal AI Companion with Independent Transparent VRM Avatar Stage",
  repositoryUrl: "https://github.com/DungTran1201/YourCustomWaifu",
  author: "Operation Dev",
  license: "MIT",
} as const;

export const DEFAULT_SETTINGS = {
  theme: "dark" as const,
  telemetryEnabled: false,
  logLevel: "info" as const,
};

export const DEFAULT_AVATAR_CONFIG = {
  avatarPath: null as string | null,
  avatarName: "Default Holographic Avatar",
  scale: 1.0,
  stageWidth: 420,
  stageHeight: 640,
  stageX: undefined as number | undefined,
  stageY: undefined as number | undefined,
  alwaysOnTop: true,
  clickThrough: false,
  animationPaused: false,
  showStageOnStartup: false,
  currentAnimation: "idle",
};

export const INITIAL_STAGE_STATUS = {
  stageVisible: false,
  stageReady: false,
  avatarLoaded: false,
  currentAvatarName: null as string | null,
  loading: false,
  error: null as string | null,
  animationPaused: false,
  clickThrough: false,
  alwaysOnTop: true,
};
