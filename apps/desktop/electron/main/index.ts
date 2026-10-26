import {
  app,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  globalShortcut,
  dialog,
  nativeImage,
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
  type WindowBounds,
  type GazeData,
} from "@vrm/platform-contracts";
import {
  APP_METADATA,
  DEFAULT_AVATAR_CONFIG,
  DEFAULT_WORKSPACE_BOUNDS,
  INITIAL_STAGE_STATUS,
} from "@vrm/shared";
import {
  configureSessionSecurity,
  enforceWindowSecurity,
  validateIpcSender,
} from "./security.js";
import { validateWindowBounds } from "./bounds.js";
import { ensureSampleVrm } from "./sample-vrm.js";
import { isGuestPreviewAllowed } from "./guest-preview.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Windows & Lifecycle References
let mainWindow: BrowserWindow | null = null;
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
let stageStatus: StageStatus = { ...INITIAL_STAGE_STATUS };

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
    }
  } catch {
    avatarConfig = { ...DEFAULT_AVATAR_CONFIG };
    workspaceBounds = { ...DEFAULT_WORKSPACE_BOUNDS };
    avatarOverrides = {};
  }
}

async function savePersistedConfig(): Promise<void> {
  try {
    const payload = {
      avatarConfig,
      workspaceBounds,
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

function broadcastStageStatus(): void {
  const allowed = [mainWindow, stageWindow];
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
  const allowed = [mainWindow, stageWindow];
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
    return mainWindow;
  }

  const displays = screen.getAllDisplays().map((d) => ({
    bounds: d.bounds,
    workArea: d.workArea,
  }));

  const initialWidth = workspaceBounds.width || 1100;
  const initialHeight = workspaceBounds.height || 740;

  let validatedX = workspaceBounds.x;
  let validatedY = workspaceBounds.y;

  // Center on primary display if no previous coordinates
  if (typeof validatedX !== "number" || typeof validatedY !== "number") {
    const primary = displays[0]?.workArea || {
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
    };
    validatedX = Math.round(primary.x + (primary.width - initialWidth) / 2);
    validatedY = Math.round(primary.y + (primary.height - initialHeight) / 2);
  }

  const bounds = validateWindowBounds(
    {
      x: validatedX,
      y: validatedY,
      width: initialWidth,
      height: initialHeight,
    },
    displays,
  );

  mainWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: 800,
    minHeight: 560,
    title: APP_METADATA.name,
    backgroundColor: "#0d0e12",
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

  enforceWindowSecurity(mainWindow);

  const devUrl = process.env["VITE_DEV_SERVER_URL"];
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(join(__dirname, "../../dist/index.html"));
  }

  if (workspaceBounds.isMaximized) {
    mainWindow.maximize();
  }

  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  // Track normal bounds without overwriting during maximization
  mainWindow.on("resize", () => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isMaximized()) {
      const size = mainWindow.getSize();
      if (typeof size[0] === "number") workspaceBounds.width = size[0];
      if (typeof size[1] === "number") workspaceBounds.height = size[1];
      savePersistedConfig();
    }
  });

  mainWindow.on("move", () => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isMaximized()) {
      const pos = mainWindow.getPosition();
      if (typeof pos[0] === "number" && typeof pos[1] === "number") {
        workspaceBounds.x = pos[0];
        workspaceBounds.y = pos[1];
        savePersistedConfig();
      }
    }
  });

  mainWindow.on("maximize", () => {
    workspaceBounds.isMaximized = true;
    savePersistedConfig();
  });

  mainWindow.on("unmaximize", () => {
    workspaceBounds.isMaximized = false;
    savePersistedConfig();
  });

  return mainWindow;
}

function createStageWindow(): BrowserWindow {
  if (stageWindow && !stageWindow.isDestroyed()) {
    stageWindow.show();
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
    title: "Avatar Stage",
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: false,
    alwaysOnTop: avatarConfig.alwaysOnTop !== false,
    resizable: true,
    skipTaskbar: false,
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

function showWorkspace(targetTab?: string): void {
  const win = createWorkspaceWindow();
  if (targetTab && !win.isDestroyed()) {
    win.webContents.send("app:navigate-tab", targetTab);
  }
}

function hideWorkspace(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide();
  }
}

function toggleWorkspace(): void {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    showWorkspace();
  }
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
    stageWindow.setAlwaysOnTop(enabled);
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
  globalShortcut.unregisterAll();
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

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open Workspace",
      click: () => showWorkspace(),
    },
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
    { type: "separator" },
    {
      label: "Avatar Settings",
      click: () => showWorkspace("avatar"),
    },
    {
      label: "Application Settings",
      click: () => showWorkspace("settings"),
    },
    { type: "separator" },
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
  } catch (err) {
    console.warn("Failed to register some global shortcuts:", err);
  }
}

// --- IPC Handlers ---

function registerIpcHandlers(): void {
  const allowedWindows = () => [mainWindow, stageWindow];

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

  // 2. Auth IPC Handlers
  ipcMain.handle(IPC_CHANNELS.AUTH_LOGIN, async (event, credentials) => {
    if (!validateIpcSender(event.sender, allowedWindows())) {
      throw new Error("Unauthorized IPC sender");
    }
    const apiBaseUrl =
      process.env["VITE_API_BASE_URL"] || "http://127.0.0.1:3000";
    const res = await fetch(`${apiBaseUrl}/api/v1/auth/desktop-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: credentials.email,
        password: credentials.password,
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
      if (safeStorage.isEncryptionAvailable() && data.refreshToken) {
        const encrypted = safeStorage.encryptString(data.refreshToken);
        const credPath = join(app.getPath("userData"), "session.enc");
        await fs.writeFile(credPath, encrypted);
      }
    } catch {
      // safeStorage fallback
    }
    return { user: data.user };
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
      if (!safeStorage.isEncryptionAvailable()) return null;
      const refreshToken = safeStorage.decryptString(encrypted);
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
        const newEnc = safeStorage.encryptString(data.refreshToken);
        await fs.writeFile(credPath, newEnc);
      }
      const meRes = await fetch(`${apiBaseUrl}/api/v1/users/me`, {
        headers: {
          Authorization: `Bearer ${data.accessToken || data.refreshToken}`,
        },
      });
      if (!meRes.ok) return null;
      return await meRes.json();
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
}

let embeddedAuthServer: import("node:http").Server | null = null;

async function startEmbeddedAuthServer(): Promise<void> {
  try {
    const { getDatabase } = await import("../server/database.js");
    const { createServer } = await import("../server/server.js");
    const db = getDatabase();
    const server = createServer({ db });
    const port = parseInt(process.env["AUTH_PORT"] || "3000", 10);
    await new Promise<void>((resolve) => {
      server.listen(port, "127.0.0.1", () => {
        embeddedAuthServer = server;
        console.log(
          `[Desktop Auth Server] Listening on http://127.0.0.1:${port}`,
        );
        resolve();
      });
      server.on("error", (err: any) => {
        if (err.code === "EADDRINUSE") {
          console.log(
            `[Desktop Auth Server] Port ${port} in use; using running instance`,
          );
        } else {
          console.warn("[Desktop Auth Server] Start notice:", err);
        }
        resolve();
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
    await startEmbeddedAuthServer();
    registerIpcHandlers();
    createSystemTray();
    registerGlobalShortcuts();

    // Create main workspace
    createWorkspaceWindow();

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
    globalShortcut.unregisterAll();
    if (embeddedAuthServer) {
      try {
        embeddedAuthServer.close();
      } catch {}
      embeddedAuthServer = null;
    }
  });
}
