export type PlatformType = "web" | "electron";

export type EnvironmentType = "development" | "production" | "test";

export interface PlatformCapabilities {
  desktopIntegration: boolean;
  fileSystemAccess: boolean;
  nativeMenus: boolean;
}

export interface OperatingSystemInfo {
  platform: string;
  arch: string;
  release: string;
}

export interface DiagnosticsInfo {
  platform: PlatformType;
  appVersion: string;
  environment: EnvironmentType;
  timestamp: string;
  capabilities: PlatformCapabilities;
  os?: OperatingSystemInfo;
  guestPreviewEnabled?: boolean;
}

export interface AppSettings {
  theme: "dark" | "light" | "system";
  telemetryEnabled: boolean;
  logLevel: "debug" | "info" | "warn" | "error";
}

export interface UserProfile {
  id: string;
  email: string;
  status: "active" | "suspended" | "deactivated";
  emailVerified: boolean;
  emailStatusNotice: string;
  displayName: string;
  avatarUrl: string | null;
  locale: string;
  timezone: string;
  createdAt: string;
}

export interface UserSession {
  id: string;
  clientType: "web" | "desktop";
  deviceName: string;
  ipSubnet: string;
  isCurrent: boolean;
  lastSeenAt: string;
  createdAt: string;
}

export interface ProviderSecretItem {
  provider: "gemini" | "openai" | "anthropic";
  keyHint: string;
  createdAt: string;
  updatedAt: string;
}

export type AvatarOrientationMode = "auto" | "0deg" | "180deg";

export interface AvatarConfig {
  avatarPath: string | null;
  avatarName: string;
  scale: number;
  stageWidth: number;
  stageHeight: number;
  stageX?: number;
  stageY?: number;
  alwaysOnTop: boolean;
  clickThrough: boolean;
  animationPaused: boolean;
  showStageOnStartup: boolean;
  currentAnimation: string;
  lookAtEnabled?: boolean;
  lookAtMode?: "head_and_eyes" | "eyes_only" | "disabled";
  lookAtIntensity?: number;
  rotationY?: number;
  orientationMode?: AvatarOrientationMode;
  autoBlinkEnabled?: boolean;
  customBlinkExpression?: string;
}

export type BlinkMode =
  | "blink"
  | "bilateral"
  | "blinkLeftOnly"
  | "blinkRightOnly"
  | "custom"
  | "unsupported";

export const BlinkState = {
  Open: "Open",
  Closing: "Closing",
  Closed: "Closed",
  Opening: "Opening",
} as const;
export type BlinkState = (typeof BlinkState)[keyof typeof BlinkState];

export interface BlinkDiagnostic {
  mode: BlinkMode;
  targetExpressions: string[];
  availableExpressions: string[];
  supported: boolean;
  state: BlinkState;
  currentWeight: number;
  autoBlinkEnabled: boolean;
  isPaused: boolean;
  isTestBlinkActive: boolean;
  totalBlinks: number;
}

export interface WorkspaceBounds {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized?: boolean;
}

export interface GazeData {
  screenX: number;
  screenY: number;
  relX: number;
  relY: number;
  stageX: number;
  stageY: number;
  stageWidth: number;
  stageHeight: number;
  normalizedX: number;
  normalizedY: number;
  isInsideStage: boolean;
  timestamp: number;
}

export interface StageStatus {
  stageVisible: boolean;
  stageReady: boolean;
  avatarLoaded: boolean;
  currentAvatarName: string | null;
  vrmVersion?: string | null;
  orientationMode?: AvatarOrientationMode;
  isFallbackActive?: boolean;
  loading: boolean;
  error: string | null;
  animationPaused: boolean;
  clickThrough: boolean;
  alwaysOnTop: boolean;
  blinkDiagnostic?: BlinkDiagnostic;
}

export interface AgentProfile {
  id: string;
  name: string;
  description: string;
  personality: string;
  conversationalStyle: string;
  systemInstructions: string;
  preferredModel: string;
  preferredProvider: "gemini" | "openai" | "anthropic";
  associatedSkillIds: string[];
  associatedRuleIds: string[];
  associatedToolIds: string[];
  behaviorPreferences: {
    proactiveEngagement: boolean;
    memoryRetention: boolean;
    expressiveness: "subtle" | "standard" | "expressive";
  };
}

export interface SkillItem {
  id: string;
  name: string;
  description: string;
  category: string;
  content: string;
  enabled: boolean;
}

export interface RuleItem {
  id: string;
  name: string;
  content: string;
  scope: "global" | "agent";
  applicableAgentId?: string;
  priority: number;
  enabled: boolean;
}

export interface ToolItem {
  id: string;
  name: string;
  description: string;
  category: string;
  permissionLevel: "read-only" | "user-action" | "system";
  requiresConfirmation: boolean;
  enabled: boolean;
  status: "ready" | "needs-config" | "disabled";
}

export interface ModelConnection {
  provider: "gemini" | "openai" | "anthropic";
  displayName: string;
  status: "not_configured" | "configured" | "authenticated" | "ready" | "error";
  selectedModel: string;
  availableModels: string[];
  errorMessage?: string;
}

