import { contextBridge, ipcRenderer } from "electron";
import {
  IPC_CHANNELS,
  type DesktopAPI,
  type DiagnosticsInfo,
  type StageStatus,
  type AvatarConfig,
  type WindowBounds,
  type WorkspaceWindowState,
  type MenubarDockPosition,
  type MenubarDragInput,
  type DesktopBackdropInfo,
} from "@vrm/platform-contracts";

const desktopAPI: DesktopAPI = {
  getAppVersion: (): Promise<string> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_VERSION);
  },
  getDiagnostics: (): Promise<DiagnosticsInfo> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_DIAGNOSTICS);
  },
  ping: (): Promise<string> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PING);
  },
  getApiBaseUrl: (): Promise<string> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_API_BASE_URL);
  },
  isGuestPreviewAvailable: (): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GUEST_PREVIEW_AVAILABLE);
  },
  auth: {
    login: (credentials) =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGIN, credentials),
    register: (credentials) =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_REGISTER, credentials),
    logout: () => ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGOUT),
    getStoredSession: () =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_GET_STORED_SESSION),
  },
  stage: {
    getStatus: (): Promise<StageStatus> =>
      ipcRenderer.invoke(IPC_CHANNELS.STAGE_GET_STATUS),
    getConfig: (): Promise<AvatarConfig> =>
      ipcRenderer.invoke(IPC_CHANNELS.STAGE_GET_CONFIG),
    getBounds: (): Promise<WindowBounds> =>
      ipcRenderer.invoke(IPC_CHANNELS.STAGE_GET_BOUNDS),
    setBounds: (bounds: Partial<WindowBounds>): Promise<WindowBounds> =>
      ipcRenderer.invoke(IPC_CHANNELS.STAGE_SET_BOUNDS, bounds),
    show: (): Promise<StageStatus> =>
      ipcRenderer.invoke(IPC_CHANNELS.STAGE_SHOW),
    hide: (): Promise<StageStatus> =>
      ipcRenderer.invoke(IPC_CHANNELS.STAGE_HIDE),
    toggle: (): Promise<StageStatus> =>
      ipcRenderer.invoke(IPC_CHANNELS.STAGE_TOGGLE),
    setClickThrough: (enabled: boolean): Promise<StageStatus> =>
      ipcRenderer.invoke(IPC_CHANNELS.STAGE_SET_CLICKTHROUGH, enabled),
    setIgnoreMouseEvents: (ignore: boolean, forward = true): Promise<void> =>
      ipcRenderer.invoke(
        IPC_CHANNELS.STAGE_SET_IGNORE_MOUSE_EVENTS,
        ignore,
        forward,
      ),
    setAlwaysOnTop: (enabled: boolean): Promise<StageStatus> =>
      ipcRenderer.invoke(IPC_CHANNELS.STAGE_SET_ALWAYSONTOP, enabled),
    setAnimationPaused: (paused: boolean): Promise<StageStatus> =>
      ipcRenderer.invoke(IPC_CHANNELS.STAGE_SET_ANIMATION_PAUSED, paused),
    updateConfig: (config: Partial<AvatarConfig>): Promise<AvatarConfig> =>
      ipcRenderer.invoke(IPC_CHANNELS.STAGE_UPDATE_CONFIG, config),
    selectVrmFile: () => ipcRenderer.invoke(IPC_CHANNELS.STAGE_SELECT_VRM_FILE),
    loadVrmBuffer: (filePath?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.STAGE_LOAD_VRM_BUFFER, filePath),
    loadDefaultVrm: () =>
      ipcRenderer.invoke(IPC_CHANNELS.STAGE_LOAD_DEFAULT_VRM),
    ensureSampleVrm: () =>
      ipcRenderer.invoke(IPC_CHANNELS.STAGE_ENSURE_SAMPLE_VRM),
    triggerTestBlink: () =>
      ipcRenderer.invoke(IPC_CHANNELS.STAGE_TRIGGER_TEST_BLINK),
    getBlinkDiagnostic: () =>
      ipcRenderer.invoke(IPC_CHANNELS.STAGE_GET_BLINK_DIAGNOSTIC),
    reportModelStatus: (status: any) =>
      ipcRenderer.invoke(IPC_CHANNELS.STAGE_REPORT_MODEL_STATUS, status),
    onTriggerTestBlink: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on(IPC_CHANNELS.STAGE_TRIGGER_TEST_BLINK, handler);
      return () => {
        ipcRenderer.removeListener(
          IPC_CHANNELS.STAGE_TRIGGER_TEST_BLINK,
          handler,
        );
      };
    },
    onStatusChanged: (callback: (status: StageStatus) => void) => {
      const handler = (_: any, status: StageStatus) => callback(status);
      ipcRenderer.on(IPC_CHANNELS.STAGE_STATUS_CHANGED, handler);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.STAGE_STATUS_CHANGED, handler);
      };
    },
    onConfigChanged: (callback: (config: AvatarConfig) => void) => {
      const handler = (_: any, config: AvatarConfig) => callback(config);
      ipcRenderer.on(IPC_CHANNELS.STAGE_CONFIG_CHANGED, handler);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.STAGE_CONFIG_CHANGED, handler);
      };
    },
    onCursorMove: (callback: (data: any) => void) => {
      const handler = (_: any, data: any) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.STAGE_CURSOR_MOVE, handler);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.STAGE_CURSOR_MOVE, handler);
      };
    },
  },
  workspace: {
    show: (tab?: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_SHOW, tab),
    hide: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_HIDE),
    toggle: (): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_TOGGLE),
    syncTheme: (theme: "light" | "dark"): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_SYNC_THEME, theme),
    getState: (): Promise<WorkspaceWindowState> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_GET_STATE),
    syncState: (
      partial: Partial<WorkspaceWindowState>,
    ): Promise<WorkspaceWindowState> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_SYNC_STATE, partial),
    showMenubar: (): Promise<WorkspaceWindowState> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_SHOW_MENUBAR),
    hideMenubar: (): Promise<WorkspaceWindowState> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_HIDE_MENUBAR),
    toggleMenubar: (visible?: boolean): Promise<WorkspaceWindowState> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_TOGGLE_MENUBAR, visible),
    setMenubarCollapsed: (collapsed: boolean): Promise<WorkspaceWindowState> =>
      ipcRenderer.invoke(
        IPC_CHANNELS.WORKSPACE_SET_MENUBAR_COLLAPSED,
        collapsed,
      ),
    setMenubarDock: (
      dock: MenubarDockPosition,
    ): Promise<WorkspaceWindowState> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_SET_MENUBAR_DOCK, dock),
    dragMenubar: (input: MenubarDragInput): Promise<WorkspaceWindowState> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_DRAG_MENUBAR, input),
    showPanel: (tab?: string): Promise<WorkspaceWindowState> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_SHOW_PANEL, tab),
    hidePanel: (): Promise<WorkspaceWindowState> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_HIDE_PANEL),
    togglePanel: (visible?: boolean): Promise<WorkspaceWindowState> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_TOGGLE_PANEL, visible),
    navigateTab: (tab: string): Promise<WorkspaceWindowState> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_NAVIGATE_TAB, tab),
    resetLayout: (): Promise<WorkspaceWindowState> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_RESET_LAYOUT),
    minimizeWindow: (): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_MINIMIZE_WINDOW),
    toggleMaximizeWindow: (): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_TOGGLE_MAXIMIZE_WINDOW),
    getWindowBounds: (): Promise<WindowBounds> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_GET_WINDOW_BOUNDS),
    setWindowBounds: (bounds: Partial<WindowBounds>): Promise<WindowBounds> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_SET_WINDOW_BOUNDS, bounds),
    getDesktopBackdrop: (): Promise<DesktopBackdropInfo | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_GET_BACKDROP),
    onDesktopBackdropChanged: (
      callback: (info: DesktopBackdropInfo) => void,
    ) => {
      const handler = (_: any, info: DesktopBackdropInfo) => callback(info);
      ipcRenderer.on(IPC_CHANNELS.WORKSPACE_BACKDROP_CHANGED, handler);
      return () => {
        ipcRenderer.removeListener(
          IPC_CHANNELS.WORKSPACE_BACKDROP_CHANGED,
          handler,
        );
      };
    },
    onStateChanged: (callback: (state: WorkspaceWindowState) => void) => {
      const handler = (_: any, state: WorkspaceWindowState) => callback(state);
      ipcRenderer.on(IPC_CHANNELS.WORKSPACE_STATE_CHANGED, handler);
      return () => {
        ipcRenderer.removeListener(
          IPC_CHANNELS.WORKSPACE_STATE_CHANGED,
          handler,
        );
      };
    },
  },
};

contextBridge.exposeInMainWorld("desktopAPI", desktopAPI);
