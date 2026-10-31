import { session, shell, type WebContents, type BrowserWindow } from "electron";

export const CSP_HEADER =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:* blob: data:;";

export function configureSessionSecurity(): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [CSP_HEADER],
      },
    });
  });
}

export function enforceWindowSecurity(mainWindow: BrowserWindow): void {
  // 1. Intercept window.open calls
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === "https:" || parsed.protocol === "http:") {
        // Delegate to OS default external browser
        shell.openExternal(url);
      }
    } catch {
      // Invalid URL rejected
    }
    return { action: "deny" };
  });

  // 2. Prevent arbitrary in-window navigation
  mainWindow.webContents.on("will-navigate", (event, navigationUrl) => {
    try {
      const parsed = new URL(navigationUrl);
      const isLocalhost =
        parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
      const isLocalFile = parsed.protocol === "file:";

      if (!isLocalhost && !isLocalFile) {
        event.preventDefault();
        shell.openExternal(navigationUrl);
      }
    } catch {
      event.preventDefault();
    }
  });
}

export function validateIpcSender(
  contents: WebContents,
  windows: (BrowserWindow | null)[] | (BrowserWindow | null),
): boolean {
  if (!contents) return false;
  const list = Array.isArray(windows) ? windows : [windows];
  return list.some(
    (win) => win && !win.isDestroyed() && contents.id === win.webContents.id,
  );
}
