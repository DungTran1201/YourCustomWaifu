import {
  app,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  globalShortcut,
  dialog,
  nativeImage,
  nativeTheme,
  screen,
} from "electron";
import { fileURLToPath } from "node:url";
import { dirname, join, basename, normalize } from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import {
  IPC_CHANNELS,
  type DiagnosticsInfo,
  type AvatarConfig,
  type AvatarOrientationMode,
  type StageStatus,
  type WorkspaceBounds,
  type MenubarBounds,
  type WorkspaceWindowState,
  type WindowBounds,
  type GazeData,
  type BlinkDiagnostic,
  type MenubarDockPosition,
  type MenubarDragInput,
} from "@vrm/platform-contracts";
import {
  APP_METADATA,
  PASSWORD_POLICY,
  DEFAULT_AVATAR_CONFIG,
  DEFAULT_WORKSPACE_BOUNDS,
  DEFAULT_MENUBAR_BOUNDS,
  MENUBAR_EXPANDED_WIDTH,
  MENUBAR_COLLAPSED_WIDTH,
  INITIAL_STAGE_STATUS,
} from "@vrm/shared";
import {
  configureSessionSecurity,
  enforceWindowSecurity,
  validateIpcSender,
} from "./security.js";
import { validateWindowBounds } from "./bounds.js";
import { ensureSampleVrm, getSampleVrmPath } from "./sample-vrm.js";
import { isGuestPreviewAllowed } from "./guest-preview.js";
import {
  getGlassBrowserWindowOptions,
  applyPlatformGlass,
  updatePlatformGlassRegion,
  configureNonIntrusiveOverlayWindow,
  getPlatformGlassMode,
  onPlatformGlassModeChanged,
  disposePlatformGlass,
} from "./platform-glass.js";
import {
  getFloatingMenubarDimensions,
  getNotchDimensionsForDock,
  getCornerBounds,
  resolveMenubarPerimeterDrag,
  isCornerDock,
} from "./menubar-notch.js";
import {
  refreshDesktopWallpaperCache,
  buildWindowBackdropInfo,
  sendWindowBackdropUpdate,
} from "./desktop-backdrop.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Windows & Lifecycle References
let mainWindow: BrowserWindow | null = null;
let menubarWindow: BrowserWindow | null = null;
let stageWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let cursorTrackingTimer: NodeJS.Timeout | null = null;

// Per-avatar presentation settings overrides
export interface AvatarModelOverride {
  orientationMode?: AvatarOrientationMode;
  rotationY?: number;
  scale?: number;
}
let avatarOverrides: Record<string, AvatarModelOverride> = {};

function getAvatarStorageKey(avatarPath?: string | null): string {
  if (!avatarPath) return "default";
  return normalize(avatarPath).toLowerCase();
}

// Shared State & Persistence
let avatarConfig: AvatarConfig = { ...DEFAULT_AVATAR_CONFIG };
let workspaceBounds: WorkspaceBounds = { ...DEFAULT_WORKSPACE_BOUNDS };
let menubarBounds: MenubarBounds = { ...DEFAULT_MENUBAR_BOUNDS };
let stageStatus: StageStatus = { ...INITIAL_STAGE_STATUS };
let workspaceState: WorkspaceWindowState = {
  menubarVisible: true,
  panelVisible: true,
  menubarCollapsed: false,
  menubarDock: "floating",
  currentTab: "signin",
  theme: "light",
  glassBackdropMode: getPlatformGlassMode(),
  isAuthenticated: false,
  isGuest: false,
  user: null,
};

onPlatformGlassModeChanged((mode) => {
  workspaceState.glassBackdropMode = mode;
  broadcastWorkspaceState();
});

const CONFIG_FILE_NAME = "waifu-stage-config.json";

function getConfigFilePath(): string {
  return join(app.getPath("userData"), CONFIG_FILE_NAME);
}

async function loadPersistedConfig(): Promise<void> {
  try {
    const raw = await fs.readFile(getConfigFilePath(), "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed.avatarConfig || parsed.workspaceBounds) {
      avatarConfig = {
        ...DEFAULT_AVATAR_CONFIG,
        ...(parsed.avatarConfig || {}),
      };
      workspaceBounds = {
        ...DEFAULT_WORKSPACE_BOUNDS,
        ...(parsed.workspaceBounds || {}),
      };
      menubarBounds = {
        ...DEFAULT_MENUBAR_BOUNDS,
        ...(parsed.menubarBounds || {}),
      };
      if (parsed.workspacePrefs && typeof parsed.workspacePrefs === "object") {
        if (typeof parsed.workspacePrefs.menubarVisible === "boolean") {
          workspaceState.menubarVisible = parsed.workspacePrefs.menubarVisible;
        }
        if (typeof parsed.workspacePrefs.menubarCollapsed === "boolean") {
          workspaceState.menubarCollapsed =
            parsed.workspacePrefs.menubarCollapsed;
        }
        if (
          typeof parsed.workspacePrefs.menubarDock === "string" &&
          [
            "floating",
            "top",
            "bottom",
            "left",
            "right",
            "top-left",
            "top-right",
            "bottom-left",
            "bottom-right",
          ].includes(parsed.workspacePrefs.menubarDock)
        ) {
          workspaceState.menubarDock = parsed.workspacePrefs
            .menubarDock as MenubarDockPosition;
        }
        if (
          parsed.workspacePrefs.theme === "light" ||
          parsed.workspacePrefs.theme === "dark" ||
          parsed.workspacePrefs.theme === "system"
        ) {
          workspaceState.theme = parsed.workspacePrefs.theme;
        }
      }
      if (
        parsed.avatarOverrides &&
        typeof parsed.avatarOverrides === "object"
      ) {
        avatarOverrides = parsed.avatarOverrides;
      }
    } else {
      // Backward-compatibility: flat avatarConfig
      avatarConfig = { ...DEFAULT_AVATAR_CONFIG, ...parsed };
      workspaceBounds = { ...DEFAULT_WORKSPACE_BOUNDS };
      menubarBounds = { ...DEFAULT_MENUBAR_BOUNDS };
    }
  } catch {
    avatarConfig = { ...DEFAULT_AVATAR_CONFIG };
    workspaceBounds = { ...DEFAULT_WORKSPACE_BOUNDS };
    menubarBounds = { ...DEFAULT_MENUBAR_BOUNDS };
    avatarOverrides = {};
  }
}

async function savePersistedConfig(): Promise<void> {
  try {
    const payload = {
      avatarConfig,
      workspaceBounds,
      menubarBounds,
      workspacePrefs: {
        menubarVisible: workspaceState.menubarVisible,
        menubarCollapsed: workspaceState.menubarCollapsed,
        menubarDock: workspaceState.menubarDock || "floating",
        theme: workspaceState.theme,
      },
      avatarOverrides,
    };
    await fs.writeFile(
      getConfigFilePath(),
      JSON.stringify(payload, null, 2),
      "utf-8",
    );
  } catch (err) {
    console.error("Failed to persist stage/workspace config:", err);
  }
}

function isWorkspaceSessionActive(): boolean {
  return workspaceState.isAuthenticated || workspaceState.isGuest;
}

function broadcastWorkspaceState(): void {
  const allowed = [mainWindow, menubarWindow];
  for (const win of allowed) {
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.WORKSPACE_STATE_CHANGED, {
        ...workspaceState,
      });
    }
  }
  updateTrayMenu();
}

function resolveWorkspaceGlassTheme(
  theme: "light" | "dark" | "system" = workspaceState.theme,
): "light" | "dark" {
  if (theme === "dark") return "dark";
  if (theme === "system") {
    return nativeTheme.shouldUseDarkColors ? "dark" : "light";
  }
  return "light";
}

function applyThemeToWorkspaceWindows(
  theme: "light" | "dark" | "system",
): void {
  nativeTheme.themeSource = theme;
  const resolved = resolveWorkspaceGlassTheme(theme);
  for (const win of [mainWindow, menubarWindow]) {
    if (win && !win.isDestroyed()) {
      win.setBackgroundColor("#00000000");
      const dock =
        win === menubarWindow
          ? workspaceState.menubarDock || "floating"
          : "floating";
      applyPlatformGlass(win, resolved, 24, dock);
    }
  }
}

function broadcastStageStatus(): void {
  const allowed = [mainWindow, menubarWindow, stageWindow];
  for (const win of allowed) {
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.STAGE_STATUS_CHANGED, {
        ...stageStatus,
      });
    }
  }
  updateTrayMenu();
}

function broadcastStageConfig(): void {
  const allowed = [mainWindow, menubarWindow, stageWindow];
  for (const win of allowed) {
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.STAGE_CONFIG_CHANGED, {
        ...avatarConfig,
      });
    }
  }
}

// --- Global Cursor & Gaze Tracking Loop (30Hz) ---

function startCursorTracking(): void {
  if (cursorTrackingTimer) return;

  cursorTrackingTimer = setInterval(() => {
    if (!stageWindow || stageWindow.isDestroyed() || !stageWindow.isVisible()) {
      return;
    }
    if (avatarConfig.lookAtEnabled === false) {
      return;
    }

    try {
      const cursor = screen.getCursorScreenPoint();
      const bounds = stageWindow.getBounds();

      const halfW = Math.max(bounds.width / 2, 1);
      const halfH = Math.max(bounds.height / 2, 1);
      const centerX = bounds.x + halfW;
      const centerY = bounds.y + halfH;

      // Normalized coordinates relative to stage center (-1 to 1 at stage borders)
      const relX = (cursor.x - centerX) / halfW;
      const relY = (cursor.y - centerY) / halfH;

      const isInsideStage =
        cursor.x >= bounds.x &&
        cursor.x <= bounds.x + bounds.width &&
        cursor.y >= bounds.y &&
        cursor.y <= bounds.y + bounds.height;

      const gazeData: GazeData = {
        screenX: cursor.x,
        screenY: cursor.y,
        relX,
        relY,
        stageX: cursor.x - bounds.x,
        stageY: cursor.y - bounds.y,
        stageWidth: bounds.width,
        stageHeight: bounds.height,
        normalizedX: Math.max(-4, Math.min(4, relX)),
        normalizedY: Math.max(-4, Math.min(4, relY)),
        isInsideStage,
        timestamp: Date.now(),
      };

      stageWindow.webContents.send(IPC_CHANNELS.STAGE_CURSOR_MOVE, gazeData);
    } catch {
      // Ignored if window is in the middle of closing
    }
  }, 33);
}

