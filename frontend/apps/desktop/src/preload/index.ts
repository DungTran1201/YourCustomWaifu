import { contextBridge, ipcRenderer } from "electron";
import {
  IPC_CHANNELS,
  type DesktopAPI,
  type DiagnosticsInfo,
  type StageStatus,
  type AvatarConfig,
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
  auth: {
    login: (credentials) =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGIN, credentials),
    logout: () => ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGOUT),
    getStoredSession: () =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_GET_STORED_SESSION),
  },
  stage: {
    getStatus: (): Promise<StageStatus> =>
      ipcRenderer.invoke(IPC_CHANNELS.STAGE_GET_STATUS),
    getConfig: (): Promise<AvatarConfig> =>
      ipcRenderer.invoke(IPC_CHANNELS.STAGE_GET_CONFIG),
    show: (): Promise<StageStatus> =>
      ipcRenderer.invoke(IPC_CHANNELS.STAGE_SHOW),
    hide: (): Promise<StageStatus> =>
      ipcRenderer.invoke(IPC_CHANNELS.STAGE_HIDE),
    toggle: (): Promise<StageStatus> =>
      ipcRenderer.invoke(IPC_CHANNELS.STAGE_TOGGLE),
    setClickThrough: (enabled: boolean): Promise<StageStatus> =>
      ipcRenderer.invoke(IPC_CHANNELS.STAGE_SET_CLICKTHROUGH, enabled),
    setAlwaysOnTop: (enabled: boolean): Promise<StageStatus> =>
      ipcRenderer.invoke(IPC_CHANNELS.STAGE_SET_ALWAYSONTOP, enabled),
    setAnimationPaused: (paused: boolean): Promise<StageStatus> =>
      ipcRenderer.invoke(IPC_CHANNELS.STAGE_SET_ANIMATION_PAUSED, paused),
    updateConfig: (config: Partial<AvatarConfig>): Promise<AvatarConfig> =>
      ipcRenderer.invoke(IPC_CHANNELS.STAGE_UPDATE_CONFIG, config),
    selectVrmFile: () => ipcRenderer.invoke(IPC_CHANNELS.STAGE_SELECT_VRM_FILE),
    loadVrmBuffer: (filePath?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.STAGE_LOAD_VRM_BUFFER, filePath),
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
  },
  workspace: {
    show: (tab?: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_SHOW, tab),
    hide: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_HIDE),
    toggle: (): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_TOGGLE),
  },
};

contextBridge.exposeInMainWorld("desktopAPI", desktopAPI);
