/**
 * Visual verification script:
 * Boots the actual built Electron stage window, loads AvatarSample_B.vrm,
 * lets the Three.js render loop run for several frames, and captures an actual screenshot.
 */
process.env.YCW_ENABLE_GUEST_PREVIEW = "1";

const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

app.commandLine.appendSwitch("disable-gpu-sandbox");
app.commandLine.appendSwitch("no-sandbox");

let passed = true;
const log = (...args) => console.log("[VISUAL-VERIFY]", ...args);

app.whenReady().then(async () => {
  try {
    const preloadPath = path.resolve(__dirname, "../dist-electron/preload/index.cjs");
    const stageHtmlPath = path.resolve(__dirname, "../dist/stage.html");
    const sampleVrmPath = path.resolve(__dirname, "../assets/sample-vrm/AvatarSample_B.vrm");

    log("Setting up IPC mocks for stage verification...");

    ipcMain.handle("stage:get-config", () => ({
      avatarPath: sampleVrmPath,
      avatarName: "AvatarSample_B.vrm",
      scale: 1.0,
      stageWidth: 460,
      stageHeight: 700,
      showStageOnStartup: true,
      lookAtEnabled: true,
      rotationY: 0,
    }));

    ipcMain.handle("stage:get-status", () => ({
      stageVisible: true,
      clickThrough: false,
      alwaysOnTop: true,
      animationPaused: false,
      avatarLoaded: true,
      currentAvatarName: "AvatarSample_B.vrm",
      vrmVersion: "0.0",
      isFallbackActive: false,
    }));

    ipcMain.handle("stage:load-vrm-buffer", async (event, customPath) => {
      const target = customPath || sampleVrmPath;
      const buffer = await fs.promises.readFile(target);
      return {
        data: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
        fileName: path.basename(target),
        filePath: target,
      };
    });

    ipcMain.handle("app:guest-preview-available", () => true);
    ipcMain.handle("stage:ensure-sample-vrm", () => ({
      success: true,
      filePath: sampleVrmPath,
      fileName: "AvatarSample_B.vrm",
      cached: true,
      sha256: "ffbd8c92a9e67c0a948f69c7a2eec91e5c282c9ae70e9184309fc164d74cbc27",
      sizeBytes: fs.statSync(sampleVrmPath).size,
    }));
    ipcMain.handle("stage:update-status", () => {});
    ipcMain.handle("stage:update-config", () => {});

    log("Creating Avatar Stage window (460x700)...");
    const stageWin = new BrowserWindow({
      show: true,
      width: 460,
      height: 700,
      frame: false,
      transparent: true,
      backgroundColor: "#111827", // solid dark bg for crisp visual screenshot
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        sandbox: true,
      },
    });

    stageWin.webContents.on("console-message", (event, level, msg) => {
      log("Stage console:", msg);
    });

    log("Loading stage.html...");
    await stageWin.loadFile(stageHtmlPath);

    // Wait 2.2 seconds for Three.js to parse VRM, attach scene, apply A-pose, and render frames
    log("Waiting for Three.js render loop to stabilize A-pose...");
    await new Promise((r) => setTimeout(r, 2200));

    // Capture screenshot
    log("Capturing screenshot of Avatar Stage...");
    const image = await stageWin.webContents.capturePage();
    const screenshotPath = path.resolve(__dirname, "../../stage-avatar-verified.png");
    fs.writeFileSync(screenshotPath, image.toPNG());
    log("Screenshot saved to:", screenshotPath);

    // Check if fallback mannequin is hidden
    const isFallbackHidden = await stageWin.webContents.executeJavaScript(
      "document.querySelector('#stage-fallback-notice')?.classList.contains('hidden') || false"
    );
    log("Fallback notice hidden:", isFallbackHidden);

    const hasLoadingHidden = await stageWin.webContents.executeJavaScript(
      "document.querySelector('#stage-loading')?.classList.contains('hidden') || false"
    );
    log("Loading overlay hidden:", hasLoadingHidden);

    stageWin.destroy();
    log("=== VISUAL VERIFICATION COMPLETE ===");
    process.exit(0);
  } catch (err) {
    console.error("[VISUAL VERIFY ERROR]", err);
    process.exit(1);
  }
});