function stopCursorTracking(): void {
  if (cursorTrackingTimer) {
    clearInterval(cursorTrackingTimer);
    cursorTrackingTimer = null;
  }
}

// --- Window Factories ---

function createWorkspaceWindow(): BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    workspaceState.panelVisible = true;
    broadcastWorkspaceState();
    return mainWindow;
  }

  const displays = screen.getAllDisplays().map((d) => ({
    bounds: d.bounds,
    workArea: d.workArea,
  }));

  const initialWidth = workspaceBounds.width || DEFAULT_WORKSPACE_BOUNDS.width;
  const initialHeight =
    workspaceBounds.height || DEFAULT_WORKSPACE_BOUNDS.height;

  let validatedX = workspaceBounds.x;
  let validatedY = workspaceBounds.y;

  // Center Panel slightly right of center so Menubar docks cleanly to its left on first launch
  if (typeof validatedX !== "number" || typeof validatedY !== "number") {
    const primary = displays[0]?.workArea || {
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
    };
    const combinedWidth = initialWidth + MENUBAR_EXPANDED_WIDTH + 14;
    const startX = Math.max(
      primary.x + 16,
      Math.round(primary.x + (primary.width - combinedWidth) / 2),
    );
    validatedX = startX + MENUBAR_EXPANDED_WIDTH + 14;
    validatedY = Math.max(
      primary.y + 16,
      Math.round(primary.y + (primary.height - initialHeight) / 2),
    );
  }

  const bounds = validateWindowBounds(
    {
      x: validatedX,
      y: validatedY,
      width: initialWidth,
      height: initialHeight,
    },
    displays,
    { minWidth: 540, minHeight: 440 },
  );

  nativeTheme.themeSource = workspaceState.theme;

  mainWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: 540,
    minHeight: 440,
    show: false,
    title: APP_METADATA.name,
    ...getGlassBrowserWindowOptions(),
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      navigateOnDragDrop: false,
    },
  });

  mainWindow.removeMenu();

  enforceWindowSecurity(mainWindow);

  const devUrl = process.env["VITE_DEV_SERVER_URL"];
  if (devUrl) {
    mainWindow.loadURL(`${devUrl}/?window=panel`);
  } else {
    mainWindow.loadFile(join(__dirname, "../../dist/index.html"), {
      query: { window: "panel" },
    });
  }

  mainWindow.once("ready-to-show", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    workspaceState.panelVisible = true;
    applyPlatformGlass(mainWindow, resolveWorkspaceGlassTheme(), 24);
    sendWindowBackdropUpdate(
      mainWindow,
      IPC_CHANNELS.WORKSPACE_BACKDROP_CHANGED,
      true,
    );
    void refreshDesktopWallpaperCache().then((changed) => {
      if (changed) {
        sendWindowBackdropUpdate(
          mainWindow,
          IPC_CHANNELS.WORKSPACE_BACKDROP_CHANGED,
          true,
        );
      }
    });
    mainWindow.show();
    if (workspaceBounds.isMaximized) {
      mainWindow.maximize();
    }
    updateTrayMenu();
  });

  mainWindow.on("show", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      applyPlatformGlass(mainWindow, resolveWorkspaceGlassTheme(), 24);
      sendWindowBackdropUpdate(
        mainWindow,
        IPC_CHANNELS.WORKSPACE_BACKDROP_CHANGED,
      );
      void refreshDesktopWallpaperCache().then((changed) => {
        if (changed) {
          sendWindowBackdropUpdate(
            mainWindow,
            IPC_CHANNELS.WORKSPACE_BACKDROP_CHANGED,
            true,
          );
        }
      });
    }
  });

  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
      workspaceState.panelVisible = false;
      broadcastWorkspaceState();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Track normal bounds without overwriting during maximization
  mainWindow.on("resize", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      updatePlatformGlassRegion(mainWindow, 24);
      sendWindowBackdropUpdate(
        mainWindow,
        IPC_CHANNELS.WORKSPACE_BACKDROP_CHANGED,
      );
      if (!mainWindow.isMaximized()) {
        const size = mainWindow.getSize();
        if (typeof size[0] === "number") workspaceBounds.width = size[0];
        if (typeof size[1] === "number") workspaceBounds.height = size[1];
        savePersistedConfig();
      }
    }
  });

  mainWindow.on("move", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      sendWindowBackdropUpdate(
        mainWindow,
        IPC_CHANNELS.WORKSPACE_BACKDROP_CHANGED,
      );
      if (!mainWindow.isMaximized()) {
        const pos = mainWindow.getPosition();
        if (typeof pos[0] === "number" && typeof pos[1] === "number") {
          workspaceBounds.x = pos[0];
          workspaceBounds.y = pos[1];
          savePersistedConfig();
        }
      }
    }
  });

  mainWindow.on("maximize", () => {
    workspaceBounds.isMaximized = true;
    updatePlatformGlassRegion(mainWindow, 24);
    sendWindowBackdropUpdate(
      mainWindow,
      IPC_CHANNELS.WORKSPACE_BACKDROP_CHANGED,
    );
    savePersistedConfig();
  });

  mainWindow.on("unmaximize", () => {
    workspaceBounds.isMaximized = false;
    updatePlatformGlassRegion(mainWindow, 24);
    sendWindowBackdropUpdate(
      mainWindow,
      IPC_CHANNELS.WORKSPACE_BACKDROP_CHANGED,
    );
    savePersistedConfig();
  });

  return mainWindow;
}

function createMenubarWindow(): BrowserWindow {
  if (menubarWindow && !menubarWindow.isDestroyed()) {
    if (menubarWindow.isMinimized()) menubarWindow.restore();
    menubarWindow.setAlwaysOnTop(true, "floating");
    menubarWindow.showInactive();
    menubarWindow.moveTop();
    workspaceState.menubarVisible = true;
    broadcastWorkspaceState();
    return menubarWindow;
  }

  const displays = screen.getAllDisplays().map((d) => ({
    bounds: d.bounds,
    workArea: d.workArea,
  }));

  const targetWidth = workspaceState.menubarCollapsed
    ? MENUBAR_COLLAPSED_WIDTH
    : Math.max(
        MENUBAR_EXPANDED_WIDTH,
        menubarBounds.width || DEFAULT_MENUBAR_BOUNDS.width,
      );
  const targetHeight = menubarBounds.height || workspaceBounds.height || 740;

  let targetX = menubarBounds.x;
  let targetY = menubarBounds.y;

  // Dock gracefully to the left of Panel window if no saved coordinates,
  // staying on the same display as Panel even when Panel is maximized or near the left screen edge.
  if (typeof targetX !== "number" || typeof targetY !== "number") {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const panelBounds = mainWindow.getBounds();
      const panelDisplay = screen.getDisplayMatching(panelBounds);
      const wa = panelDisplay.workArea;
      const dockedLeft = panelBounds.x - targetWidth - 14;
      if (mainWindow.isMaximized() || dockedLeft < wa.x) {
        targetX = wa.x + 16;
        targetY = wa.y + 16;
      } else {
        targetX = dockedLeft;
        targetY = Math.max(wa.y, panelBounds.y);
      }
    } else {
      const primary = displays[0]?.workArea || {
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
      };
      targetX = primary.x + 28;
      targetY = Math.max(
        primary.y + 16,
        Math.round(primary.y + (primary.height - targetHeight) / 2),
      );
    }
  }

  const initialDock: MenubarDockPosition =
    workspaceState.menubarDock || "floating";
  const refWorkArea =
    mainWindow && !mainWindow.isDestroyed()
      ? screen.getDisplayMatching(mainWindow.getBounds()).workArea
      : displays[0]?.workArea || { x: 0, y: 0, width: 1920, height: 1080 };
  const floatingDims = getFloatingMenubarDimensions(
    workspaceState.menubarCollapsed,
    menubarBounds.width,
    menubarBounds.height,
    refWorkArea,
  );
  const notchDims = getNotchDimensionsForDock(
    initialDock,
    refWorkArea,
    floatingDims,
  );

  const bounds = validateWindowBounds(
    {
      x: targetX,
      y: targetY,
      width: notchDims.width,
      height: notchDims.height,
    },
    displays,
    { minWidth: 44, minHeight: 44 },
  );

  menubarWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: 44,
    minHeight: 44,
    maxWidth: 900,
    show: false,
    title: `${APP_METADATA.shortName} — Menubar`,
    ...getGlassBrowserWindowOptions(process.platform, { overlay: true }),
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      navigateOnDragDrop: false,
    },
  });

  menubarWindow.removeMenu();
  enforceWindowSecurity(menubarWindow);

  const devUrl = process.env["VITE_DEV_SERVER_URL"];
  if (devUrl) {
    menubarWindow.loadURL(`${devUrl}/?window=menubar`);
  } else {
    menubarWindow.loadFile(join(__dirname, "../../dist/index.html"), {
      query: { window: "menubar" },
    });
  }

  menubarWindow.once("ready-to-show", () => {
    if (!menubarWindow || menubarWindow.isDestroyed()) return;
    const activeDock = workspaceState.menubarDock || "floating";
    configureNonIntrusiveOverlayWindow(menubarWindow);
    applyPlatformGlass(
      menubarWindow,
      resolveWorkspaceGlassTheme(),
      24,
      activeDock,
    );
    sendWindowBackdropUpdate(
      menubarWindow,
      IPC_CHANNELS.WORKSPACE_BACKDROP_CHANGED,
      true,
    );
    menubarWindow.setAlwaysOnTop(true, "floating");
    menubarWindow.webContents.send(IPC_CHANNELS.WORKSPACE_STATE_CHANGED, {
      ...workspaceState,
    });
    menubarWindow.webContents.send(IPC_CHANNELS.STAGE_STATUS_CHANGED, {
      ...stageStatus,
    });
    if (workspaceState.menubarVisible && isWorkspaceSessionActive()) {
      menubarWindow.showInactive();
      menubarWindow.moveTop();
    }
  });

  menubarWindow.on("show", () => {
    if (menubarWindow && !menubarWindow.isDestroyed()) {
      const activeDock = workspaceState.menubarDock || "floating";
      configureNonIntrusiveOverlayWindow(menubarWindow);
      applyPlatformGlass(
        menubarWindow,
        resolveWorkspaceGlassTheme(),
        24,
        activeDock,
      );
      sendWindowBackdropUpdate(
        menubarWindow,
        IPC_CHANNELS.WORKSPACE_BACKDROP_CHANGED,
      );
      menubarWindow.setAlwaysOnTop(true, "floating");
    }
  });

  menubarWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      menubarWindow?.hide();
      workspaceState.menubarVisible = false;
      savePersistedConfig();
      broadcastWorkspaceState();
    }
  });

  menubarWindow.on("closed", () => {
    menubarWindow = null;
  });

  menubarWindow.on("resize", () => {
    if (menubarWindow && !menubarWindow.isDestroyed()) {
      const activeDock = workspaceState.menubarDock || "floating";
      updatePlatformGlassRegion(menubarWindow, 24, activeDock);
      sendWindowBackdropUpdate(
        menubarWindow,
        IPC_CHANNELS.WORKSPACE_BACKDROP_CHANGED,
      );
      if (activeDock === "floating") {
        const size = menubarWindow.getSize();
        if (typeof size[0] === "number" && !workspaceState.menubarCollapsed) {
          menubarBounds.width = Math.max(MENUBAR_EXPANDED_WIDTH, size[0]);
        }
        if (typeof size[1] === "number") {
          menubarBounds.height = size[1];
        }
        savePersistedConfig();
      }
    }
  });

  menubarWindow.on("move", () => {
    if (menubarWindow && !menubarWindow.isDestroyed()) {
      sendWindowBackdropUpdate(
        menubarWindow,
        IPC_CHANNELS.WORKSPACE_BACKDROP_CHANGED,
      );
      if ((workspaceState.menubarDock || "floating") === "floating") {
        const pos = menubarWindow.getPosition();
        if (typeof pos[0] === "number" && typeof pos[1] === "number") {
          menubarBounds.x = pos[0];
          menubarBounds.y = pos[1];
          savePersistedConfig();
        }
      }
    }
  });

  return menubarWindow;
}

