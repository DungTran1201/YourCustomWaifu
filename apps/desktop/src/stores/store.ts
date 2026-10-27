import { reactive, computed } from "vue";
import type {
  AppSettings,
  DiagnosticsInfo,
  PlatformType,
  UserProfile,
  UserSession,
  ProviderSecretItem,
  AvatarConfig,
  StageStatus,
  AgentProfile,
  SkillItem,
  RuleItem,
  ToolItem,
  ModelConnection,
  MemoryItem,
  ChatMessage,
  WindowBounds,
} from "@vrm/platform-contracts";
import {
  DEFAULT_SETTINGS,
  DEFAULT_AVATAR_CONFIG,
  INITIAL_STAGE_STATUS,
} from "@vrm/shared";
import {
  detectPlatform,
  getPlatformAPI,
  isElectronEnvironment,
  hasPreloadBridgeError,
} from "./platform.js";

export type NavigationTab =
  | "chat"
  | "agents"
  | "skills"
  | "rules"
  | "tools"
  | "connections"
  | "memory"
  | "avatar"
  | "activity"
  | "profile"
  | "security"
  | "secrets"
  | "settings"
  | "diagnostics"
  | "signin"
  | "signup"
  | "forgot-password"
  | "reset-password";

export interface AppState {
  currentTab: NavigationTab;
  settings: AppSettings;
  diagnostics: DiagnosticsInfo | null;
  isLoading: boolean;
  errorMessage: string | null;
  pingResult: string | null;
  // Auth state
  user: UserProfile | null;
  isAuthenticated: boolean;
  authLoading: boolean;
  authError: string | null;
  authNotice: string | null;
  sessions: UserSession[];
  secrets: ProviderSecretItem[];
  csrfToken: string | null;
  resetToken: string | null;
  // Avatar Stage state
  stageStatus: StageStatus;
  avatarConfig: AvatarConfig;
  stageLoading: boolean;
  stageError: string | null;
  // Companion & Chat state
  agents: AgentProfile[];
  activeAgentId: string;
  skills: SkillItem[];
  rules: RuleItem[];
  tools: ToolItem[];
  modelConnections: ModelConnection[];
  memories: MemoryItem[];
  messages: ChatMessage[];
  chatInput: string;
  chatSending: boolean;
  chatError: string | null;
  // UI Layout state
  sidebarCollapsed: boolean;
  // Guest Preview state
  isGuest: boolean;
  isGuestPreviewAvailable: boolean;
}

