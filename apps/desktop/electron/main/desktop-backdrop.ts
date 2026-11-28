import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { nativeImage, screen, type BrowserWindow } from "electron";
import type {
  DesktopBackdropInfo,
  DesktopWallpaperStyle,
} from "@vrm/platform-contracts";

interface WallpaperCache {
  filePath: string;
  mtimeMs: number;
  imageUrl: string | null;
  imageRevision: number;
  style: DesktopWallpaperStyle;
  backgroundColor: string;
  lastCheckedAt: number;
}

const cache: WallpaperCache = {
  filePath: "",
  mtimeMs: 0,
  imageUrl: null,
  imageRevision: 0,
  style: "fill",
  backgroundColor: "#0a0a0c",
  lastCheckedAt: 0,
};

let pendingRefresh: Promise<void> | null = null;
const sentRevisionByWebContents = new WeakMap<object, number>();

function execFileAsync(
  command: string,
  args: string[],
  timeout = 2000,
): Promise<string> {
  return new Promise((resolve) => {
    execFile(command, args, { timeout, windowsHide: true }, (err, stdout) => {
      if (err) {
        resolve("");
        return;
      }
      resolve(String(stdout || "").trim());
    });
  });
}

function parseRegValue(output: string, valueName: string): string {
  const regex = new RegExp(`^\\s*${valueName}\\s+REG_\\w+\\s+(.*)$`, "mi");
  const match = output.match(regex);
  return match?.[1]?.trim() ?? "";
}

function parseWin32Rgb(raw: string): string {
  const parts = raw.trim().split(/\s+/).map(Number);
  if (
    parts.length === 3 &&
    parts.every((n) => Number.isFinite(n) && n >= 0 && n <= 255)
  ) {
    return `rgb(${parts[0]}, ${parts[1]}, ${parts[2]})`;
  }
  return "#0a0a0c";
}

function mapWin32Style(
  styleRaw: string,
  tileRaw: string,
): DesktopWallpaperStyle {
  if (tileRaw.trim() === "1") return "tile";
  switch (styleRaw.trim()) {
    case "6":
      return "fit";
    case "2":
      return "stretch";
    case "0":
      return "center";
    case "10":
    case "22":
    default:
      return "fill";
  }
}

async function readOsWallpaperSpec(): Promise<{
  filePath: string;
  style: DesktopWallpaperStyle;
  backgroundColor: string;
}> {
  if (process.platform === "win32") {
    const [desktopOut, colorsOut] = await Promise.all([
      execFileAsync("reg.exe", ["query", "HKCU\\Control Panel\\Desktop"]),
      execFileAsync("reg.exe", [
        "query",
        "HKCU\\Control Panel\\Colors",
        "/v",
        "Background",
      ]),
    ]);

    let filePath = parseRegValue(desktopOut, "WallPaper");
    const style = mapWin32Style(
      parseRegValue(desktopOut, "WallpaperStyle"),
      parseRegValue(desktopOut, "TileWallpaper"),
    );
    const backgroundColor = parseWin32Rgb(
      parseRegValue(colorsOut, "Background"),
    );

    if (!filePath) {
      const transcoded = path.join(
        process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
        "Microsoft",
        "Windows",
        "Themes",
        "TranscodedWallpaper",
      );
      try {
        await fs.stat(transcoded);
        filePath = transcoded;
      } catch {
        filePath = "";
      }
    }

    return { filePath, style, backgroundColor };
  }

  if (process.platform === "darwin") {
    const out = await execFileAsync("osascript", [
      "-e",
      'tell application "System Events" to POSIX path of (picture of current desktop as alias)',
    ]);
    return { filePath: out, style: "fill", backgroundColor: "#0a0a0c" };
  }

  if (process.platform === "linux") {
    const uri = await execFileAsync("gsettings", [
      "get",
      "org.gnome.desktop.background",
      "picture-uri",
    ]);
    const cleaned = uri.replace(/^['"]|['"]$/g, "").replace(/^file:\/\//i, "");
    return {
      filePath: decodeURIComponent(cleaned),
      style: "fill",
      backgroundColor: "#0a0a0c",
    };
  }

  return { filePath: "", style: "fill", backgroundColor: "#0a0a0c" };
}

export async function refreshDesktopWallpaperCache(
  force = false,
): Promise<boolean> {
  const now = Date.now();
  if (!force && cache.lastCheckedAt > 0 && now - cache.lastCheckedAt < 3000) {
    return false;
  }
  if (pendingRefresh) {
    await pendingRefresh;
    return false;
  }

  let changed = false;
  pendingRefresh = (async () => {
    try {
      cache.lastCheckedAt = Date.now();
      const spec = await readOsWallpaperSpec();
      cache.style = spec.style;
      cache.backgroundColor = spec.backgroundColor;

      if (!spec.filePath) {
        if (cache.imageUrl !== null) {
          cache.filePath = "";
          cache.mtimeMs = 0;
          cache.imageUrl = null;
          cache.imageRevision += 1;
          changed = true;
        }
        return;
      }

      const stat = await fs.stat(spec.filePath).catch(() => null);
      if (!stat || !stat.isFile()) return;

      if (
        spec.filePath === cache.filePath &&
        stat.mtimeMs === cache.mtimeMs &&
        cache.imageUrl
      ) {
        return;
      }

      let img = nativeImage.createFromPath(spec.filePath);
      if (img.isEmpty()) return;

      const size = img.getSize();
      if (size.width > 1920) {
        img = img.resize({ width: 1920, quality: "good" });
      }
      const jpegBuf = img.toJPEG(84);
      const nextUrl = `data:image/jpeg;base64,${jpegBuf.toString("base64")}`;

      cache.filePath = spec.filePath;
      cache.mtimeMs = stat.mtimeMs;
      cache.imageUrl = nextUrl;
      cache.imageRevision += 1;
      changed = true;
    } catch {
      // Best-effort wallpaper loading; frosted glass tokens remain valid without it
    } finally {
      pendingRefresh = null;
    }
  })();

  await pendingRefresh;
  return changed;
}

export function buildWindowBackdropInfo(
  win: BrowserWindow,
  includeImageUrl: boolean,
): DesktopBackdropInfo {
  const windowBounds = win.getBounds();
  const display = screen.getDisplayMatching(windowBounds);
  const info: DesktopBackdropInfo = {
    imageRevision: cache.imageRevision,
    style: cache.style,
    backgroundColor: cache.backgroundColor,
    displayBounds: { ...display.bounds },
    windowBounds: { ...windowBounds },
    isMaximized: win.isMaximized(),
  };
  if (includeImageUrl) {
    info.imageUrl = cache.imageUrl;
  }
  return info;
}

export function sendWindowBackdropUpdate(
  win: BrowserWindow | null,
  channel: string,
  forceImage = false,
): void {
  if (!win || win.isDestroyed()) return;
  const lastRev = sentRevisionByWebContents.get(win.webContents) ?? -1;
  const shouldIncludeImage = forceImage || lastRev !== cache.imageRevision;
  const payload = buildWindowBackdropInfo(win, shouldIncludeImage);
  if (shouldIncludeImage) {
    sentRevisionByWebContents.set(win.webContents, cache.imageRevision);
  }
  win.webContents.send(channel, payload);
}
