/**
 * Visual verification script for Avatar Stage human-like blinking:
 * Boots the built Electron stage window, loads AvatarSample_B.vrm,
 * captures screenshot with eyes open, triggers Test Blink, captures eyes closed,
 * and captures eyes reopened.
 */
process.env.YCW_ENABLE_GUEST_PREVIEW = "1";

const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

app.commandLine.appendSwitch("disable-gpu-sandbox");
app.commandLine.appendSwitch("no-sandbox");

const log = (...args) => console.log("[BLINK-VERIFY]", ...args);

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
      autoBlinkEnabled: true,
      rotationY: 0,
    }));

    ipcMain.handle("stage:get-status", () => ({
      stageVisible: true,
      clickThrough: false,
      alwaysOnTop: true,
      animationPaused: false,
      avatarLoaded: true,
      currentAvatarName: "AvatarSample_B.vrm",
      vrmVersion: "1.0",
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
      backgroundColor: "#111827",
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

    // 1. Wait for model load and initial render
    log("Waiting for Three.js render loop to stabilize (2.0s)...");
    await new Promise((r) => setTimeout(r, 2000));

    // 2. Check toolbar elements
    const hasTestBlinkBtn = await stageWin.webContents.executeJavaScript(
      "document.querySelector('#btn-test-blink') !== null"
    );
    log("Has #btn-test-blink in toolbar:", hasTestBlinkBtn);
    if (!hasTestBlinkBtn) {
      throw new Error("Missing #btn-test-blink in stage.html toolbar");
    }

    // 3. Capture screenshot: Eyes Open
    log("Capturing 1/3: Eyes Open...");
    const openImg = await stageWin.webContents.capturePage();
    const openPath = path.resolve(__dirname, "../../stage-blink-open.png");
    fs.writeFileSync(openPath, openImg.toPNG());
    log("Saved:", openPath);

    // 4. Trigger Test Blink via clicking #btn-test-blink in DOM
    log("Clicking #btn-test-blink to trigger eye closure...");
    await stageWin.webContents.executeJavaScript(
      "document.querySelector('#btn-test-blink').click()"
    );

    // 5. Wait 95ms (closing duration is ~70ms, so 95ms puts us in the fully Closed phase)
    await new Promise((r) => setTimeout(r, 95));

    // 6. Capture screenshot: Eyes Closed
    log("Capturing 2/3: Eyes Closed...");
    const closedImg = await stageWin.webContents.capturePage();
    const closedPath = path.resolve(__dirname, "../../stage-blink-closed.png");
    fs.writeFileSync(closedPath, closedImg.toPNG());
    log("Saved:", closedPath);

    // 7. Wait 220ms (Opening duration is ~110ms, so 220ms ensures eyes are fully reopened)
    await new Promise((r) => setTimeout(r, 220));

    // 8. Capture screenshot: Eyes Reopened
    log("Capturing 3/3: Eyes Reopened...");
    const reopenedImg = await stageWin.webContents.capturePage();
    const reopenedPath = path.resolve(__dirname, "../../stage-blink-reopened.png");
    fs.writeFileSync(reopenedPath, reopenedImg.toPNG());
    log("Saved:", reopenedPath);

    stageWin.destroy();
    log("=== VISUAL BLINK VERIFICATION COMPLETE ===");
    process.exit(0);
  } catch (err) {
    console.error("[BLINK VERIFY ERROR]", err);
    process.exit(1);
  }
});