function createStageWindow(): BrowserWindow {
  if (stageWindow && !stageWindow.isDestroyed()) {
    stageWindow.showInactive();
    stageStatus.stageVisible = true;
    broadcastStageStatus();
    startCursorTracking();
    return stageWindow;
  }

  const displays = screen.getAllDisplays().map((d) => ({
    bounds: d.bounds,
    workArea: d.workArea,
  }));
  const bounds = validateWindowBounds(
    {
      x: avatarConfig.stageX,
      y: avatarConfig.stageY,
      width: avatarConfig.stageWidth || 420,
      height: avatarConfig.stageHeight || 640,
    },
    displays,
  );

  stageWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: 240,
    minHeight: 320,
    show: false,
    title: "Avatar Stage",
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: false,
    alwaysOnTop: avatarConfig.alwaysOnTop !== false,
    resizable: true,
    skipTaskbar: true,
    focusable: false,
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      navigateOnDragDrop: false,
    },
  });

  configureNonIntrusiveOverlayWindow(stageWindow);
  if (avatarConfig.alwaysOnTop !== false) {
    stageWindow.setAlwaysOnTop(true, "screen-saver");
  }
  stageWindow.once("ready-to-show", () => {
    if (stageWindow && !stageWindow.isDestroyed()) {
      configureNonIntrusiveOverlayWindow(stageWindow);
      stageWindow.showInactive();
    }
  });

  enforceWindowSecurity(stageWindow);

  if (avatarConfig.clickThrough) {
    stageWindow.setIgnoreMouseEvents(true, { forward: true });
  }

  const devUrl = process.env["VITE_DEV_SERVER_URL"];
  if (devUrl) {
    stageWindow.loadURL(`${devUrl}/stage.html`);
  } else {
    stageWindow.loadFile(join(__dirname, "../../dist/stage.html"));
  }

  stageWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      stageWindow?.hide();
      stageStatus.stageVisible = false;
      stopCursorTracking();
      broadcastStageStatus();
    }
  });

  stageWindow.on("resize", () => {
    if (stageWindow && !stageWindow.isDestroyed()) {
      const size = stageWindow.getSize();
      if (typeof size[0] === "number") avatarConfig.stageWidth = size[0];
      if (typeof size[1] === "number") avatarConfig.stageHeight = size[1];
      savePersistedConfig();
    }
  });

  stageWindow.on("move", () => {
    if (stageWindow && !stageWindow.isDestroyed()) {
      const pos = stageWindow.getPosition();
      if (typeof pos[0] === "number" && typeof pos[1] === "number") {
        avatarConfig.stageX = pos[0];
        avatarConfig.stageY = pos[1];
        savePersistedConfig();
      }
    }
  });

  stageStatus.stageVisible = true;
  stageStatus.stageReady = true;
  stageStatus.alwaysOnTop = avatarConfig.alwaysOnTop !== false;
  stageStatus.clickThrough = !!avatarConfig.clickThrough;
  stageStatus.animationPaused = !!avatarConfig.animationPaused;
  broadcastStageStatus();
  startCursorTracking();

  return stageWindow;
}

// --- Lifecycle Actions ---

function showPanel(targetTab?: string): WorkspaceWindowState {
  const win = createWorkspaceWindow();
  workspaceState.panelVisible = true;
  if (targetTab && typeof targetTab === "string") {
    workspaceState.currentTab = targetTab;
    if (!win.isDestroyed()) {
      win.webContents.send("app:navigate-tab", targetTab);
    }
  }
  broadcastWorkspaceState();
  return { ...workspaceState };
}

function hidePanel(): WorkspaceWindowState {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide();
  }
  workspaceState.panelVisible = false;
  broadcastWorkspaceState();
  return { ...workspaceState };
}

function togglePanel(visible?: boolean): WorkspaceWindowState {
  const shouldShow =
    typeof visible === "boolean"
      ? visible
      : !(mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible());
  return shouldShow ? showPanel() : hidePanel();
}

function showMenubar(): WorkspaceWindowState {
  workspaceState.menubarVisible = true;
  savePersistedConfig();
  if (isWorkspaceSessionActive()) {
    createMenubarWindow();
  }
  broadcastWorkspaceState();
  return { ...workspaceState };
}

function hideMenubar(): WorkspaceWindowState {
  if (menubarWindow && !menubarWindow.isDestroyed()) {
    menubarWindow.hide();
  }
  workspaceState.menubarVisible = false;
  savePersistedConfig();
  broadcastWorkspaceState();
  return { ...workspaceState };
}

function toggleMenubar(visible?: boolean): WorkspaceWindowState {
  const isCurrentlyVisible = !!(
    menubarWindow &&
    !menubarWindow.isDestroyed() &&
    menubarWindow.isVisible()
  );
  const shouldShow =
    typeof visible === "boolean" ? visible : !isCurrentlyVisible;
  return shouldShow ? showMenubar() : hideMenubar();
}

function setMenubarCollapsed(collapsed: boolean): WorkspaceWindowState {
  workspaceState.menubarCollapsed = collapsed;
  if ((workspaceState.menubarDock || "floating") !== "floating") {
    workspaceState.menubarDock = "floating";
  }
  if (menubarWindow && !menubarWindow.isDestroyed()) {
    const bounds = menubarWindow.getBounds();
    const display = screen.getDisplayMatching(bounds);
    const floatingDims = getFloatingMenubarDimensions(
      collapsed,
      menubarBounds.width,
      menubarBounds.height,
      display.workArea,
    );
    menubarWindow.setBounds({
      x: bounds.x,
      y: bounds.y,
      width: floatingDims.width,
      height: floatingDims.height,
    });
    applyPlatformGlass(
      menubarWindow,
      resolveWorkspaceGlassTheme(),
      24,
      "floating",
    );
  }
  savePersistedConfig();
  broadcastWorkspaceState();
  return { ...workspaceState };
}

function setMenubarDock(dock: MenubarDockPosition): WorkspaceWindowState {
  const prevDock = workspaceState.menubarDock || "floating";
  workspaceState.menubarDock = dock;

  if (menubarWindow && !menubarWindow.isDestroyed()) {
    const cur = menubarWindow.getBounds();
    const display = screen.getDisplayMatching(cur);
    const wa = display.workArea;
    const floatingDims = getFloatingMenubarDimensions(
      workspaceState.menubarCollapsed,
      menubarBounds.width,
      menubarBounds.height,
      wa,
    );

    let nextBounds: WindowBounds;
    if (dock === "floating") {
      const targetX =
        typeof menubarBounds.x === "number"
          ? Math.max(
              wa.x + 16,
              Math.min(
                wa.x + wa.width - floatingDims.width - 16,
                menubarBounds.x,
              ),
            )
          : wa.x + 28;
      const targetY =
        typeof menubarBounds.y === "number"
          ? Math.max(
              wa.y + 16,
              Math.min(
                wa.y + wa.height - floatingDims.height - 16,
                menubarBounds.y,
              ),
            )
          : Math.max(
              wa.y + 16,
              Math.round(wa.y + (wa.height - floatingDims.height) / 2),
            );
      nextBounds = {
        x: targetX,
        y: targetY,
        width: floatingDims.width,
        height: floatingDims.height,
      };
    } else if (isCornerDock(dock)) {
      nextBounds = getCornerBounds(dock, wa);
    } else {
      const dims = getNotchDimensionsForDock(dock, wa, floatingDims);
      nextBounds = {
        x:
          dock === "left"
            ? wa.x
            : dock === "right"
              ? wa.x + wa.width - dims.width
              : Math.round(wa.x + (wa.width - dims.width) / 2),
        y:
          dock === "top"
            ? wa.y
            : dock === "bottom"
              ? wa.y + wa.height - dims.height
              : Math.round(wa.y + (wa.height - dims.height) / 2),
        width: dims.width,
        height: dims.height,
      };
    }

    menubarWindow.setBounds(nextBounds);
    applyPlatformGlass(menubarWindow, resolveWorkspaceGlassTheme(), 24, dock);
  }

  savePersistedConfig();
  if (prevDock !== dock) {
    broadcastWorkspaceState();
  }
  return { ...workspaceState };
}

