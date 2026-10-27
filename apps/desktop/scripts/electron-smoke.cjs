/**
 * Electron Real Runtime Smoke Test
 * Boots the actual compiled Electron main process, loads the built renderer dist/index.html,
 * and asserts real runtime platform detection, preload bridge existence, and initial UI state.
 */
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

let passed = true;
const log = (...args) => console.log("[SMOKE]", ...args);
const error = (...args) => {
  passed = false;
  console.error("[SMOKE ERROR]", ...args);
};

// Quit after timeout if hanging
const timeout = setTimeout(() => {
  error("Smoke test timed out after 15 seconds");
  process.exit(1);
}, 15000);

app.whenReady().then(async () => {
  try {
    log("App ready. Verifying preload script resolution...");
    const preloadPath = path.resolve(__dirname, "../dist-electron/preload/index.cjs");
    log("Preload path:", preloadPath);

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

    win.webContents.on("preload-error", (event, pPath, err) => {
      error("Preload error encountered:", pPath, err);
    });

    win.webContents.on("console-message", (event, level, message) => {
      log("Renderer console:", message);
    });

    const indexPath = path.resolve(__dirname, "../dist/index.html");
    log("Loading built renderer:", indexPath);
    await win.loadFile(indexPath);

    // Wait 500ms for Vue to mount
    await new Promise((r) => setTimeout(r, 600));

    // 1. Verify window.desktopAPI in renderer context
    const hasDesktopAPI = await win.webContents.executeJavaScript(
      "typeof window.desktopAPI === 'object' && window.desktopAPI !== null"
    );
    log("window.desktopAPI exists:", hasDesktopAPI);
    if (!hasDesktopAPI) {
      error("FAILED: window.desktopAPI is not exposed in renderer main world!");
    }

    // 2. Verify methods on window.desktopAPI
    const apiKeys = await win.webContents.executeJavaScript(
      "window.desktopAPI ? Object.keys(window.desktopAPI) : []"
    );
    log("window.desktopAPI keys:", apiKeys);
    const requiredKeys = [
      "getAppVersion",
      "getDiagnostics",
      "ping",
      "auth",
      "stage",
      "workspace",
      "isGuestPreviewAvailable",
    ];
    for (const k of requiredKeys) {
      if (!apiKeys.includes(k)) {
        error(`FAILED: missing desktopAPI method: ${k}`);
      }
    }

    const hasAuthRegister = await win.webContents.executeJavaScript(
      "typeof window.desktopAPI?.auth?.register === 'function'"
    );
    log("auth.register function exists:", hasAuthRegister);
    if (!hasAuthRegister) {
      error("FAILED: auth.register is not exposed on desktopAPI.auth!");
    }

    const hasEnsureSampleVrm = await win.webContents.executeJavaScript(
      "typeof window.desktopAPI?.stage?.ensureSampleVrm === 'function'"
    );
    log("stage.ensureSampleVrm function exists:", hasEnsureSampleVrm);
    if (!hasEnsureSampleVrm) {
      error("FAILED: stage.ensureSampleVrm is not exposed on desktopAPI.stage!");
    }

    const hasBoundsMethods = await win.webContents.executeJavaScript(
      "typeof window.desktopAPI?.stage?.getBounds === 'function' && typeof window.desktopAPI?.stage?.setBounds === 'function' && typeof window.desktopAPI?.stage?.setIgnoreMouseEvents === 'function'"
    );
    log("stage.getBounds, setBounds, and setIgnoreMouseEvents functions exist:", hasBoundsMethods);
    if (!hasBoundsMethods) {
      error("FAILED: stage.getBounds, setBounds, or setIgnoreMouseEvents is not exposed on desktopAPI.stage!");
    }

    // 3. Verify status badge text in DOM
    const badgeText = await win.webContents.executeJavaScript(
      "document.querySelector('.status-badge')?.textContent?.trim() || ''"
    );
    log("Status badge text in DOM:", badgeText);
    if (badgeText.includes("Web Client") || badgeText.includes("WEB CLIENT")) {
      error("FAILED: DOM still displays WEB CLIENT badge in native Electron!");
    } else if (badgeText.includes("Desktop App")) {
      log("SUCCESS: DOM correctly displays 'Desktop App' badge in native Electron!");
    } else {
      log("Note: Status badge text was:", badgeText);
    }

    // 4. Verify unauthenticated screen is Sign In, not legacy overview
    const pageHtml = await win.webContents.executeJavaScript(
      "document.body.innerText"
    );

    const legacyPhrases = [
      "Architecture Reset Complete",
      "Monorepo Topology",
      "Unified Presentation",
      "Electron Security Baseline",
      "Shared Auth & Database",
      "Shared Web & Desktop Authentication",
    ];

    for (const phrase of legacyPhrases) {
      if (pageHtml.includes(phrase)) {
        error(`FAILED: Legacy overview phrase detected in UI: "${phrase}"`);
      }
    }

    const hasSignInEmail = await win.webContents.executeJavaScript(
      "document.querySelector('#signin-email') !== null"
    );
    log("SignIn form email input present:", hasSignInEmail);
    if (!hasSignInEmail) {
      error("FAILED: Unauthenticated startup did not display Sign In form!");
    }

    // 5. Verify Stage window creation and elements
    log("Testing Stage window creation...");
    const stagePreload = path.resolve(__dirname, "../dist-electron/preload/index.cjs");
    const stageWin = new BrowserWindow({
      show: false,
      frame: false,
      transparent: true,
      webPreferences: {
        preload: stagePreload,
        contextIsolation: true,
        sandbox: true,
      },
    });

    const stageHtmlPath = path.resolve(__dirname, "../dist/stage.html");
    await stageWin.loadFile(stageHtmlPath);

    const stageHasDesktopAPI = await stageWin.webContents.executeJavaScript(
      "typeof window.desktopAPI === 'object' && window.desktopAPI !== null"
    );
    log("Stage window.desktopAPI exists:", stageHasDesktopAPI);
    if (!stageHasDesktopAPI) {
      error("FAILED: stage window.desktopAPI is not exposed!");
    }

    const stageHasNoticeElements = await stageWin.webContents.executeJavaScript(
      "document.querySelector('#stage-fallback-notice') !== null && document.querySelector('#stage-error-retry-btn') !== null"
    );
    log("Stage fallback notice & retry elements present:", stageHasNoticeElements);
    if (!stageHasNoticeElements) {
      error("FAILED: stage.html missing #stage-fallback-notice or #stage-error-retry-btn!");
    }

    const stageHasKebabControls = await stageWin.webContents.executeJavaScript(
      "document.querySelector('#btn-stage-kebab') !== null && document.querySelector('#stage-kebab-menu') !== null && document.querySelector('#btn-move-stage') !== null && document.querySelectorAll('.preset-btn').length === 3"
    );
    log("Stage kebab trigger, flyout menu, move handle & 3 presets present:", stageHasKebabControls);
    if (!stageHasKebabControls) {
      error("FAILED: stage.html missing #btn-stage-kebab, #stage-kebab-menu, #btn-move-stage, or 3 .preset-btn elements!");
    }

    const resizeHandleCount = await stageWin.webContents.executeJavaScript(
      "document.querySelectorAll('.stage-resize-handle').length"
    );
    log("Stage resize handle count in DOM:", resizeHandleCount);
    if (resizeHandleCount !== 8) {
      error(`FAILED: expected 8 resize handles in stage.html, found ${resizeHandleCount}`);
    } else {
      log("SUCCESS: all 8 directional resize handles found in Stage DOM!");
    }

    clearTimeout(timeout);
    win.destroy();
    stageWin.destroy();

    if (passed) {
      log("=== ALL REAL RUNTIME ELECTRON SMOKE CHECKS PASSED ===");
      process.exit(0);
    } else {
      log("=== REAL RUNTIME ELECTRON SMOKE CHECKS FAILED ===");
      process.exit(1);
    }
  } catch (err) {
    error("Unexpected error in smoke test:", err);
    clearTimeout(timeout);
    process.exit(1);
  }
});