const state = reactive<AppState>({
  currentTab: "signin",
  sidebarCollapsed: false,
  settings: { ...DEFAULT_SETTINGS },
  diagnostics: null,
  isLoading: false,
  errorMessage: null,
  pingResult: null,
  user: null,
  isAuthenticated: false,
  authLoading: false,
  authError: null,
  authNotice: null,
  sessions: [],
  secrets: [],
  csrfToken: null,
  resetToken: null,
  // Stage initial state
  stageStatus: { ...INITIAL_STAGE_STATUS },
  avatarConfig: { ...DEFAULT_AVATAR_CONFIG },
  stageLoading: false,
  stageError: null,
  // Guest Preview initial state
  isGuest: false,
  isGuestPreviewAvailable: false,
  // Companion default profiles
  agents: [
    {
      id: "agent_aiko",
      name: "Aiko",
      description:
        "Personal desktop AI companion and attentive daily assistant",
      personality: "Warm, perceptive, supportive, and subtly playful",
      conversationalStyle: "Natural, direct, caring, and engaging",
      systemInstructions:
        "You are Aiko, the user's dedicated personal companion on their desktop workspace. Respond thoughtfully, remember past context, respect the user's focus, and help with their daily tasks and creative projects.",
      preferredModel: "gemini-2.5-flash",
      preferredProvider: "gemini",
      associatedSkillIds: ["skill_daily_briefing", "skill_proactive_checkin"],
      associatedRuleIds: ["rule_concise", "rule_privacy"],
      associatedToolIds: ["tool_stage_expression", "tool_memory_recall"],
      behaviorPreferences: {
        proactiveEngagement: true,
        memoryRetention: true,
        expressiveness: "standard",
      },
    },
  ],
  activeAgentId: "agent_aiko",
  skills: [
    {
      id: "skill_daily_briefing",
      name: "Daily Briefing",
      category: "Routines",
      description: "Provides a concise morning overview and task summary",
      content: "Check scheduled reminders, weather, and open objectives",
      enabled: true,
    },
    {
      id: "skill_proactive_checkin",
      name: "Attentive Check-in",
      category: "Wellbeing",
      description: "Gently inquires after periods of intense focus",
      content:
        "Offer water/break reminders after 90 minutes of continuous desktop activity",
      enabled: true,
    },
    {
      id: "skill_context_summarizer",
      name: "Context Distillation",
      category: "Cognition",
      description: "Condenses lengthy conversations into core memories",
      content: "Extract key user preferences and save to memory store",
      enabled: true,
    },
  ],
  rules: [
    {
      id: "rule_concise",
      name: "Restrained & Crisp Replies",
      content:
        "Provide direct, high-value responses without unnecessary filler",
      scope: "agent",
      applicableAgentId: "agent_aiko",
      priority: 1,
      enabled: true,
    },
    {
      id: "rule_privacy",
      name: "Local Data Primacy",
      content:
        "Never transmit user memories or personal identifiers to unconfigured third parties",
      scope: "global",
      priority: 2,
      enabled: true,
    },
    {
      id: "rule_stage_sync",
      name: "Stage Visibility Harmony",
      content:
        "When stage is minimized or user is in focus mode, avoid distracting avatar animations",
      scope: "global",
      priority: 3,
      enabled: true,
    },
  ],
  tools: [
    {
      id: "tool_stage_expression",
      name: "Avatar Expression Engine",
      category: "Presentation",
      description:
        "Triggers facial expressions and subtle animations on Avatar Stage",
      permissionLevel: "user-action",
      requiresConfirmation: false,
      enabled: true,
      status: "ready",
    },
    {
      id: "tool_memory_recall",
      name: "Associative Memory Recall",
      category: "Context",
      description: "Queries stored long-term preferences and facts",
      permissionLevel: "read-only",
      requiresConfirmation: false,
      enabled: true,
      status: "ready",
    },
    {
      id: "tool_system_diagnostics",
      name: "Environment Diagnostics",
      category: "System",
      description:
        "Inspects desktop OS platform, runtime version, and memory usage",
      permissionLevel: "read-only",
      requiresConfirmation: false,
      enabled: true,
      status: "ready",
    },
  ],
  modelConnections: [
    {
      provider: "gemini",
      displayName: "Google Gemini",
      status: "not_configured",
      selectedModel: "gemini-2.5-flash",
      availableModels: [
        "gemini-2.5-flash",
        "gemini-2.5-pro",
        "gemini-2.0-flash",
      ],
    },
    {
      provider: "openai",
      displayName: "OpenAI GPT",
      status: "not_configured",
      selectedModel: "gpt-4o",
      availableModels: ["gpt-4o", "gpt-4o-mini"],
    },
    {
      provider: "anthropic",
      displayName: "Anthropic Claude",
      status: "not_configured",
      selectedModel: "claude-3-5-sonnet",
      availableModels: ["claude-3-5-sonnet", "claude-3-5-haiku"],
    },
  ],
  memories: [
    {
      id: "mem_1",
      category: "preference",
      content:
        "Prefers dark, refined desktop aesthetics without bright neon overload",
      createdAt: new Date().toISOString(),
      confidence: 0.98,
    },
    {
      id: "mem_2",
      category: "fact",
      content: "Developing TypeScript and Vue 3 desktop architectures",
      createdAt: new Date().toISOString(),
      confidence: 0.94,
    },
  ],
  messages: [
    {
      id: "msg_welcome",
      role: "assistant",
      content:
        "Hello! I'm Aiko, your personal AI companion. Your desktop workspace and independent Avatar Stage are ready. How can I assist you today?",
      timestamp: new Date().toISOString(),
      status: "complete",
    },
  ],
  chatInput: "",
  chatSending: false,
  chatError: null,
});

function getApiBaseUrl(): string {
  if (typeof window !== "undefined" && (window as any).VITE_API_BASE_URL) {
    return (window as any).VITE_API_BASE_URL;
  }
  return "http://127.0.0.1:3000";
}

async function apiRequest(
  path: string,
  options: RequestInit = {},
): Promise<any> {
  const baseUrl = getApiBaseUrl();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  if (state.csrfToken) {
    headers["X-CSRF-Token"] = state.csrfToken;
  }

  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  const csrfHeader = res.headers.get("x-csrf-token");
  if (csrfHeader) {
    state.csrfToken = csrfHeader;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `Request failed with status ${res.status}`);
  }
  return data;
}