function dragMenubar(input: MenubarDragInput): WorkspaceWindowState {
  if (!menubarWindow || menubarWindow.isDestroyed()) {
    return { ...workspaceState };
  }

  const prevDock = workspaceState.menubarDock || "floating";
  const display = screen.getDisplayNearestPoint({
    x: Math.round(input.cursorX),
    y: Math.round(input.cursorY),
  });
  const wa = display.workArea;
  const floatingDims = getFloatingMenubarDimensions(
    workspaceState.menubarCollapsed,
    menubarBounds.width,
    menubarBounds.height,
    wa,
  );

  const result = resolveMenubarPerimeterDrag({
    cursorX: input.cursorX,
    cursorY: input.cursorY,
    grabOffsetX: input.grabOffsetX,
    grabOffsetY: input.grabOffsetY,
    currentDock: prevDock,
    workArea: wa,
    floatingWidth: floatingDims.width,
    floatingHeight: floatingDims.height,
  });

  workspaceState.menubarDock = result.dock;
  menubarWindow.setBounds(result.bounds);

  if (result.dock === "floating") {
    menubarBounds.x = result.bounds.x;
    menubarBounds.y = result.bounds.y;
  }

  if (prevDock !== result.dock) {
    applyPlatformGlass(
      menubarWindow,
      resolveWorkspaceGlassTheme(),
      24,
      result.dock,
    );
    savePersistedConfig();
    broadcastWorkspaceState();
  }

  return { ...workspaceState };
}

function navigateWorkspaceTab(tab: string): WorkspaceWindowState {
  workspaceState.currentTab = tab;
  if (!workspaceState.panelVisible || !mainWindow || !mainWindow.isVisible()) {
    showPanel(tab);
    return { ...workspaceState };
  }
  broadcastWorkspaceState();
  return { ...workspaceState };
}

function resetWorkspaceLayout(): WorkspaceWindowState {
  const display =
    mainWindow && !mainWindow.isDestroyed()
      ? screen.getDisplayMatching(mainWindow.getBounds())
      : screen.getPrimaryDisplay();
  const workArea = display.workArea;
  const menubarW = workspaceState.menubarCollapsed
    ? MENUBAR_COLLAPSED_WIDTH
    : MENUBAR_EXPANDED_WIDTH;
  const gap = 14;
  const panelW = Math.min(
    DEFAULT_WORKSPACE_BOUNDS.width,
    Math.max(540, workArea.width - menubarW - gap - 48),
  );
  const height = Math.min(
    DEFAULT_WORKSPACE_BOUNDS.height,
    workArea.height - 48,
  );
  const totalW = menubarW + gap + panelW;
  const startX = Math.max(
    workArea.x + 16,
    Math.round(workArea.x + (workArea.width - totalW) / 2),
  );
  const startY = Math.max(
    workArea.y + 16,
    Math.round(workArea.y + (workArea.height - height) / 2),
  );

  menubarBounds = {
    x: startX,
    y: startY,
    width: MENUBAR_EXPANDED_WIDTH,
    height,
  };
  workspaceBounds = {
    x: startX + menubarW + gap,
    y: startY,
    width: panelW,
    height,
    isMaximized: false,
  };

  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    mainWindow.setBounds({
      x: workspaceBounds.x!,
      y: workspaceBounds.y!,
      width: workspaceBounds.width,
      height: workspaceBounds.height,
    });
    mainWindow.show();
    workspaceState.panelVisible = true;
  }

  if (isWorkspaceSessionActive()) {
    workspaceState.menubarDock = "floating";
    const mb = createMenubarWindow();
    if (!mb.isDestroyed()) {
      mb.setBounds({
        x: startX,
        y: startY,
        width: menubarW,
        height,
      });
      applyPlatformGlass(mb, resolveWorkspaceGlassTheme(), 24, "floating");
      mb.showInactive();
      mb.moveTop();
      workspaceState.menubarVisible = true;
    }
  }

  savePersistedConfig();
  broadcastWorkspaceState();
  return { ...workspaceState };
}

function syncWorkspaceState(
  partial: Partial<WorkspaceWindowState>,
): WorkspaceWindowState {
  const wasActive = isWorkspaceSessionActive();

  if (typeof partial.isAuthenticated === "boolean") {
    workspaceState.isAuthenticated = partial.isAuthenticated;
  }
  if (typeof partial.isGuest === "boolean") {
    workspaceState.isGuest = partial.isGuest;
  }
  if ("user" in partial) {
    workspaceState.user = partial.user ?? null;
  }
  if (typeof partial.currentTab === "string" && partial.currentTab.trim()) {
    workspaceState.currentTab = partial.currentTab.trim();
  }
  if (
    partial.theme === "light" ||
    partial.theme === "dark" ||
    partial.theme === "system"
  ) {
    workspaceState.theme = partial.theme;
    applyThemeToWorkspaceWindows(partial.theme);
    savePersistedConfig();
  }
  if (typeof partial.menubarCollapsed === "boolean") {
    setMenubarCollapsed(partial.menubarCollapsed);
  }
  if (typeof partial.menubarVisible === "boolean") {
    workspaceState.menubarVisible = partial.menubarVisible;
  }
  if (typeof partial.panelVisible === "boolean") {
    workspaceState.panelVisible = partial.panelVisible;
  }

  const isActive = isWorkspaceSessionActive();

  if (isActive) {
    if (!wasActive && workspaceState.menubarVisible) {
      createMenubarWindow();
    } else if (workspaceState.menubarVisible) {
      if (menubarWindow && !menubarWindow.isDestroyed()) {
        menubarWindow.setAlwaysOnTop(true, "floating");
        if (!menubarWindow.isVisible()) menubarWindow.showInactive();
        menubarWindow.moveTop();
      } else {
        createMenubarWindow();
      }
    } else if (menubarWindow && !menubarWindow.isDestroyed()) {
      menubarWindow.hide();
    }
  } else {
    // Unauthenticated Auth Mode: keep independent Menubar window hidden and show Auth panel only when transitioning back from an active session
    if (menubarWindow && !menubarWindow.isDestroyed()) {
      menubarWindow.hide();
    }
    if (
      wasActive &&
      mainWindow &&
      !mainWindow.isDestroyed() &&
      !mainWindow.isVisible()
    ) {
      mainWindow.show();
      workspaceState.panelVisible = true;
    }
  }

  broadcastWorkspaceState();
  return { ...workspaceState };
}

function showWorkspace(targetTab?: string): void {
  showPanel(targetTab);
  if (isWorkspaceSessionActive() && workspaceState.menubarVisible) {
    createMenubarWindow();
  }
}

function hideWorkspace(): void {
  hidePanel();
}

function toggleWorkspace(): void {
  togglePanel();
}

function showStage(): StageStatus {
  createStageWindow();
  stageStatus.stageVisible = true;
  broadcastStageStatus();
  startCursorTracking();
  return { ...stageStatus };
}

function hideStage(): StageStatus {
  if (stageWindow && !stageWindow.isDestroyed()) {
    stageWindow.hide();
  }
  stageStatus.stageVisible = false;
  stopCursorTracking();
  broadcastStageStatus();
  return { ...stageStatus };
}

function toggleStage(): StageStatus {
  if (stageWindow && !stageWindow.isDestroyed() && stageWindow.isVisible()) {
    return hideStage();
  }
  return showStage();
}

function setClickThrough(enabled: boolean): StageStatus {
  avatarConfig.clickThrough = enabled;
  stageStatus.clickThrough = enabled;
  if (stageWindow && !stageWindow.isDestroyed()) {
    stageWindow.setIgnoreMouseEvents(enabled, { forward: true });
  }
  savePersistedConfig();
  broadcastStageStatus();
  broadcastStageConfig();
  return { ...stageStatus };
}

function setAlwaysOnTop(enabled: boolean): StageStatus {
  avatarConfig.alwaysOnTop = enabled;
  stageStatus.alwaysOnTop = enabled;
  if (stageWindow && !stageWindow.isDestroyed()) {
    if (enabled) {
      stageWindow.setAlwaysOnTop(true, "screen-saver");
    } else {
      stageWindow.setAlwaysOnTop(false);
    }
  }
  savePersistedConfig();
  broadcastStageStatus();
  broadcastStageConfig();
  return { ...stageStatus };
}

function setAnimationPaused(paused: boolean): StageStatus {
  avatarConfig.animationPaused = paused;
  stageStatus.animationPaused = paused;
  savePersistedConfig();
  broadcastStageStatus();
  broadcastStageConfig();
  return { ...stageStatus };
}

function quitApplication(): void {
  isQuitting = true;
  stopCursorTracking();
  disposePlatformGlass();
  globalShortcut.unregisterAll();
  if (menubarWindow && !menubarWindow.isDestroyed()) {
    menubarWindow.destroy();
    menubarWindow = null;
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy();
    mainWindow = null;
  }
  if (stageWindow && !stageWindow.isDestroyed()) {
    stageWindow.destroy();
    stageWindow = null;
  }
  if (tray) {
    tray.destroy();
    tray = null;
  }
  app.quit();
}