export interface MemoryItem {
  id: string;
  category: "preference" | "fact" | "habit" | "interaction";
  content: string;
  createdAt: string;
  lastRecalledAt?: string;
  confidence: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  agentId?: string;
  status?: "sending" | "streaming" | "complete" | "error";
}

export interface DesktopAuthAPI {
  login: (credentials: {
    email: string;
    password: string;
    deviceName?: string;
  }) => Promise<{ user: UserProfile }>;
  logout: () => Promise<void>;
  getStoredSession: () => Promise<UserProfile | null>;
}

export interface DesktopStageAPI {
  getStatus: () => Promise<StageStatus>;
  getConfig: () => Promise<AvatarConfig>;
  show: () => Promise<StageStatus>;
  hide: () => Promise<StageStatus>;
  toggle: () => Promise<StageStatus>;
  setClickThrough: (enabled: boolean) => Promise<StageStatus>;
  setAlwaysOnTop: (enabled: boolean) => Promise<StageStatus>;
  setAnimationPaused: (paused: boolean) => Promise<StageStatus>;
  updateConfig: (config: Partial<AvatarConfig>) => Promise<AvatarConfig>;
  selectVrmFile: () => Promise<{
    canceled: boolean;
    filePath?: string;
    fileName?: string;
  }>;
  loadVrmBuffer: (
    filePath?: string,
  ) => Promise<{ data: ArrayBuffer; name: string }>;
  ensureSampleVrm: () => Promise<{
    success: boolean;
    filePath: string;
    fileName: string;
    cached: boolean;
    error?: string;
  }>;
  triggerTestBlink?: () => Promise<{
    success: boolean;
    mode?: string;
    error?: string;
  }>;
  getBlinkDiagnostic?: () => Promise<BlinkDiagnostic | null>;
  reportModelStatus?: (status: {
    avatarLoaded: boolean;
    currentAvatarName?: string;
    vrmVersion?: string;
    orientationMode?: AvatarOrientationMode;
  }) => Promise<void>;
  onTriggerTestBlink?: (callback: () => void) => () => void;
  onStatusChanged?: (callback: (status: StageStatus) => void) => () => void;
  onConfigChanged?: (callback: (config: AvatarConfig) => void) => () => void;
  onCursorMove?: (callback: (data: GazeData) => void) => () => void;
}

export interface DesktopWorkspaceAPI {
  show: (tab?: string) => Promise<void>;
  hide: () => Promise<void>;
  toggle: () => Promise<void>;
}

export interface DesktopAPI {
  getAppVersion: () => Promise<string>;
  getDiagnostics: () => Promise<DiagnosticsInfo>;
  ping: () => Promise<string>;
  isGuestPreviewAvailable?: () => Promise<boolean>;
  auth?: DesktopAuthAPI;
  stage?: DesktopStageAPI;
  workspace?: DesktopWorkspaceAPI;
}

export const IPC_CHANNELS = {
  GET_VERSION: "app:get-version",
  GET_DIAGNOSTICS: "app:get-diagnostics",
  PING: "app:ping",
  GUEST_PREVIEW_AVAILABLE: "app:guest-preview-available",
  AUTH_LOGIN: "app:auth-login",
  AUTH_LOGOUT: "app:auth-logout",
  AUTH_GET_STORED_SESSION: "app:auth-get-stored-session",

  // Stage channels
  STAGE_GET_STATUS: "stage:get-status",
  STAGE_GET_CONFIG: "stage:get-config",
  STAGE_SHOW: "stage:show",
  STAGE_HIDE: "stage:hide",
  STAGE_TOGGLE: "stage:toggle",
  STAGE_SET_CLICKTHROUGH: "stage:set-clickthrough",
  STAGE_SET_ALWAYSONTOP: "stage:set-alwaysontop",
  STAGE_SET_ANIMATION_PAUSED: "stage:set-animation-paused",
  STAGE_UPDATE_CONFIG: "stage:update-config",
  STAGE_SELECT_VRM_FILE: "stage:select-vrm-file",
  STAGE_LOAD_VRM_BUFFER: "stage:load-vrm-buffer",
  STAGE_ENSURE_SAMPLE_VRM: "stage:ensure-sample-vrm",
  STAGE_TRIGGER_TEST_BLINK: "stage:trigger-test-blink",
  STAGE_GET_BLINK_DIAGNOSTIC: "stage:get-blink-diagnostic",
  STAGE_REPORT_MODEL_STATUS: "stage:report-model-status",
  STAGE_STATUS_CHANGED: "stage:status-changed",
  STAGE_CONFIG_CHANGED: "stage:config-changed",
  STAGE_CURSOR_MOVE: "stage:cursor-move",

  // Workspace channels
  WORKSPACE_SHOW: "workspace:show",
  WORKSPACE_HIDE: "workspace:hide",
  WORKSPACE_TOGGLE: "workspace:toggle",
} as const;

export type IPCChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

declare global {
  interface Window {
    desktopAPI?: DesktopAPI;
  }
}