export function useAppStore() {
  const platform = computed<PlatformType>(() => detectPlatform());
  const hasBridgeError = computed<boolean>(() => hasPreloadBridgeError());

  function setTab(tab: NavigationTab) {
    state.currentTab = tab;
    state.authError = null;
    state.authNotice = null;
  }

  function updateSettings(partial: Partial<AppSettings>) {
    Object.assign(state.settings, partial);
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", state.settings.theme);
    }
  }

  async function loadDiagnostics() {
    state.isLoading = true;
    state.errorMessage = null;
    try {
      const api = getPlatformAPI();
      state.diagnostics = await api.getDiagnostics();
    } catch (err: unknown) {
      state.errorMessage =
        err instanceof Error ? err.message : "Failed to fetch diagnostics";
    } finally {
      state.isLoading = false;
    }
  }

  async function executePing(): Promise<string> {
    try {
      const api = getPlatformAPI();
      const res = await api.ping();
      state.pingResult = res;
      return res;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Ping failed";
      state.pingResult = `Error: ${msg}`;
      return state.pingResult;
    }
  }

  async function initAuth() {
    state.authLoading = true;
    try {
      if (
        isElectronEnvironment() &&
        window.desktopAPI?.auth?.getStoredSession
      ) {
        const stored = await window.desktopAPI.auth.getStoredSession();
        if (stored) {
          state.user = stored;
          state.isAuthenticated = true;
          state.currentTab = "chat";
          return;
        }
      }

      // Web cookie check
      const profile = await apiRequest("/api/v1/users/me");
      if (profile && profile.id) {
        state.user = profile;
        state.isAuthenticated = true;
        state.currentTab = "chat";
        fetchCompanionData().catch(() => {});
      } else {
        state.user = null;
        state.isAuthenticated = false;
        if (
          !state.isGuest &&
          state.currentTab !== "signup" &&
          state.currentTab !== "forgot-password" &&
          state.currentTab !== "reset-password" &&
          state.currentTab !== "settings" &&
          state.currentTab !== "diagnostics"
        ) {
          state.currentTab = "signin";
        }
      }
    } catch {
      state.user = null;
      state.isAuthenticated = false;
      if (
        !state.isGuest &&
        state.currentTab !== "signup" &&
        state.currentTab !== "forgot-password" &&
        state.currentTab !== "reset-password" &&
        state.currentTab !== "settings" &&
        state.currentTab !== "diagnostics"
      ) {
        state.currentTab = "signin";
      }
    } finally {
      state.authLoading = false;
      await checkGuestPreviewAvailable();
    }
  }

  async function login(emailRaw: string, passwordRaw: string) {
    state.authLoading = true;
    state.authError = null;
    state.authNotice = null;
    try {
      if (isElectronEnvironment() && window.desktopAPI?.auth?.login) {
        const res = await window.desktopAPI.auth.login({
          email: emailRaw,
          password: passwordRaw,
        });
        state.user = res.user;
        state.isAuthenticated = true;
        setTab("chat");
        fetchCompanionData().catch(() => {});
        return;
      }

      const res = await apiRequest("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: emailRaw, password: passwordRaw }),
      });
      state.user = res.user;
      state.isAuthenticated = true;
      if (res.csrfToken) state.csrfToken = res.csrfToken;
      setTab("chat");
      fetchCompanionData().catch(() => {});
    } catch (err: any) {
      state.authError = err?.message || "Invalid email or password";
      throw err;
    } finally {
      state.authLoading = false;
    }
  }

  async function register(
    emailRaw: string,
    passwordRaw: string,
    displayNameRaw?: string,
  ) {
    state.authLoading = true;
    state.authError = null;
    state.authNotice = null;
    try {
      const res = await apiRequest("/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: emailRaw,
          password: passwordRaw,
          displayName: displayNameRaw,
        }),
      });
      state.user = res.user;
      state.isAuthenticated = true;
      if (res.csrfToken) state.csrfToken = res.csrfToken;
      setTab("chat");
      fetchCompanionData().catch(() => {});
    } catch (err: any) {
      state.authError = err?.message || "Registration failed";
      throw err;
    } finally {
      state.authLoading = false;
    }
  }

  async function logout() {
    state.authLoading = true;
    try {
      if (isElectronEnvironment() && window.desktopAPI?.auth?.logout) {
        await window.desktopAPI.auth.logout();
      }
      await apiRequest("/api/v1/auth/logout", { method: "POST" }).catch(
        () => {},
      );
    } finally {
      state.user = null;
      state.isAuthenticated = false;
      state.sessions = [];
      state.secrets = [];
      state.authLoading = false;
      setTab("signin");
    }
  }

  async function logoutAll() {
    state.authLoading = true;
    try {
      if (isElectronEnvironment() && window.desktopAPI?.auth?.logout) {
        await window.desktopAPI.auth.logout();
      }
      await apiRequest("/api/v1/auth/logout-all", { method: "POST" }).catch(
        () => {},
      );
    } finally {
      state.user = null;
      state.isAuthenticated = false;
      state.sessions = [];
      state.secrets = [];
      state.authLoading = false;
      setTab("signin");
    }
  }

  async function fetchProfile() {
    try {
      const profile = await apiRequest("/api/v1/users/me");
      state.user = profile;
    } catch (err: any) {
      state.authError = err.message;
    }
  }

  async function updateProfile(partial: {
    displayName?: string;
    timezone?: string;
    locale?: string;
  }) {
    state.authLoading = true;
    state.authError = null;
    try {
      const updated = await apiRequest("/api/v1/users/me", {
        method: "PATCH",
        body: JSON.stringify(partial),
      });
      state.user = updated;
      state.authNotice = "Profile updated successfully";
    } catch (err: any) {
      state.authError = err.message;
      throw err;
    } finally {
      state.authLoading = false;
    }
  }

  async function changePassword(
    currentPassword: string,
    newPassword: string,
    revokeOthers: boolean = true,
  ) {
    state.authLoading = true;
    state.authError = null;
    try {
      await apiRequest("/api/v1/users/me/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword,
          newPassword,
          revokeOtherSessions: revokeOthers,
        }),
      });
      state.authNotice = "Password changed successfully";
    } catch (err: any) {
      state.authError = err.message;
      throw err;
    } finally {
      state.authLoading = false;
    }
  }

  async function fetchSessions() {
    try {
      const res = await apiRequest("/api/v1/users/me/sessions");
      state.sessions = res.sessions || [];
    } catch (err: any) {
      state.authError = err.message;
    }
  }

  async function revokeSession(sessionId: string) {
    try {
      await apiRequest(`/api/v1/users/me/sessions/${sessionId}`, {
        method: "DELETE",
      });
      await fetchSessions();
    } catch (err: any) {
      state.authError = err.message;
    }
  }

  async function forgotPassword(email: string): Promise<string> {
    state.authLoading = true;
    state.authError = null;
    try {
      const res = await apiRequest("/api/v1/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      state.authNotice = res.message;
      return res.message;
    } catch (err: any) {
      state.authError = err.message;
      throw err;
    } finally {
      state.authLoading = false;
    }
  }

  async function resetPassword(token: string, newPassword: string) {
    state.authLoading = true;
    state.authError = null;
    try {
      const res = await apiRequest("/api/v1/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword }),
      });
      state.authNotice = res.message;
      setTab("signin");
    } catch (err: any) {
      state.authError = err.message;
      throw err;
    } finally {
      state.authLoading = false;
    }
  }

  async function fetchSecrets() {
    try {
      const res = await apiRequest("/api/v1/users/me/secrets");
      state.secrets = res.secrets || [];
    } catch (err: any) {
      state.authError = err.message;
    }
  }

  async function saveSecret(
    provider: "gemini" | "openai" | "anthropic",
    apiKey: string,
  ) {
    state.authLoading = true;
    state.authError = null;
    try {
      await apiRequest("/api/v1/users/me/secrets", {
        method: "POST",
        body: JSON.stringify({ provider, apiKey }),
      });
      await fetchSecrets();
      state.authNotice = "API key securely stored";
    } catch (err: any) {
      state.authError = err.message;
      throw err;
    } finally {
      state.authLoading = false;
    }
  }

  async function deleteSecret(provider: string) {
    try {
      await apiRequest(`/api/v1/users/me/secrets/${provider}`, {
        method: "DELETE",
      });
      await fetchSecrets();
    } catch (err: any) {
      state.authError = err.message;
    }
  }

  // --- Avatar Stage & Synchronization Actions ---
  async function initStageSync() {
    try {
      const api = getPlatformAPI();
      if (api.stage) {
        state.stageStatus = await api.stage.getStatus();
        state.avatarConfig = await api.stage.getConfig();

        if (typeof api.stage.onStatusChanged === "function") {
          api.stage.onStatusChanged((status) => {
            Object.assign(state.stageStatus, status);
          });
        }

        if (typeof api.stage.onConfigChanged === "function") {
          api.stage.onConfigChanged((cfg) => {
            Object.assign(state.avatarConfig, cfg);
          });
        }
      }
    } catch (err: any) {
      state.stageError =
        err.message || "Failed to initialize stage synchronization";
    }
  }

  async function showStage() {
    state.stageLoading = true;
    state.stageError = null;
    try {
      const api = getPlatformAPI();
      if (api.stage) {
        const res = await api.stage.show();
        Object.assign(state.stageStatus, res);
      }
    } catch (err: any) {
      state.stageError = err.message;
    } finally {
      state.stageLoading = false;
    }
  }

  async function hideStage() {
    state.stageLoading = true;
    state.stageError = null;
    try {
      const api = getPlatformAPI();
      if (api.stage) {
        const res = await api.stage.hide();
        Object.assign(state.stageStatus, res);
      }
    } catch (err: any) {
      state.stageError = err.message;
    } finally {
      state.stageLoading = false;
    }
  }

  async function toggleStage() {
    if (state.stageStatus.stageVisible) {
      await hideStage();
    } else {
      await showStage();
    }
  }

  async function setStageClickThrough(enabled: boolean) {
    try {
      const api = getPlatformAPI();
      if (api.stage) {
        const res = await api.stage.setClickThrough(enabled);
        Object.assign(state.stageStatus, res);
      }
    } catch (err: any) {
      state.stageError = err.message;
    }
  }

  async function setStageAlwaysOnTop(enabled: boolean) {
    try {
      const api = getPlatformAPI();
      if (api.stage) {
        const res = await api.stage.setAlwaysOnTop(enabled);
        Object.assign(state.stageStatus, res);
      }
    } catch (err: any) {
      state.stageError = err.message;
    }
  }

  async function setStageAnimationPaused(paused: boolean) {
    try {
      const api = getPlatformAPI();
      if (api.stage) {
        const res = await api.stage.setAnimationPaused(paused);
        Object.assign(state.stageStatus, res);
      }
    } catch (err: any) {
      state.stageError = err.message;
    }
  }

  async function getStageBounds(): Promise<WindowBounds> {
    const api = getPlatformAPI();
    return (
      (await api.stage?.getBounds?.()) || {
        x: state.avatarConfig.stageX ?? 100,
        y: state.avatarConfig.stageY ?? 100,
        width: state.avatarConfig.stageWidth || 420,
        height: state.avatarConfig.stageHeight || 640,
      }
    );
  }

  async function setStageBounds(
    bounds: Partial<WindowBounds>,
  ): Promise<WindowBounds> {
    const api = getPlatformAPI();
    const result = (await api.stage?.setBounds?.(bounds)) || {
      x: bounds.x ?? state.avatarConfig.stageX ?? 100,
      y: bounds.y ?? state.avatarConfig.stageY ?? 100,
      width: bounds.width ?? state.avatarConfig.stageWidth ?? 420,
      height: bounds.height ?? state.avatarConfig.stageHeight ?? 640,
    };
    if (result.width) state.avatarConfig.stageWidth = result.width;
    if (result.height) state.avatarConfig.stageHeight = result.height;
    if (result.x !== undefined) state.avatarConfig.stageX = result.x;
    if (result.y !== undefined) state.avatarConfig.stageY = result.y;
    return result;
  }

  async function updateAvatarConfig(partial: Partial<AvatarConfig>) {
    try {
      const api = getPlatformAPI();
      if (api.stage) {
        const updated = await api.stage.updateConfig(partial);
        Object.assign(state.avatarConfig, updated);
      } else {
        Object.assign(state.avatarConfig, partial);
      }
    } catch (err: any) {
      state.stageError = err.message;
    }
  }

  async function selectVrmFile(): Promise<string | null> {
    try {
      const api = getPlatformAPI();
      if (api.stage) {
        const res = await api.stage.selectVrmFile();
        if (!res.canceled && res.filePath) {
          await updateAvatarConfig({
            avatarPath: res.filePath,
            avatarName: res.fileName || "Custom Avatar",
          });
          return res.filePath;
        }
      }
      return null;
    } catch (err: any) {
      state.stageError = err.message;
      return null;
    }
  }

  async function loadSampleVrm(): Promise<{
    success: boolean;
    filePath?: string;
    error?: string;
  }> {
    state.stageLoading = true;
    state.stageError = null;
    try {
      const api = getPlatformAPI();
      if (!api.stage?.ensureSampleVrm) {
        throw new Error("Sample VRM downloader unavailable");
      }
      const res = await api.stage.ensureSampleVrm();
      if (!res.success || !res.filePath) {
        throw new Error(res.error || "Failed to download sample VRM");
      }

      if (state.isGuest) {
        state.avatarConfig.avatarPath = res.filePath;
        state.avatarConfig.avatarName = res.fileName || "AvatarSample_B.vrm";
        state.stageStatus.avatarLoaded = true;
        state.stageStatus.currentAvatarName =
          res.fileName || "AvatarSample_B.vrm";
        if (api.stage.updateConfig) {
          await api.stage.updateConfig({
            avatarPath: res.filePath,
            avatarName: res.fileName,
          });
        }
      } else {
        await updateAvatarConfig({
          avatarPath: res.filePath,
          avatarName: res.fileName || "AvatarSample_B.vrm",
        });
      }
      return { success: true, filePath: res.filePath };
    } catch (err: any) {
      const errMsg = err?.message || "Failed to load sample VRM";
      state.stageError = errMsg;
      return { success: false, error: errMsg };
    } finally {
      state.stageLoading = false;
    }
  }

  async function checkGuestPreviewAvailable(): Promise<boolean> {
    try {
      const api = getPlatformAPI();
      if (typeof api.isGuestPreviewAvailable === "function") {
        const available = await api.isGuestPreviewAvailable();
        state.isGuestPreviewAvailable = !!available;
        return state.isGuestPreviewAvailable;
      }
      state.isGuestPreviewAvailable = false;
      return false;
    } catch {
      state.isGuestPreviewAvailable = false;
      return false;
    }
  }

  async function enterGuestPreview() {
    state.isGuest = true;
    state.isAuthenticated = false;
    state.user = null;
    setTab("avatar");
    await showStage();
    if (!state.avatarConfig.avatarPath) {
      await loadSampleVrm();
    }
  }

  function exitGuestPreview() {
    state.isGuest = false;
    setTab("signin");
  }

  // --- Companion Data Sync ---
  async function fetchCompanionData() {
    if (!state.isAuthenticated) return;
    try {
      await fetchSecrets();

      const [
        agentsRes,
        skillsRes,
        rulesRes,
        toolsRes,
        connsRes,
        memsRes,
        msgsRes,
      ] = await Promise.all([
        apiRequest("/api/v1/agents").catch(() => null),
        apiRequest("/api/v1/skills").catch(() => null),
        apiRequest("/api/v1/rules").catch(() => null),
        apiRequest("/api/v1/tools").catch(() => null),
        apiRequest("/api/v1/providers/settings").catch(() => null),
        apiRequest("/api/v1/memories").catch(() => null),
        apiRequest("/api/v1/chat/messages").catch(() => null),
      ]);

      if (agentsRes?.agents && agentsRes.agents.length > 0) {
        state.agents = agentsRes.agents;
        if (agentsRes.activeAgentId) {
          state.activeAgentId = agentsRes.activeAgentId;
        }
      }
      if (skillsRes?.skills && skillsRes.skills.length > 0) {
        state.skills = skillsRes.skills;
      }
      if (rulesRes?.rules && rulesRes.rules.length > 0) {
        state.rules = rulesRes.rules;
      }
      if (toolsRes?.tools && toolsRes.tools.length > 0) {
        state.tools = toolsRes.tools;
      }
      if (connsRes?.connections && connsRes.connections.length > 0) {
        state.modelConnections = connsRes.connections;
      }
      if (memsRes?.memories) {
        state.memories = memsRes.memories;
      }
      if (msgsRes?.messages && msgsRes.messages.length > 0) {
        state.messages = msgsRes.messages;
      }
    } catch {
      // Non-blocking fallback
    }
  }

  // --- Real Chat & Companion Runtime Actions ---
  async function sendChatMessage(customContent?: string) {
    const content = (customContent || state.chatInput || "").trim();
    if (!content || state.chatSending) return;

    state.chatInput = "";
    state.chatSending = true;
    state.chatError = null;

    const userMsg: ChatMessage = {
      id: `msg_u_${Date.now()}`,
      role: "user",
      content,
      timestamp: new Date().toISOString(),
      status: "complete",
    };
    state.messages.push(userMsg);

    try {
      const res = await apiRequest("/api/v1/chat/completions", {
        method: "POST",
        body: JSON.stringify({
          message: content,
          agentId: state.activeAgentId,
        }),
      });

      if (res?.message) {
        state.messages.push(res.message);
      }
    } catch (err: any) {
      state.chatError = err.message || "Failed to generate response";
      const errorMsg: ChatMessage = {
        id: `msg_err_${Date.now()}`,
        role: "assistant",
        content: `[Error: ${state.chatError}]`,
        timestamp: new Date().toISOString(),
        status: "error",
      };
      state.messages.push(errorMsg);
    } finally {
      state.chatSending = false;
    }
  }

  async function clearChatMessages() {
    try {
      await apiRequest("/api/v1/chat/clear", { method: "POST", body: "{}" });
    } catch {
      // fallback
    }
    state.messages = [
      {
        id: `msg_welcome_${Date.now()}`,
        role: "assistant",
        content:
          "Conversation history cleared. I'm ready for new instructions or questions!",
        timestamp: new Date().toISOString(),
        status: "complete",
      },
    ];
  }

  // --- Agent & Personalization Actions ---
  async function updateAgent(agentId: string, partial: Partial<AgentProfile>) {
    const target = state.agents.find((a) => a.id === agentId);
    if (target) {
      Object.assign(target, partial);
    }
    try {
      await apiRequest(`/api/v1/agents/${agentId}`, {
        method: "PATCH",
        body: JSON.stringify(partial),
      });
    } catch {
      // offline or mock fallback
    }
  }

  async function setActiveAgent(agentId: string) {
    state.activeAgentId = agentId;
    try {
      await apiRequest(`/api/v1/agents/${agentId}/active`, {
        method: "POST",
        body: "{}",
      });
    } catch {
      // fallback
    }
  }

  // --- Skills Actions ---
  async function addSkill(skill: Omit<SkillItem, "id">) {
    const newSkill: SkillItem = {
      ...skill,
      id: `skill_${Date.now()}`,
    };
    state.skills.push(newSkill);
    try {
      const res = await apiRequest("/api/v1/skills", {
        method: "POST",
        body: JSON.stringify(skill),
      });
      if (res?.id) newSkill.id = res.id;
    } catch {
      // fallback
    }
  }

  async function updateSkill(id: string, partial: Partial<SkillItem>) {
    const item = state.skills.find((s) => s.id === id);
    if (item) Object.assign(item, partial);
    try {
      await apiRequest(`/api/v1/skills/${id}`, {
        method: "PATCH",
        body: JSON.stringify(partial),
      });
    } catch {
      // fallback
    }
  }

  async function deleteSkill(id: string) {
    state.skills = state.skills.filter((s) => s.id !== id);
    try {
      await apiRequest(`/api/v1/skills/${id}`, { method: "DELETE" });
    } catch {
      // fallback
    }
  }

  // --- Rules Actions ---
  async function addRule(rule: Omit<RuleItem, "id">) {
    const newRule: RuleItem = {
      ...rule,
      id: `rule_${Date.now()}`,
    };
    state.rules.push(newRule);
    try {
      const res = await apiRequest("/api/v1/rules", {
        method: "POST",
        body: JSON.stringify(rule),
      });
      if (res?.id) newRule.id = res.id;
    } catch {
      // fallback
    }
  }

  async function updateRule(id: string, partial: Partial<RuleItem>) {
    const item = state.rules.find((r) => r.id === id);
    if (item) Object.assign(item, partial);
    try {
      await apiRequest(`/api/v1/rules/${id}`, {
        method: "PATCH",
        body: JSON.stringify(partial),
      });
    } catch {
      // fallback
    }
  }

  async function deleteRule(id: string) {
    state.rules = state.rules.filter((r) => r.id !== id);
    try {
      await apiRequest(`/api/v1/rules/${id}`, { method: "DELETE" });
    } catch {
      // fallback
    }
  }

  // --- Tools Actions ---
  async function toggleTool(id: string) {
    const tool = state.tools.find((t) => t.id === id);
    if (tool) {
      tool.enabled = !tool.enabled;
      try {
        await apiRequest(`/api/v1/tools/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ enabled: tool.enabled }),
        });
      } catch {
        // fallback
      }
    }
  }

  async function updateTool(id: string, partial: Partial<ToolItem>) {
    const tool = state.tools.find((t) => t.id === id);
    if (tool) Object.assign(tool, partial);
    try {
      await apiRequest(`/api/v1/tools/${id}`, {
        method: "PATCH",
        body: JSON.stringify(partial),
      });
    } catch {
      // fallback
    }
  }

  // --- Real Model Connections Actions ---
  async function testConnection(provider: "gemini" | "openai" | "anthropic") {
    const conn = state.modelConnections.find((c) => c.provider === provider);
    if (!conn) return;

    const secret = state.secrets.find((s) => s.provider === provider);
    if (!secret) {
      conn.status = "not_configured";
      conn.errorMessage =
        "No API key found in Hardware Key Vault. Add key in AI Keys.";
      return;
    }

    conn.status = "authenticated";
    conn.errorMessage = undefined;

    try {
      const res = await apiRequest("/api/v1/providers/test", {
        method: "POST",
        body: JSON.stringify({
          provider,
          selectedModel: conn.selectedModel,
        }),
      });

      if (res.success) {
        conn.status = "ready";
        if (res.availableModels && res.availableModels.length > 0) {
          conn.availableModels = res.availableModels;
        }
      } else {
        conn.status = "error";
        conn.errorMessage = res.errorMessage || "Provider verification failed";
      }
    } catch (err: any) {
      conn.status = "error";
      conn.errorMessage = err.message || "Failed to verify provider connection";
    }
  }

  // --- Memory Actions ---
  async function addMemory(
    content: string,
    category: MemoryItem["category"] = "fact",
  ) {
    const newMemory: MemoryItem = {
      id: `mem_${Date.now()}`,
      category,
      content,
      createdAt: new Date().toISOString(),
      confidence: 1.0,
    };
    state.memories.unshift(newMemory);
    try {
      const res = await apiRequest("/api/v1/memories", {
        method: "POST",
        body: JSON.stringify({ content, category }),
      });
      if (res?.id) newMemory.id = res.id;
    } catch {
      // fallback
    }
  }

  async function deleteMemory(id: string) {
    state.memories = state.memories.filter((m) => m.id !== id);
    try {
      await apiRequest(`/api/v1/memories/${id}`, { method: "DELETE" });
    } catch {
      // fallback
    }
  }

  async function clearAllMemories() {
    state.memories = [];
    try {
      await apiRequest("/api/v1/memories/clear", {
        method: "POST",
        body: "{}",
      });
    } catch {
      // fallback
    }
  }

  function toggleSidebar(collapsed?: boolean) {
    if (typeof collapsed === "boolean") {
      state.sidebarCollapsed = collapsed;
    } else {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    }
  }

  return {
    state,
    platform,
    hasBridgeError,
    setTab,
    toggleSidebar,
    updateSettings,
    loadDiagnostics,
    executePing,
    initAuth,
    login,
    register,
    logout,
    logoutAll,
    fetchProfile,
    updateProfile,
    changePassword,
    fetchSessions,
    revokeSession,
    forgotPassword,
    resetPassword,
    fetchSecrets,
    saveSecret,
    deleteSecret,
    // Stage exports
    initStageSync,
    showStage,
    hideStage,
    toggleStage,
    setStageClickThrough,
    setStageAlwaysOnTop,
    setStageAnimationPaused,
    getStageBounds,
    setStageBounds,
    updateAvatarConfig,
    selectVrmFile,
    loadSampleVrm,
    checkGuestPreviewAvailable,
    enterGuestPreview,
    exitGuestPreview,
    // Companion & Chat exports
    fetchCompanionData,
    sendChatMessage,
    clearChatMessages,
    updateAgent,
    setActiveAgent,
    addSkill,
    updateSkill,
    deleteSkill,
    addRule,
    updateRule,
    deleteRule,
    toggleTool,
    updateTool,
    testConnection,
    addMemory,
    deleteMemory,
    clearAllMemories,
  };
}