// --- System Tray ---

function createSystemTray(): void {
  // 16x16 crisp native icon in base64
  const iconBase64 =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAZElEQVQ4T2NkoBAwUqifYdQACj0wbvh/gOEdHkOwhg+G9/8/xOIBvIZg0w1j4zOErACfIUg+w2sIHkPQdMDZGE6QO2BuB6nHYT/2cMAwhA8jY5ghfgbjNYRSb4AczpRGkBoAAGsWJBGKx1hQAAAAAElFTkSuQmCC";
  const icon = nativeImage.createFromDataURL(iconBase64);

  tray = new Tray(icon);
  tray.setToolTip("YourCustomWaifu — Desktop Companion");

  tray.on("click", () => {
    showWorkspace();
  });

  updateTrayMenu();
}

function updateTrayMenu(): void {
  if (!tray) return;

  const isStageActive = stageStatus.stageVisible;
  const isPaused = stageStatus.animationPaused;
  const isPanelVisible = !!(
    mainWindow &&
    !mainWindow.isDestroyed() &&
    mainWindow.isVisible()
  );
  const isMenubarVisible = !!(
    menubarWindow &&
    !menubarWindow.isDestroyed() &&
    menubarWindow.isVisible()
  );

  const contextMenu = Menu.buildFromTemplate([
    {
      label: isPanelVisible
        ? "Hide Workspace Panel (Ctrl+Alt+\\)"
        : "Show Workspace Panel (Ctrl+Alt+\\)",
      click: () => togglePanel(),
    },
    ...(isWorkspaceSessionActive()
      ? [
          {
            label: isMenubarVisible
              ? "Hide Menubar (Ctrl+Alt+B)"
              : "Show Menubar (Ctrl+Alt+B)",
            click: () => toggleMenubar(),
          },
          {
            label: "Arrange Menubar & Panel Side-by-Side",
            click: () => resetWorkspaceLayout(),
          },
        ]
      : []),
    { type: "separator" as const },
    {
      label: isStageActive ? "Hide Avatar Stage" : "Show Avatar Stage",
      click: () => toggleStage(),
    },
    {
      label: isPaused ? "Resume Animation" : "Pause Animation",
      click: () => setAnimationPaused(!isPaused),
    },
    {
      label: stageStatus.clickThrough
        ? "Disable Click-Through (Interactive)"
        : "Enable Click-Through (Ctrl+Shift+M)",
      click: () => setClickThrough(!stageStatus.clickThrough),
    },
    { type: "separator" as const },
    {
      label: "Avatar Settings",
      click: () => showWorkspace("avatar"),
    },
    {
      label: "Application Settings",
      click: () => showWorkspace("settings"),
    },
    { type: "separator" as const },
    {
      label: "Quit YourCustomWaifu",
      click: () => quitApplication(),
    },
  ]);

  tray.setContextMenu(contextMenu);
}

// --- Global Shortcuts ---

function registerGlobalShortcuts(): void {
  try {
    // Ctrl+Shift+A: Toggle Avatar Stage Visibility
    globalShortcut.register("CommandOrControl+Shift+A", () => {
      toggleStage();
    });

    // Ctrl+Shift+M: Toggle Click-Through Mode
    globalShortcut.register("CommandOrControl+Shift+M", () => {
      setClickThrough(!stageStatus.clickThrough);
    });

    // Ctrl+Alt+B: Globally Toggle Independent Menubar Window
    globalShortcut.register("CommandOrControl+Alt+B", () => {
      if (isWorkspaceSessionActive()) {
        toggleMenubar();
      }
    });

    // Ctrl+Alt+\: Globally Toggle Independent Workspace Panel Window
    globalShortcut.register("CommandOrControl+Alt+\\", () => {
      togglePanel();
    });
  } catch (err) {
    console.warn("Failed to register some global shortcuts:", err);
  }
}

// --- IPC Handlers ---

