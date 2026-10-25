/**
 * Electron Real Runtime Guest Preview Smoke Test
 * Tests running with YCW_ENABLE_GUEST_PREVIEW=1 in development mode.
 */
process.env.YCW_ENABLE_GUEST_PREVIEW = "1";

const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

let passed = true;
const log = (...args) => console.log("[GUEST-SMOKE]", ...args);
const error = (...args) => {
  passed = false;
  console.error("[GUEST-SMOKE ERROR]", ...args);
};

const timeout = setTimeout(() => {
  error("Guest smoke test timed out after 15 seconds");
  process.exit(1);
}, 15000);

app.whenReady().then(async () => {
  try {
    log("Verifying Guest Preview in Electron runtime...");
    const preloadPath = path.resolve(__dirname, "../dist-electron/preload/index.cjs");
    const indexPath = path.resolve(__dirname, "../dist/index.html");

    // Register test IPC handler for GUEST_PREVIEW_AVAILABLE
    ipcMain.handle("app:guest-preview-available", () => {
      return !app.isPackaged && process.env.YCW_ENABLE_GUEST_PREVIEW === "1";
    });
    ipcMain.handle("app:auth-get-stored-session", () => null);
    ipcMain.handle("stage:get-status", () => ({
      stageVisible: false,
      clickThrough: false,
      alwaysOnTop: true,
      animationPaused: false,
      avatarLoaded: false,
      currentAvatarName: null,
      vrmVersion: null,
      isFallbackActive: true,
    }));
    ipcMain.handle("stage:get-config", () => ({
      avatarPath: "",
      avatarName: "Mannequin Fallback",
      scale: 1.0,
      stageWidth: 420,
      stageHeight: 640,
      showStageOnStartup: false,
      lookAtEnabled: true,
    }));
    ipcMain.handle("stage:show", () => ({
      stageVisible: true,
      clickThrough: false,
      alwaysOnTop: true,
      animationPaused: false,
      avatarLoaded: false,
      currentAvatarName: null,
      vrmVersion: null,
      isFallbackActive: true,
    }));
    ipcMain.handle("stage:ensure-sample-vrm", () => {
      const samplePath = path.resolve(__dirname, "../assets/sample-vrm/AvatarSample_B.vrm");
      const exists = fs.existsSync(samplePath);
      return {
        success: exists,
        filePath: samplePath,
        fileName: "AvatarSample_B.vrm",
        cached: true,
        sha256: "ffbd8c92a9e67c0a948f69c7a2eec91e5c282c9ae70e9184309fc164d74cbc27",
        sizeBytes: exists ? fs.statSync(samplePath).size : 0,
      };
    });

    const win = new BrowserWindow({
      show: false,
      width: 1100,
      height: 740,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        sandbox: true,
      },
    });

    await win.loadFile(indexPath);
    await new Promise((r) => setTimeout(r, 800));

    // 1. Verify Guest Preview is reported as available
    const isAvailable = await win.webContents.executeJavaScript(
      "window.desktopAPI.isGuestPreviewAvailable()"
    );
    log("isGuestPreviewAvailable returned:", isAvailable);
    if (isAvailable !== true) {
      error("FAILED: isGuestPreviewAvailable() did not return true with YCW_ENABLE_GUEST_PREVIEW=1");
    }

    // 2. Verify button is present in the DOM
    const hasGuestBtn = await win.webContents.executeJavaScript(
      "document.querySelector('#signin-guest-btn') !== null"
    );
    log("#signin-guest-btn present in DOM:", hasGuestBtn);
    if (!hasGuestBtn) {
      error("FAILED: #signin-guest-btn not rendered in DOM!");
    }

    // 3. Click the guest button
    log("Clicking #signin-guest-btn...");
    await win.webContents.executeJavaScript(
      "document.querySelector('#signin-guest-btn').click()"
    );
    await new Promise((r) => setTimeout(r, 600));

    // 4. Verify transition to Avatar Settings and presence of Guest Preview banner
    const pageText = await win.webContents.executeJavaScript(
      "document.body.innerText"
    );
    const hasGuestBanner = pageText.includes("GUEST PREVIEW");
    const hasAvatarHeader = pageText.includes("Avatar & Stage Configuration");
    log("Guest banner rendered:", hasGuestBanner);
    log("Avatar configuration header rendered:", hasAvatarHeader);

    if (!hasGuestBanner || !hasAvatarHeader) {
      error("FAILED: Guest preview did not transition to Avatar Settings view!");
    }

    // 5. Verify presence of model controls
    const hasLoadSampleBtn = await win.webContents.executeJavaScript(
      "document.querySelector('#avatar-load-sample-btn') !== null"
    );
    const hasSelectLocalBtn = await win.webContents.executeJavaScript(
      "document.querySelector('#avatar-select-file-btn') !== null"
    );
    log("#avatar-load-sample-btn present:", hasLoadSampleBtn);
    log("#avatar-select-file-btn present:", hasSelectLocalBtn);
    if (!hasLoadSampleBtn || !hasSelectLocalBtn) {
      error("FAILED: Avatar settings missing model load buttons!");
    }

    clearTimeout(timeout);
    win.destroy();

    if (passed) {
      log("=== GUEST PREVIEW ELECTRON RUNTIME SMOKE TEST PASSED ===");
      process.exit(0);
    } else {
      log("=== GUEST PREVIEW ELECTRON RUNTIME SMOKE TEST FAILED ===");
      process.exit(1);
    }
  } catch (err) {
    error("Unexpected error in guest smoke test:", err);
    clearTimeout(timeout);
    process.exit(1);
  }
});