function registerIpcHandlers(): void {
  const allowedWindows = () => [mainWindow, menubarWindow, stageWindow];

  // 1. Version & Diagnostics
  ipcMain.handle(IPC_CHANNELS.GET_VERSION, (event) => {
    if (!validateIpcSender(event.sender, allowedWindows())) {
      throw new Error("Unauthorized IPC sender");
    }
    return APP_METADATA.version;
  });

  ipcMain.handle(IPC_CHANNELS.GUEST_PREVIEW_AVAILABLE, (event): boolean => {
    if (!validateIpcSender(event.sender, allowedWindows())) {
      throw new Error("Unauthorized IPC sender");
    }
    return isGuestPreviewAllowed(
      app.isPackaged,
      process.env["YCW_ENABLE_GUEST_PREVIEW"],
    );
  });

  ipcMain.handle(IPC_CHANNELS.GET_DIAGNOSTICS, (event): DiagnosticsInfo => {
    if (!validateIpcSender(event.sender, allowedWindows())) {
      throw new Error("Unauthorized IPC sender");
    }
    return {
      platform: "electron",
      appVersion: APP_METADATA.version,
      environment: app.isPackaged ? "production" : "development",
      timestamp: new Date().toISOString(),
      capabilities: {
        desktopIntegration: true,
        fileSystemAccess: true,
        nativeMenus: true,
      },
      os: {
        platform: os.platform(),
        arch: os.arch(),
        release: os.release(),
      },
      guestPreviewEnabled: isGuestPreviewAllowed(
        app.isPackaged,
        process.env["YCW_ENABLE_GUEST_PREVIEW"],
      ),
    };
  });

  ipcMain.handle(IPC_CHANNELS.PING, (event) => {
    if (!validateIpcSender(event.sender, allowedWindows())) {
      throw new Error("Unauthorized IPC sender");
    }
    return "pong:electron-main";
  });

  ipcMain.handle(IPC_CHANNELS.GET_API_BASE_URL, (event) => {
    if (!validateIpcSender(event.sender, allowedWindows())) {
      throw new Error("Unauthorized IPC sender");
    }
    return process.env["VITE_API_BASE_URL"] || "http://127.0.0.1:3000";
  });

  // 2. Auth IPC Handlers
  ipcMain.handle(IPC_CHANNELS.AUTH_LOGIN, async (event, credentials) => {
    if (!validateIpcSender(event.sender, allowedWindows())) {
      throw new Error("Unauthorized IPC sender");
    }
    if (!credentials || typeof credentials !== "object") {
      throw new Error("Invalid login payload");
    }
    const email =
      typeof credentials.email === "string" ? credentials.email.trim() : "";
    const password =
      typeof credentials.password === "string" ? credentials.password : "";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Please enter a valid email address");
    }
    if (!password || password.length < PASSWORD_POLICY.minLength) {
      throw new Error(
        `Password must be at least ${PASSWORD_POLICY.minLength} characters long`,
      );
    }
    if (password.length > PASSWORD_POLICY.maxLength) {
      throw new Error(
        `Password must not exceed ${PASSWORD_POLICY.maxLength} characters`,
      );
    }
    const apiBaseUrl =
      process.env["VITE_API_BASE_URL"] || "http://127.0.0.1:3000";
    const res = await fetch(`${apiBaseUrl}/api/v1/auth/desktop-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        deviceName: credentials.deviceName || os.hostname(),
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Login failed");
    }
    const data = await res.json();
    try {
      const { safeStorage } = await import("electron");
      const canEncrypt = await safeStorage.isAsyncEncryptionAvailable();
      if (canEncrypt && data.refreshToken) {
        const encrypted = await safeStorage.encryptStringAsync(
          data.refreshToken,
        );
        const credPath = join(app.getPath("userData"), "session.enc");
        await fs.writeFile(credPath, encrypted);
      }
    } catch {
      // safeStorage fallback
    }
    return {
      user: data.user,
      sessionToken: data.accessToken || data.refreshToken,
      csrfToken: data.csrfToken,
    };
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_REGISTER, async (event, credentials) => {
    if (!validateIpcSender(event.sender, allowedWindows())) {
      throw new Error("Unauthorized IPC sender");
    }
    if (!credentials || typeof credentials !== "object") {
      throw new Error("Invalid registration payload");
    }
    const email =
      typeof credentials.email === "string" ? credentials.email.trim() : "";
    const password =
      typeof credentials.password === "string" ? credentials.password : "";
    const displayName =
      typeof credentials.displayName === "string"
        ? credentials.displayName.trim()
        : undefined;
    const deviceName =
      typeof credentials.deviceName === "string" &&
      credentials.deviceName.trim()
        ? credentials.deviceName.trim()
        : os.hostname();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Please enter a valid email address");
    }
    if (!password || password.length < PASSWORD_POLICY.minLength) {
      throw new Error(
        `Password must be at least ${PASSWORD_POLICY.minLength} characters long`,
      );
    }
    if (password.length > PASSWORD_POLICY.maxLength) {
      throw new Error(
        `Password must not exceed ${PASSWORD_POLICY.maxLength} characters`,
      );
    }

    const apiBaseUrl =
      process.env["VITE_API_BASE_URL"] || "http://127.0.0.1:3000";

    let res: Response;
    try {
      res = await fetch(`${apiBaseUrl}/api/v1/auth/desktop-register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          displayName,
          deviceName,
        }),
      });
    } catch {
      throw new Error(
        "Authentication service is currently unavailable. Please check that the server is running.",
      );
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Registration failed");
    }

    const data = await res.json();
    try {
      const { safeStorage } = await import("electron");
      const canEncrypt = await safeStorage.isAsyncEncryptionAvailable();
      if (canEncrypt && data.refreshToken) {
        const encrypted = await safeStorage.encryptStringAsync(
          data.refreshToken,
        );
        const credPath = join(app.getPath("userData"), "session.enc");
        await fs.writeFile(credPath, encrypted);
      }
    } catch (persistErr) {
      console.warn(
        "[Desktop Auth] Failed to persist secure session:",
        persistErr,
      );
    }

    return {
      user: data.user,
      sessionToken: data.accessToken || data.refreshToken,
      csrfToken: data.csrfToken,
    };
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_LOGOUT, async (event) => {
    if (!validateIpcSender(event.sender, allowedWindows())) {
      throw new Error("Unauthorized IPC sender");
    }
    try {
      const credPath = join(app.getPath("userData"), "session.enc");
      await fs.unlink(credPath).catch(() => {});
    } catch {
      // Ignored
    }
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_GET_STORED_SESSION, async (event) => {
    if (!validateIpcSender(event.sender, allowedWindows())) {
      throw new Error("Unauthorized IPC sender");
    }
    try {
      const credPath = join(app.getPath("userData"), "session.enc");
      const encrypted = await fs.readFile(credPath).catch(() => null);
      if (!encrypted) return null;
      const { safeStorage } = await import("electron");
      const canEncrypt = await safeStorage.isAsyncEncryptionAvailable();
      if (!canEncrypt) return null;
      const decrypted = await safeStorage.decryptStringAsync(encrypted);
      const refreshToken = decrypted.result;
      const apiBaseUrl =
        process.env["VITE_API_BASE_URL"] || "http://127.0.0.1:3000";
      const res = await fetch(`${apiBaseUrl}/api/v1/auth/desktop-refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data.refreshToken) {
        const newEnc = await safeStorage.encryptStringAsync(data.refreshToken);
        await fs.writeFile(credPath, newEnc);
      }
      const meRes = await fetch(`${apiBaseUrl}/api/v1/users/me`, {
        headers: {
          Authorization: `Bearer ${data.accessToken || data.refreshToken}`,
        },
      });
      if (!meRes.ok) return null;
      const meData = await meRes.json();
      return {
        user: meData.user || meData,
        sessionToken: data.accessToken || data.refreshToken,
        csrfToken: data.csrfToken,
      };
    } catch {
      return null;
    }
  });

  // 3. Stage Control Handlers
  ipcMain.handle(IPC_CHANNELS.STAGE_GET_STATUS, (event): StageStatus => {
    if (!validateIpcSender(event.sender, allowedWindows())) {
      throw new Error("Unauthorized IPC sender");
    }
    return { ...stageStatus };
  });

  ipcMain.handle(IPC_CHANNELS.STAGE_GET_CONFIG, (event): AvatarConfig => {
    if (!validateIpcSender(event.sender, allowedWindows())) {
      throw new Error("Unauthorized IPC sender");
    }
    return { ...avatarConfig };
  });

  ipcMain.handle(IPC_CHANNELS.STAGE_GET_BOUNDS, (event): WindowBounds => {
    if (!validateIpcSender(event.sender, allowedWindows())) {
      throw new Error("Unauthorized IPC sender");
    }
    if (stageWindow && !stageWindow.isDestroyed()) {
      const b = stageWindow.getBounds();
      return { x: b.x, y: b.y, width: b.width, height: b.height };
    }
    return {
      x: avatarConfig.stageX ?? 100,
      y: avatarConfig.stageY ?? 100,
      width: avatarConfig.stageWidth || 420,
      height: avatarConfig.stageHeight || 640,
    };
  });

  ipcMain.handle(
    IPC_CHANNELS.STAGE_SET_BOUNDS,
    async (event, newBounds: Partial<WindowBounds>): Promise<WindowBounds> => {
      if (!validateIpcSender(event.sender, allowedWindows())) {
        throw new Error("Unauthorized IPC sender");
      }
      if (!newBounds || typeof newBounds !== "object") {
        throw new Error("Invalid bounds payload");
      }
      if (!stageWindow || stageWindow.isDestroyed()) {
        throw new Error("Stage window is not available");
      }

      const cur = stageWindow.getBounds();
      let targetX = newBounds.x !== undefined ? Number(newBounds.x) : cur.x;
      let targetY = newBounds.y !== undefined ? Number(newBounds.y) : cur.y;
      let targetW =
        newBounds.width !== undefined ? Number(newBounds.width) : cur.width;
      let targetH =
        newBounds.height !== undefined ? Number(newBounds.height) : cur.height;

      if (
        !Number.isFinite(targetX) ||
        !Number.isFinite(targetY) ||
        !Number.isFinite(targetW) ||
        !Number.isFinite(targetH)
      ) {
        throw new Error(
          "Bounds coordinates and dimensions must be finite numbers",
        );
      }

      targetW = Math.max(240, Math.min(3840, Math.round(targetW)));
      targetH = Math.max(320, Math.min(2160, Math.round(targetH)));
      targetX = Math.round(targetX);
      targetY = Math.round(targetY);

      const displays = screen.getAllDisplays().map((d) => ({
        bounds: d.bounds,
        workArea: d.workArea,
      }));

      const validated = validateWindowBounds(
        {
          x: targetX,
          y: targetY,
          width: targetW,
          height: targetH,
        },
        displays,
      );

      stageWindow.setBounds({
        x: validated.x,
        y: validated.y,
        width: validated.width,
        height: validated.height,
      });

      avatarConfig.stageX = validated.x;
      avatarConfig.stageY = validated.y;
      avatarConfig.stageWidth = validated.width;
      avatarConfig.stageHeight = validated.height;

      await savePersistedConfig();

      return {
        x: validated.x,
        y: validated.y,
        width: validated.width,
        height: validated.height,
      };
    },
  );

  ipcMain.handle(IPC_CHANNELS.STAGE_SHOW, (event): StageStatus => {
    if (!validateIpcSender(event.sender, allowedWindows())) {
      throw new Error("Unauthorized IPC sender");
    }
    return showStage();
  });

  ipcMain.handle(IPC_CHANNELS.STAGE_HIDE, (event): StageStatus => {
    if (!validateIpcSender(event.sender, allowedWindows())) {
      throw new Error("Unauthorized IPC sender");
    }
    return hideStage();
  });

  ipcMain.handle(IPC_CHANNELS.STAGE_TOGGLE, (event): StageStatus => {
    if (!validateIpcSender(event.sender, allowedWindows())) {
      throw new Error("Unauthorized IPC sender");
    }
    return toggleStage();
  });

  ipcMain.handle(
    IPC_CHANNELS.STAGE_SET_CLICKTHROUGH,
    (event, enabled: boolean): StageStatus => {
      if (!validateIpcSender(event.sender, allowedWindows())) {
        throw new Error("Unauthorized IPC sender");
      }
      return setClickThrough(enabled);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.STAGE_SET_IGNORE_MOUSE_EVENTS,
    (event, ignore: boolean, forward = true): void => {
      if (!validateIpcSender(event.sender, allowedWindows())) {
        throw new Error("Unauthorized IPC sender");
      }
      if (stageWindow && !stageWindow.isDestroyed()) {
        stageWindow.setIgnoreMouseEvents(Boolean(ignore), {
          forward: Boolean(forward),
        });
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.STAGE_SET_ALWAYSONTOP,
    (event, enabled: boolean): StageStatus => {
      if (!validateIpcSender(event.sender, allowedWindows())) {
        throw new Error("Unauthorized IPC sender");
      }
      return setAlwaysOnTop(enabled);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.STAGE_SET_ANIMATION_PAUSED,
    (event, paused: boolean): StageStatus => {
      if (!validateIpcSender(event.sender, allowedWindows())) {
        throw new Error("Unauthorized IPC sender");
      }
      return setAnimationPaused(paused);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.STAGE_UPDATE_CONFIG,
    async (event, partial: Partial<AvatarConfig>): Promise<AvatarConfig> => {
      if (!validateIpcSender(event.sender, allowedWindows())) {
        throw new Error("Unauthorized IPC sender");
      }

      // Check if avatarPath is switching to a different model
      if (
        partial.avatarPath &&
        partial.avatarPath !== avatarConfig.avatarPath
      ) {
        const key = getAvatarStorageKey(partial.avatarPath);
        const saved = avatarOverrides[key];
        if (saved) {
          avatarConfig.orientationMode = saved.orientationMode ?? "auto";
          avatarConfig.rotationY = saved.rotationY ?? 0;
          avatarConfig.scale = saved.scale ?? 1.0;
        } else {
          avatarConfig.orientationMode = "auto";
          avatarConfig.rotationY = 0;
          avatarConfig.scale = 1.0;
        }
      }

      Object.assign(avatarConfig, partial);

      // Save per-avatar presentation overrides if avatarPath is assigned
      if (avatarConfig.avatarPath) {
        const key = getAvatarStorageKey(avatarConfig.avatarPath);
        const existing = avatarOverrides[key] || {};
        if (partial.orientationMode !== undefined) {
          existing.orientationMode = partial.orientationMode;
        }
        if (partial.rotationY !== undefined) {
          existing.rotationY = partial.rotationY;
        }
        if (partial.scale !== undefined) {
          existing.scale = partial.scale;
        }
        avatarOverrides[key] = existing;
      }

      if (partial.alwaysOnTop !== undefined) {
        setAlwaysOnTop(partial.alwaysOnTop);
      }
      if (partial.clickThrough !== undefined) {
        setClickThrough(partial.clickThrough);
      }
      if (partial.animationPaused !== undefined) {
        setAnimationPaused(partial.animationPaused);
      }
      if (
        (partial.stageWidth !== undefined ||
          partial.stageHeight !== undefined ||
          partial.stageX !== undefined ||
          partial.stageY !== undefined) &&
        stageWindow &&
        !stageWindow.isDestroyed()
      ) {
        const cur = stageWindow.getBounds();
        const nextW = Math.max(
          240,
          Math.min(3840, Math.round(partial.stageWidth ?? cur.width)),
        );
        const nextH = Math.max(
          320,
          Math.min(2160, Math.round(partial.stageHeight ?? cur.height)),
        );
        const nextX = Math.round(partial.stageX ?? cur.x);
        const nextY = Math.round(partial.stageY ?? cur.y);
        stageWindow.setBounds({
          x: nextX,
          y: nextY,
          width: nextW,
          height: nextH,
        });
      }
      await savePersistedConfig();
      broadcastStageConfig();
      return { ...avatarConfig };
    },
  );

  ipcMain.handle(IPC_CHANNELS.STAGE_SELECT_VRM_FILE, async (event) => {
    if (!validateIpcSender(event.sender, allowedWindows())) {
      throw new Error("Unauthorized IPC sender");
    }
    const parent = mainWindow || stageWindow || undefined;
    const res = await dialog.showOpenDialog(parent!, {
      title: "Select VRM Avatar File",
      filters: [{ name: "VRM 3D Avatar (*.vrm)", extensions: ["vrm"] }],
      properties: ["openFile"],
    });

    if (res.canceled || !res.filePaths[0]) {
      return { canceled: true };
    }

    const filePath = res.filePaths[0];
    const fileName = basename(filePath);
    const key = getAvatarStorageKey(filePath);
    const saved = avatarOverrides[key];

    avatarConfig.avatarPath = filePath;
    avatarConfig.avatarName = fileName;

    // Apply per-avatar saved presentation settings or default to auto
    if (saved) {
      avatarConfig.orientationMode = saved.orientationMode ?? "auto";
      avatarConfig.rotationY = saved.rotationY ?? 0;
      avatarConfig.scale = saved.scale ?? 1.0;
    } else {
      avatarConfig.orientationMode = "auto";
      avatarConfig.rotationY = 0;
      avatarConfig.scale = 1.0;
    }

    stageStatus.avatarLoaded = true;
    stageStatus.currentAvatarName = fileName;
    stageStatus.orientationMode = avatarConfig.orientationMode;
    await savePersistedConfig();
    broadcastStageConfig();
    broadcastStageStatus();

    return { canceled: false, filePath, fileName };
  });

  ipcMain.handle(
    IPC_CHANNELS.STAGE_REPORT_MODEL_STATUS,
    async (
      event,
      status: {
        avatarLoaded: boolean;
        currentAvatarName?: string;
        vrmVersion?: string;
        orientationMode?: AvatarOrientationMode;
      },
    ) => {
      if (!validateIpcSender(event.sender, allowedWindows())) {
        throw new Error("Unauthorized IPC sender");
      }
      stageStatus.avatarLoaded = status.avatarLoaded;
      if (status.currentAvatarName) {
        stageStatus.currentAvatarName = status.currentAvatarName;
      }
      if (status.vrmVersion) {
        stageStatus.vrmVersion = status.vrmVersion;
      }
      if (status.orientationMode) {
        stageStatus.orientationMode = status.orientationMode;
      }
      broadcastStageStatus();
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.STAGE_LOAD_VRM_BUFFER,
    async (event, customPath?: string) => {
      if (!validateIpcSender(event.sender, allowedWindows())) {
        throw new Error("Unauthorized IPC sender");
      }
      let targetPath = customPath || avatarConfig.avatarPath;
      if (
        !targetPath &&
        isGuestPreviewAllowed(
          app.isPackaged,
          process.env["YCW_ENABLE_GUEST_PREVIEW"],
        )
      ) {
        const sample = await ensureSampleVrm();
        if (sample.success && sample.filePath) {
          targetPath = sample.filePath;
        }
      }
      if (!targetPath) {
        throw new Error(
          "No avatar file specified and sample model unavailable",
        );
      }

      const buffer = await fs.readFile(targetPath);
      return {
        data: buffer.buffer.slice(
          buffer.byteOffset,
          buffer.byteOffset + buffer.byteLength,
        ),
        name: basename(targetPath),
      };
    },
  );

  ipcMain.handle(IPC_CHANNELS.STAGE_LOAD_DEFAULT_VRM, async (event) => {
    if (!validateIpcSender(event.sender, allowedWindows())) {
      throw new Error("Unauthorized IPC sender");
    }

    const candidates = [
      process.resourcesPath
        ? join(process.resourcesPath, "sample-vrm", "AvatarSample_B.vrm")
        : "",
      join(__dirname, "../../assets/sample-vrm/AvatarSample_B.vrm"),
      join(process.cwd(), "assets", "sample-vrm", "AvatarSample_B.vrm"),
      join(
        process.cwd(),
        "apps",
        "desktop",
        "assets",
        "sample-vrm",
        "AvatarSample_B.vrm",
      ),
      getSampleVrmPath(),
    ].filter(Boolean);

    const maxBytes = 35 * 1024 * 1024;
    for (const candidate of candidates) {
      try {
        const stat = await fs.stat(candidate);
        if (stat.isFile() && stat.size > 1024 && stat.size <= maxBytes) {
          const buffer = await fs.readFile(candidate);
          return {
            data: buffer.buffer.slice(
              buffer.byteOffset,
              buffer.byteOffset + buffer.byteLength,
            ),
            name: basename(candidate),
          };
        }
      } catch {
        // Try next bundled candidate location
      }
    }

    throw new Error("Bundled default VRM model is not available on disk");
  });

  ipcMain.handle(IPC_CHANNELS.STAGE_ENSURE_SAMPLE_VRM, async (event) => {
    if (!validateIpcSender(event.sender, allowedWindows())) {
      throw new Error("Unauthorized IPC sender");
    }
    return await ensureSampleVrm();
  });

  ipcMain.handle(IPC_CHANNELS.STAGE_TRIGGER_TEST_BLINK, async (event) => {
    if (!validateIpcSender(event.sender, allowedWindows())) {
      throw new Error("Unauthorized IPC sender");
    }
    if (stageWindow && !stageWindow.isDestroyed()) {
      stageWindow.webContents.send(IPC_CHANNELS.STAGE_TRIGGER_TEST_BLINK);
      return { success: true };
    }
    return { success: false, error: "Avatar Stage window is not active" };
  });

  ipcMain.handle(
    IPC_CHANNELS.STAGE_GET_BLINK_DIAGNOSTIC,
    (event): BlinkDiagnostic | null => {
      if (!validateIpcSender(event.sender, allowedWindows())) {
        throw new Error("Unauthorized IPC sender");
      }
      return stageStatus.blinkDiagnostic || null;
    },
  );

  // 4. Workspace Window Control Handlers
  ipcMain.handle(IPC_CHANNELS.WORKSPACE_SHOW, (event, tab?: string) => {
    if (!validateIpcSender(event.sender, allowedWindows())) {
      throw new Error("Unauthorized IPC sender");
    }
    showWorkspace(tab);
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_HIDE, (event) => {
    if (!validateIpcSender(event.sender, allowedWindows())) {
      throw new Error("Unauthorized IPC sender");
    }
    hideWorkspace();
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_TOGGLE, (event) => {
    if (!validateIpcSender(event.sender, allowedWindows())) {
      throw new Error("Unauthorized IPC sender");
    }
    toggleWorkspace();
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_SYNC_THEME, (event, theme: unknown) => {
    if (!validateIpcSender(event.sender, allowedWindows())) {
      throw new Error("Unauthorized IPC sender");
    }
    if (theme !== "light" && theme !== "dark") {
      return;
    }
    applyThemeToWorkspaceWindows(theme);
  });

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_GET_STATE,
    (event): WorkspaceWindowState => {
      if (!validateIpcSender(event.sender, allowedWindows())) {
        throw new Error("Unauthorized IPC sender");
      }
      return { ...workspaceState };
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_SYNC_STATE,
    (event, partial: unknown): WorkspaceWindowState => {
      if (!validateIpcSender(event.sender, allowedWindows())) {
        throw new Error("Unauthorized IPC sender");
      }
      if (!partial || typeof partial !== "object") {
        throw new Error("Invalid workspace state payload");
      }
      return syncWorkspaceState(partial as Partial<WorkspaceWindowState>);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_SHOW_MENUBAR,
    (event): WorkspaceWindowState => {
      if (!validateIpcSender(event.sender, allowedWindows())) {
        throw new Error("Unauthorized IPC sender");
      }
      return showMenubar();
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_HIDE_MENUBAR,
    (event): WorkspaceWindowState => {
      if (!validateIpcSender(event.sender, allowedWindows())) {
        throw new Error("Unauthorized IPC sender");
      }
      return hideMenubar();
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_TOGGLE_MENUBAR,
    (event, visible?: unknown): WorkspaceWindowState => {
      if (!validateIpcSender(event.sender, allowedWindows())) {
        throw new Error("Unauthorized IPC sender");
      }
      return toggleMenubar(typeof visible === "boolean" ? visible : undefined);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_SET_MENUBAR_COLLAPSED,
    (event, collapsed: unknown): WorkspaceWindowState => {
      if (!validateIpcSender(event.sender, allowedWindows())) {
        throw new Error("Unauthorized IPC sender");
      }
      if (typeof collapsed !== "boolean") {
        throw new Error("Invalid collapsed flag");
      }
      return setMenubarCollapsed(collapsed);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_SET_MENUBAR_DOCK,
    (event, dock: unknown): WorkspaceWindowState => {
      if (!validateIpcSender(event.sender, allowedWindows())) {
        throw new Error("Unauthorized IPC sender");
      }
      const validDocks = new Set([
        "floating",
        "top",
        "bottom",
        "left",
        "right",
        "top-left",
        "top-right",
        "bottom-left",
        "bottom-right",
      ]);
      if (typeof dock !== "string" || !validDocks.has(dock)) {
        throw new Error("Invalid menubar dock position");
      }
      return setMenubarDock(dock as MenubarDockPosition);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_DRAG_MENUBAR,
    (event, input: unknown): WorkspaceWindowState => {
      if (!validateIpcSender(event.sender, allowedWindows())) {
        throw new Error("Unauthorized IPC sender");
      }
      if (!input || typeof input !== "object") {
        throw new Error("Invalid menubar drag payload");
      }
      const payload = input as Record<string, unknown>;
      if (
        !Number.isFinite(Number(payload.cursorX)) ||
        !Number.isFinite(Number(payload.cursorY)) ||
        !Number.isFinite(Number(payload.grabOffsetX)) ||
        !Number.isFinite(Number(payload.grabOffsetY))
      ) {
        throw new Error("Invalid drag coordinates");
      }
      return dragMenubar({
        cursorX: Number(payload.cursorX),
        cursorY: Number(payload.cursorY),
        grabOffsetX: Number(payload.grabOffsetX),
        grabOffsetY: Number(payload.grabOffsetY),
      });
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_SHOW_PANEL,
    (event, tab?: unknown): WorkspaceWindowState => {
      if (!validateIpcSender(event.sender, allowedWindows())) {
        throw new Error("Unauthorized IPC sender");
      }
      return showPanel(typeof tab === "string" ? tab : undefined);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_HIDE_PANEL,
    (event): WorkspaceWindowState => {
      if (!validateIpcSender(event.sender, allowedWindows())) {
        throw new Error("Unauthorized IPC sender");
      }
      return hidePanel();
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_TOGGLE_PANEL,
    (event, visible?: unknown): WorkspaceWindowState => {
      if (!validateIpcSender(event.sender, allowedWindows())) {
        throw new Error("Unauthorized IPC sender");
      }
      return togglePanel(typeof visible === "boolean" ? visible : undefined);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_NAVIGATE_TAB,
    (event, tab: unknown): WorkspaceWindowState => {
      if (!validateIpcSender(event.sender, allowedWindows())) {
        throw new Error("Unauthorized IPC sender");
      }
      if (typeof tab !== "string" || !tab.trim()) {
        throw new Error("Invalid tab identifier");
      }
      return navigateWorkspaceTab(tab.trim());
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_RESET_LAYOUT,
    (event): WorkspaceWindowState => {
      if (!validateIpcSender(event.sender, allowedWindows())) {
        throw new Error("Unauthorized IPC sender");
      }
      return resetWorkspaceLayout();
    },
  );

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_MINIMIZE_WINDOW, (event): void => {
    if (!validateIpcSender(event.sender, allowedWindows())) {
      throw new Error("Unauthorized IPC sender");
    }
    const senderWin = BrowserWindow.fromWebContents(event.sender);
    if (senderWin && !senderWin.isDestroyed()) {
      senderWin.minimize();
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_TOGGLE_MAXIMIZE_WINDOW,
    (event): void => {
      if (!validateIpcSender(event.sender, allowedWindows())) {
        throw new Error("Unauthorized IPC sender");
      }
      const senderWin = BrowserWindow.fromWebContents(event.sender);
      if (senderWin && !senderWin.isDestroyed()) {
        if (senderWin.isMaximized()) {
          senderWin.unmaximize();
        } else {
          senderWin.maximize();
        }
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_GET_WINDOW_BOUNDS,
    (event): WindowBounds => {
      if (!validateIpcSender(event.sender, allowedWindows())) {
        throw new Error("Unauthorized IPC sender");
      }
      const senderWin = BrowserWindow.fromWebContents(event.sender);
      if (senderWin && !senderWin.isDestroyed()) {
        const b = senderWin.getBounds();
        return { x: b.x, y: b.y, width: b.width, height: b.height };
      }
      return {
        x: workspaceBounds.x ?? 100,
        y: workspaceBounds.y ?? 100,
        width: workspaceBounds.width,
        height: workspaceBounds.height,
      };
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_SET_WINDOW_BOUNDS,
    (event, partial: Partial<WindowBounds>): WindowBounds => {
      if (!validateIpcSender(event.sender, allowedWindows())) {
        throw new Error("Unauthorized IPC sender");
      }
      const senderWin = BrowserWindow.fromWebContents(event.sender);
      if (!senderWin || senderWin.isDestroyed()) {
        throw new Error("Workspace window not found");
      }
      const isMenubar = menubarWindow !== null && senderWin === menubarWindow;
      const cur = senderWin.getBounds();
      const minW = isMenubar ? 68 : 540;
      const maxW = isMenubar ? 320 : 3840;
      const minH = isMenubar ? 420 : 440;
      const maxH = 2160;
      const nextBounds: WindowBounds = {
        x: typeof partial.x === "number" ? Math.round(partial.x) : cur.x,
        y: typeof partial.y === "number" ? Math.round(partial.y) : cur.y,
        width: Math.max(
          minW,
          Math.min(
            maxW,
            typeof partial.width === "number"
              ? Math.round(partial.width)
              : cur.width,
          ),
        ),
        height: Math.max(
          minH,
          Math.min(
            maxH,
            typeof partial.height === "number"
              ? Math.round(partial.height)
              : cur.height,
          ),
        ),
      };
      senderWin.setBounds(nextBounds);
      updatePlatformGlassRegion(senderWin, 24);
      sendWindowBackdropUpdate(
        senderWin,
        IPC_CHANNELS.WORKSPACE_BACKDROP_CHANGED,
      );
      return nextBounds;
    },
  );

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_GET_BACKDROP, async (event) => {
    if (!validateIpcSender(event.sender, allowedWindows())) {
      throw new Error("Unauthorized IPC sender");
    }
    const senderWin = BrowserWindow.fromWebContents(event.sender);
    if (!senderWin || senderWin.isDestroyed()) {
      return null;
    }
    await refreshDesktopWallpaperCache();
    return buildWindowBackdropInfo(senderWin, true);
  });
}

let embeddedAuthServer: import("node:http").Server | null = null;

async function verifyRunningAuthServer(port: number): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/health`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return false;
    const data = (await res.json().catch(() => ({}))) as {
      status?: string;
      version?: string;
    };
    return (
      data &&
      data.status === "healthy" &&
      typeof data.version === "string" &&
      data.version.length > 0
    );
  } catch {
    return false;
  }
}

async function startEmbeddedAuthServer(): Promise<void> {
  try {
    const { getDatabase } = await import("../server/database.js");
    const { createServer } = await import("../server/server.js");
    const { initMasterKey } = await import("../server/crypto.js");
    await initMasterKey(app.getPath("userData")).catch((err) => {
      console.warn("[Crypto] Master key init:", err.message);
    });
    const db = getDatabase();
    const desktopCorsOrigins = [
      "http://localhost:5173",
      "http://localhost:4173",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:4173",
      "file://",
      "null",
      "vscode-webview://",
      "https://vrm.app",
      "https://app.vrm.app",
    ];
    const server = createServer({ db, corsOrigins: desktopCorsOrigins });
    const port = parseInt(process.env["AUTH_PORT"] || "3000", 10);
    await new Promise<void>((resolve) => {
      server.listen(port, "127.0.0.1", () => {
        embeddedAuthServer = server;
        const addr = server.address() as { port: number };
        const activePort = addr?.port ?? port;
        process.env["VITE_API_BASE_URL"] = `http://127.0.0.1:${activePort}`;
        console.log(
          `[Desktop Auth Server] Listening on http://127.0.0.1:${activePort}`,
        );
        resolve();
      });
      server.on("error", async (err: any) => {
        if (err.code === "EADDRINUSE") {
          console.log(
            `[Desktop Auth Server] Port ${port} in use; verifying running instance...`,
          );
          const isHealthy = await verifyRunningAuthServer(port);
          if (isHealthy) {
            console.log(
              `[Desktop Auth Server] Verified compatible running auth service on port ${port}`,
            );
            process.env["VITE_API_BASE_URL"] = `http://127.0.0.1:${port}`;
            resolve();
            return;
          }

          console.warn(
            `[Desktop Auth Server] Port ${port} is occupied by an incompatible process. Relocating to dynamic port...`,
          );
          const fallbackServer = createServer({
            db,
            corsOrigins: desktopCorsOrigins,
          });
          fallbackServer.listen(0, "127.0.0.1", () => {
            embeddedAuthServer = fallbackServer;
            const fallbackAddr = fallbackServer.address() as { port: number };
            const fallbackPort = fallbackAddr?.port;
            process.env["VITE_API_BASE_URL"] =
              `http://127.0.0.1:${fallbackPort}`;
            console.log(
              `[Desktop Auth Server] Relocated to dynamic port http://127.0.0.1:${fallbackPort}`,
            );
            resolve();
          });
          fallbackServer.on("error", (fallbackErr) => {
            console.error(
              "[Desktop Auth Server] Dynamic port allocation failed:",
              fallbackErr,
            );
            resolve();
          });
        } else {
          console.warn("[Desktop Auth Server] Start notice:", err);
          resolve();
        }
      });
    });
  } catch (err) {
    console.warn(
      "[Desktop Auth Server] Could not initialize embedded server:",
      err,
    );
  }
}

// Single instance lock
const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    showWorkspace();
  });

  app.whenReady().then(async () => {
    configureSessionSecurity();
    await loadPersistedConfig();
    await refreshDesktopWallpaperCache(true);
    await startEmbeddedAuthServer();
    registerIpcHandlers();
    createSystemTray();
    registerGlobalShortcuts();

    // Create main workspace
    createWorkspaceWindow();

    // Refresh rounded glass regions automatically if monitor DPI/scaling changes
    screen.on("display-metrics-changed", () => {
      updatePlatformGlassRegion(mainWindow, 24);
      updatePlatformGlassRegion(
        menubarWindow,
        24,
        workspaceState.menubarDock || "floating",
      );
      sendWindowBackdropUpdate(
        mainWindow,
        IPC_CHANNELS.WORKSPACE_BACKDROP_CHANGED,
      );
      sendWindowBackdropUpdate(
        menubarWindow,
        IPC_CHANNELS.WORKSPACE_BACKDROP_CHANGED,
      );
    });

    // Respect saved startup preference for Avatar Stage
    if (avatarConfig.showStageOnStartup) {
      createStageWindow();
    }

    app.on("activate", () => {
      showWorkspace();
    });
  });

  app.on("window-all-closed", () => {
    // Intentionally keep application running in system tray unless user explicitly quit
  });

  app.on("will-quit", () => {
    stopCursorTracking();
    disposePlatformGlass();
    globalShortcut.unregisterAll();
    if (embeddedAuthServer) {
      try {
        embeddedAuthServer.close();
      } catch {}
      embeddedAuthServer = null;
    }
  });
}
