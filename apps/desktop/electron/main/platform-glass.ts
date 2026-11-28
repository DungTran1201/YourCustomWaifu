import {
  spawn,
  execFile,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";
import {
  screen,
  type BrowserWindow,
  type BrowserWindowConstructorOptions,
} from "electron";
import type {
  GlassBackdropMode,
  MenubarDockPosition,
} from "@vrm/platform-contracts";
import {
  NOTCH_CORNER_THICKNESS,
  buildNotchContour,
  type NotchContour,
} from "@vrm/shared";
import { isCornerDock } from "./menubar-notch.js";

/**
 * Unified Cross-OS Glass Backdrop Engine (Windows 10, Windows 11, macOS, Linux).
 *
 * Design goals:
 * - Zero native C++/node-gyp dependencies: works immediately after `git clone && pnpm install`
 *   on any Windows 10, Windows 11, macOS (Intel / Apple Silicon), or Linux machine.
 * - Real OS-level live backdrop blur of underlying apps/video wherever supported:
 *   - Windows 10 & 11: WinRT `Windows.UI.Composition` `HostBackdropBrush` clipped via
 *     hardware vector `CompositionRoundedRectangleGeometry` (`24px` corners, `0px` when maximized)
 *     + Win32 `SetWinEventHook` lockstep tracking + `SetWindowRgn` click-through clipping
 *     (eliminates DWM rectangular corner wedges completely while blurring live video/apps!).
 *   - macOS: Native `NSVisualEffectView` (`vibrancy: "under-window"` when floating).
 *   - Linux (X11/KDE KWin): Standard `_KDE_NET_WM_BLUR_BEHIND_REGION` property via `xprop` when available.
 * - Deterministic self-adapting fallback (`frosted-fallback`):
 *   - If the host machine has OS transparency disabled, runs on Linux GNOME/Wayland without
 *     compositor blur, runs inside a VM/RDP session, or lacks WinRT HostBackdrop support,
 *     automatically reports `"frosted-fallback"` so CSS preserves clean borderless glass everywhere.
 */

const PS_WIN32_BRIDGE_SCRIPT = `
Add-Type -TypeDefinition @"
using System;
using System.Collections.Concurrent;
using System.Runtime.InteropServices;
using System.Threading;
using Microsoft.Win32;

public static class PlatformWin32Glass {
  [StructLayout(LayoutKind.Sequential)]
  public struct AccentPolicy {
    public int AccentState;
    public int AccentFlags;
    public uint GradientColor;
    public int AnimationId;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct WindowCompositionAttributeData {
    public int Attribute;
    public IntPtr Data;
    public int SizeOfData;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct DispatcherQueueOptions {
    public int dwSize;
    public int threadType;
    public int apartmentType;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct POINT {
    public int X;
    public int Y;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct MSG {
    public IntPtr hwnd;
    public uint message;
    public IntPtr wParam;
    public IntPtr lParam;
    public uint time;
    public POINT pt;
  }

  public delegate void WinEventDelegate(IntPtr hWinEventHook, uint eventType, IntPtr hwnd, int idObject, int idChild, uint dwEventThread, uint dwmsEventTime);
  public delegate void CommandHandler(string cmd);

  [DllImport("CoreMessaging.dll")]
  public static extern int CreateDispatcherQueueController(DispatcherQueueOptions options, out IntPtr controller);

  [DllImport("kernel32.dll")]
  public static extern uint GetCurrentThreadId();

  [DllImport("user32.dll")]
  public static extern bool PostThreadMessage(uint idThread, uint Msg, IntPtr wParam, IntPtr lParam);

  [DllImport("user32.dll")]
  public static extern int GetMessage(out MSG lpMsg, IntPtr hWnd, uint wMsgFilterMin, uint wMsgFilterMax);

  [DllImport("user32.dll")]
  public static extern bool TranslateMessage(ref MSG lpMsg);

  [DllImport("user32.dll")]
  public static extern IntPtr DispatchMessage(ref MSG lpMsg);

  [DllImport("user32.dll", SetLastError = true)]
  public static extern IntPtr CreateWindowEx(int exStyle, string cls, string name, int style, int x, int y, int w, int h, IntPtr parent, IntPtr menu, IntPtr inst, IntPtr param);

  [DllImport("user32.dll")]
  public static extern bool DestroyWindow(IntPtr hwnd);

  [DllImport("user32.dll")]
  public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

  [DllImport("user32.dll")]
  public static extern bool IsWindow(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool IsWindowVisible(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool IsIconic(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool IsZoomed(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);

  [DllImport("user32.dll")]
  public static extern IntPtr SetWinEventHook(uint eventMin, uint eventMax, IntPtr hmodWinEventProc, WinEventDelegate lpfnWinEventProc, uint idProcess, uint idThread, uint dwFlags);

  [DllImport("user32.dll")]
  public static extern bool UnhookWinEvent(IntPtr hWinEventHook);

  [DllImport("user32.dll")]
  public static extern int SetWindowCompositionAttribute(IntPtr hwnd, ref WindowCompositionAttributeData data);

  [DllImport("user32.dll")]
  public static extern bool GetClientRect(IntPtr hWnd, out RECT lpRect);

  [DllImport("gdi32.dll")]
  public static extern IntPtr CreateRoundRectRgn(int x1, int y1, int x2, int y2, int cx, int cy);

  [DllImport("gdi32.dll")]
  public static extern int CombineRgn(IntPtr hrgnDest, IntPtr hrgnSrc1, IntPtr hrgnSrc2, int fnCombineMode);

  [DllImport("gdi32.dll")]
  public static extern bool DeleteObject(IntPtr hObject);

  [DllImport("gdi32.dll")]
  public static extern IntPtr CreateCompatibleDC(IntPtr hdc);

  [DllImport("gdi32.dll")]
  public static extern bool DeleteDC(IntPtr hdc);

  [DllImport("gdi32.dll")]
  public static extern bool BeginPath(IntPtr hdc);

  [DllImport("gdi32.dll")]
  public static extern bool EndPath(IntPtr hdc);

  [DllImport("gdi32.dll")]
  public static extern bool CloseFigure(IntPtr hdc);

  [DllImport("gdi32.dll")]
  public static extern bool MoveToEx(IntPtr hdc, int x, int y, IntPtr lppt);

  [DllImport("gdi32.dll")]
  public static extern bool LineTo(IntPtr hdc, int x, int y);

  [DllImport("gdi32.dll")]
  public static extern bool PolyBezierTo(IntPtr hdc, POINT[] apt, int cCount);

  [DllImport("gdi32.dll")]
  public static extern IntPtr PathToRegion(IntPtr hdc);

  [DllImport("user32.dll")]
  public static extern int SetWindowRgn(IntPtr hWnd, IntPtr hRgn, bool bRedraw);

  [DllImport("dwmapi.dll")]
  public static extern int DwmSetWindowAttribute(IntPtr hwnd, int dwAttribute, ref uint pvAttribute, int cbAttribute);

  [DllImport("user32.dll", EntryPoint = "GetWindowLong")]
  private static extern int GetWindowLong32(IntPtr hWnd, int nIndex);

  [DllImport("user32.dll", EntryPoint = "GetWindowLongPtr")]
  private static extern IntPtr GetWindowLongPtr64(IntPtr hWnd, int nIndex);

  [DllImport("user32.dll", EntryPoint = "SetWindowLong")]
  private static extern int SetWindowLong32(IntPtr hWnd, int nIndex, int dwNewLong);

  [DllImport("user32.dll", EntryPoint = "SetWindowLongPtr")]
  private static extern IntPtr SetWindowLongPtr64(IntPtr hWnd, int nIndex, IntPtr dwNewLong);

  [DllImport("user32.dll")]
  private static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

  [ComImport, Guid("29E691FA-4567-4DCA-B319-D0F207EB6807"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  public interface ICompositorDesktopInterop {
    [PreserveSig] int CreateDesktopWindowTarget(IntPtr hwndTarget, [MarshalAs(UnmanagedType.Bool)] bool isTopmost, out IntPtr result);
  }

  public static object AttachDesktopTarget(object comp, IntPtr hwnd) {
    IntPtr unk = Marshal.GetIUnknownForObject(comp);
    Guid iid = new Guid("29E691FA-4567-4DCA-B319-D0F207EB6807");
    IntPtr pInterop;
    Marshal.QueryInterface(unk, ref iid, out pInterop);
    Marshal.Release(unk);
    var interop = (ICompositorDesktopInterop)Marshal.GetObjectForIUnknown(pInterop);
    IntPtr pTarget;
    int hr = interop.CreateDesktopWindowTarget(hwnd, false, out pTarget);
    if (hr != 0 || pTarget == IntPtr.Zero) throw new Exception("CreateDesktopWindowTarget HR=0x" + hr.ToString("X8"));
    return Marshal.GetObjectForIUnknown(pTarget);
  }

  private static bool IsTopmostWindow(IntPtr hwnd) {
    const int GWL_EXSTYLE = -20;
    const long WS_EX_TOPMOST = 0x00000008L;
    long style = IntPtr.Size == 8 ? GetWindowLongPtr64(hwnd, GWL_EXSTYLE).ToInt64() : GetWindowLong32(hwnd, GWL_EXSTYLE);
    return (style & WS_EX_TOPMOST) != 0;
  }

  public static IntPtr CreateBackdropPopup(int x, int y, int w, int h) {
    // WS_EX_NOREDIRECTIONBITMAP | WS_EX_TRANSPARENT | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE
    // Omit WS_EX_LAYERED so DWM HostBackdropBrush compositing works on Windows 11+.
    const int exStyle = 0x00200000 | 0x00000020 | 0x00000080 | 0x08000000;
    const int style = unchecked((int)0x80000000);
    return CreateWindowEx(exStyle, "Static", "", style, x, y, Math.Max(1, w), Math.Max(1, h), IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero);
  }

  public static int SyncBackdropPos(long targetVal, long backdropVal, out int outW, out int outH, out int isMax) {
    IntPtr target = new IntPtr(targetVal);
    IntPtr backdrop = new IntPtr(backdropVal);
    outW = 0; outH = 0; isMax = 0;
    if (!IsWindow(target)) return -1;
    if (!IsWindowVisible(target) || IsIconic(target)) {
      ShowWindow(backdrop, 0);
      return 0;
    }
    RECT rc;
    if (!GetWindowRect(target, out rc)) return 0;
    outW = Math.Max(1, rc.Right - rc.Left);
    outH = Math.Max(1, rc.Bottom - rc.Top);
    isMax = IsZoomed(target) ? 1 : 0;
    bool targetTopmost = IsTopmostWindow(target);
    bool backdropTopmost = IsTopmostWindow(backdrop);
    if (targetTopmost != backdropTopmost) {
      SetWindowPos(backdrop, targetTopmost ? new IntPtr(-1) : new IntPtr(-2), 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0010);
    }
    uint flags = 0x0010; // SWP_NOACTIVATE
    if (!IsWindowVisible(backdrop)) {
      flags |= 0x0040; // SWP_SHOWWINDOW
    }
    SetWindowPos(backdrop, target, rc.Left, rc.Top, outW, outH, flags);
    return 1;
  }

  private static readonly ConcurrentQueue<string> CmdQueue = new ConcurrentQueue<string>();
  private static uint MainThreadId = 0;
  private const uint WM_APP_CMD = 0x8001;
  private const uint WM_QUIT = 0x0012;
  private static WinEventDelegate HookProcRef = null;
  private static IntPtr HookHandle = IntPtr.Zero;
  private static uint HookedPid = 0;

  public static void EnsureHookForWindow(long targetVal, Action<long> onTargetEvent) {
    uint pid;
    GetWindowThreadProcessId(new IntPtr(targetVal), out pid);
    if (pid == 0 || pid == HookedPid) return;
    if (HookHandle != IntPtr.Zero) {
      UnhookWinEvent(HookHandle);
      HookHandle = IntPtr.Zero;
    }
    HookedPid = pid;
    HookProcRef = delegate(IntPtr hHook, uint evt, IntPtr hwnd, int idObj, int idChild, uint thr, uint time) {
      if (idObj != 0 || hwnd == IntPtr.Zero) return;
      onTargetEvent(hwnd.ToInt64());
    };
    HookHandle = SetWinEventHook(0x0003, 0x800B, IntPtr.Zero, HookProcRef, pid, 0, 0);
  }

  public static void RunLoop(CommandHandler handler, Action cleanup) {
    MainThreadId = GetCurrentThreadId();
    Thread reader = new Thread(delegate() {
      try {
        string line;
        while ((line = Console.In.ReadLine()) != null) {
          CmdQueue.Enqueue(line);
          PostThreadMessage(MainThreadId, WM_APP_CMD, IntPtr.Zero, IntPtr.Zero);
        }
      } catch {}
      PostThreadMessage(MainThreadId, WM_QUIT, IntPtr.Zero, IntPtr.Zero);
    });
    reader.IsBackground = true;
    reader.Start();

    MSG msg;
    while (GetMessage(out msg, IntPtr.Zero, 0, 0) > 0) {
      if (msg.message == WM_APP_CMD) {
        string cmd;
        while (CmdQueue.TryDequeue(out cmd)) {
          handler(cmd);
        }
      } else {
        TranslateMessage(ref msg);
        DispatchMessage(ref msg);
      }
    }
    if (HookHandle != IntPtr.Zero) {
      UnhookWinEvent(HookHandle);
      HookHandle = IntPtr.Zero;
    }
    if (cleanup != null) cleanup();
  }

  public static void EnableNoActivateToolWindow(long hwndVal) {
    IntPtr hwnd = new IntPtr(hwndVal);
    const int GWL_EXSTYLE = -20;
    const long WS_EX_TOOLWINDOW = 0x00000080L;
    const long WS_EX_NOACTIVATE = 0x08000000L;
    const long WS_EX_APPWINDOW = 0x00040000L;
    const uint SWP_NOMOVE = 0x0002;
    const uint SWP_NOSIZE = 0x0001;
    const uint SWP_NOZORDER = 0x0004;
    const uint SWP_NOACTIVATE = 0x0010;
    const uint SWP_FRAMECHANGED = 0x0020;

    if (IntPtr.Size == 8) {
      long style = GetWindowLongPtr64(hwnd, GWL_EXSTYLE).ToInt64();
      style = (style | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE) & ~WS_EX_APPWINDOW;
      SetWindowLongPtr64(hwnd, GWL_EXSTYLE, new IntPtr(style));
    } else {
      int style = GetWindowLong32(hwnd, GWL_EXSTYLE);
      int next = (style | (int)WS_EX_TOOLWINDOW | (int)WS_EX_NOACTIVATE) & ~(int)WS_EX_APPWINDOW;
      SetWindowLong32(hwnd, GWL_EXSTYLE, next);
    }
    SetWindowPos(hwnd, IntPtr.Zero, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED);
  }

  public static bool IsTransparencyEnabled() {
    try {
      using (var key = Registry.CurrentUser.OpenSubKey("SOFTWARE\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Themes\\\\Personalize")) {
        if (key != null) {
          object val = key.GetValue("EnableTransparency");
          if (val is int) return ((int)val) != 0;
        }
      }
    } catch {}
    return true;
  }

  public static void RemoveWin11Border(long hwndVal) {
    try {
      uint borderNone = 0xFFFFFFFE;
      DwmSetWindowAttribute(new IntPtr(hwndVal), 34, ref borderNone, sizeof(uint));
    } catch {}
  }

  public static int EnableHostBackdropAttr(long hwndVal) {
    try {
      uint enable = 1;
      return DwmSetWindowAttribute(new IntPtr(hwndVal), 17, ref enable, sizeof(uint));
    } catch {
      return unchecked((int)0x80070057);
    }
  }

  public static int ApplyAcrylic(long hwndVal, int accentState, uint gradientColor) {
    IntPtr hwnd = new IntPtr(hwndVal);
    RemoveWin11Border(hwndVal);

    var accent = new AccentPolicy {
      AccentState = accentState,
      AccentFlags = 2,
      GradientColor = gradientColor,
      AnimationId = 0
    };
    int size = Marshal.SizeOf(accent);
    IntPtr ptr = Marshal.AllocHGlobal(size);
    try {
      Marshal.StructureToPtr(accent, ptr, false);
      var data = new WindowCompositionAttributeData {
        Attribute = 19,
        Data = ptr,
        SizeOfData = size
      };
      return SetWindowCompositionAttribute(hwnd, ref data);
    } finally {
      Marshal.FreeHGlobal(ptr);
    }
  }

  public static int ApplyRoundRegion(long hwndVal, int radiusPx) {
    IntPtr hwnd = new IntPtr(hwndVal);
    if (radiusPx <= 0) {
      return SetWindowRgn(hwnd, IntPtr.Zero, true);
    }
    RECT rect;
    if (!GetClientRect(hwnd, out rect)) return 0;
    int w = rect.Right - rect.Left;
    int h = rect.Bottom - rect.Top;
    if (w <= 0 || h <= 0) return 0;
    int diameter = radiusPx * 2;
    IntPtr rgn = CreateRoundRectRgn(0, 0, w + 1, h + 1, diameter, diameter);
    if (rgn == IntPtr.Zero) return 0;
    return SetWindowRgn(hwnd, rgn, true);
  }

  public static int ApplyLCornerRegion(long hwndVal, int x1, int y1, int w1, int h1, int x2, int y2, int w2, int h2, int radiusPx) {
    IntPtr hwnd = new IntPtr(hwndVal);
    int d = Math.Max(0, radiusPx * 2);
    IntPtr r1 = CreateRoundRectRgn(x1, y1, x1 + w1 + 1, y1 + h1 + 1, d, d);
    IntPtr r2 = CreateRoundRectRgn(x2, y2, x2 + w2 + 1, y2 + h2 + 1, d, d);
    if (r1 == IntPtr.Zero || r2 == IntPtr.Zero) {
      if (r1 != IntPtr.Zero) DeleteObject(r1);
      if (r2 != IntPtr.Zero) DeleteObject(r2);
      return 0;
    }
    const int RGN_OR = 2;
    IntPtr combined = CreateRoundRectRgn(0, 0, 1, 1, 0, 0);
    CombineRgn(combined, r1, r2, RGN_OR);
    DeleteObject(r1);
    DeleteObject(r2);
    return SetWindowRgn(hwnd, combined, true);
  }

  public static int ApplyPathRegion(long hwndVal, string spec) {
    IntPtr hwnd = new IntPtr(hwndVal);
    if (string.IsNullOrEmpty(spec)) return 0;
    IntPtr hdc = CreateCompatibleDC(IntPtr.Zero);
    if (hdc == IntPtr.Zero) return 0;
    try {
      if (!BeginPath(hdc)) return 0;
      string[] tokens = spec.Split('|');
      for (int i = 0; i < tokens.Length; i++) {
        string t = tokens[i];
        if (t.Length == 0) continue;
        string[] p = t.Split(',');
        string cmd = p[0];
        if (cmd == "M" && p.Length >= 3) {
          MoveToEx(hdc, int.Parse(p[1]), int.Parse(p[2]), IntPtr.Zero);
        } else if (cmd == "L" && p.Length >= 3) {
          LineTo(hdc, int.Parse(p[1]), int.Parse(p[2]));
        } else if (cmd == "C" && p.Length >= 7) {
          POINT[] pts = new POINT[3];
          pts[0] = new POINT { X = int.Parse(p[1]), Y = int.Parse(p[2]) };
          pts[1] = new POINT { X = int.Parse(p[3]), Y = int.Parse(p[4]) };
          pts[2] = new POINT { X = int.Parse(p[5]), Y = int.Parse(p[6]) };
          PolyBezierTo(hdc, pts, 3);
        } else if (cmd == "Z") {
          CloseFigure(hdc);
        }
      }
      if (!EndPath(hdc)) return 0;
      IntPtr rgn = PathToRegion(hdc);
      if (rgn == IntPtr.Zero) return 0;
      int res = SetWindowRgn(hwnd, rgn, true);
      if (res == 0) DeleteObject(rgn);
      return res;
    } finally {
      DeleteDC(hdc);
    }
  }
}
"@

$trans = [PlatformWin32Glass]::IsTransparencyEnabled()
$comp = $null
$hostBrush = $null
$hostBlurAvailable = $false

if ($trans) {
  try {
    # Probe DWMWA_USE_HOSTBACKDROPBRUSH (17): succeeds (hr == 0) on Windows 11+,
    # returns E_INVALIDARG (0x80070057) on Windows 10 where HostBackdropBrush renders black.
    $probeHwnd = [PlatformWin32Glass]::CreateBackdropPopup(0, 0, 1, 1)
    $hr17 = -1
    if ($probeHwnd -ne [IntPtr]::Zero) {
      $hr17 = [PlatformWin32Glass]::EnableHostBackdropAttr($probeHwnd.ToInt64())
      [void][PlatformWin32Glass]::DestroyWindow($probeHwnd)
    }
    if ($hr17 -eq 0) {
      $dqOpt = New-Object PlatformWin32Glass+DispatcherQueueOptions
      $dqOpt.dwSize = [System.Runtime.InteropServices.Marshal]::SizeOf($dqOpt)
      $dqOpt.threadType = 2
      $dqOpt.apartmentType = 0
      $dq = [IntPtr]::Zero
      [void][PlatformWin32Glass]::CreateDispatcherQueueController($dqOpt, [ref]$dq)
      $null = [Windows.UI.Composition.Compositor, Windows.UI.Composition, ContentType=WindowsRuntime]
      $null = [Windows.UI.Composition.Desktop.DesktopWindowTarget, Windows.UI.Composition.Desktop, ContentType=WindowsRuntime]
      $comp = [Windows.UI.Composition.Compositor]::new()
      $hostBrush = $comp.CreateHostBackdropBrush()
      if ($null -ne $hostBrush) { $hostBlurAvailable = $true }
    }
  } catch {
    $hostBlurAvailable = $false
  }
}

$entries = @{}
$syncEntry = {
  param([long]$t)
  if (-not $entries.ContainsKey($t)) { return }
  $e = $entries[$t]
  if (-not $e.Active) {
    [void][PlatformWin32Glass]::ShowWindow($e.Backdrop, 0)
    return
  }
  $w = 0; $h = 0; $isMax = 0
  $state = [PlatformWin32Glass]::SyncBackdropPos($t, $e.Backdrop.ToInt64(), [ref]$w, [ref]$h, [ref]$isMax)
  if ($state -eq -1) {
    [void][PlatformWin32Glass]::DestroyWindow($e.Backdrop)
    $entries.Remove($t)
    return
  }
  if ($state -eq 1) {
    $r = if ($isMax -eq 1) { 0 } else { $e.Radius }
    if ($e.W -ne $w -or $e.H -ne $h -or $e.LastR -ne $r) {
      $e.W = $w; $e.H = $h; $e.LastR = $r
      $sz = $e.Geo.Size; $sz.X = $w; $sz.Y = $h; $e.Geo.Size = $sz
      $cr = $e.Geo.CornerRadius; $cr.X = $r; $cr.Y = $r; $e.Geo.CornerRadius = $cr
      $e.Vis.Size = $sz
    }
  }
}

[Console]::Out.WriteLine("READY:" + $(if ($trans) { "1" } else { "0" }))
[Console]::Out.Flush()

[PlatformWin32Glass]::RunLoop([PlatformWin32Glass+CommandHandler]{
  param([string]$line)
  try {
    $parts = $line.Trim().Split(" ")
    if ($parts.Length -ge 3 -and $parts[0] -eq "HOST_BLUR") {
      $t = [long]$parts[1]
      $rad = [int]$parts[2]
      $tintHex = if ($parts.Length -ge 4) { $parts[3] } else { "04000000" }
      [PlatformWin32Glass]::RemoveWin11Border($t)
      if (-not $trans) {
        [Console]::Out.WriteLine("HOST_BLUR_RES:0")
        [Console]::Out.Flush()
        return
      }
      if (-not $hostBlurAvailable) {
        $res = [PlatformWin32Glass]::ApplyAcrylic($t, 4, [Convert]::ToUInt32($tintHex, 16))
        [Console]::Out.WriteLine("HOST_BLUR_RES:" + $(if ($res -ne 0) { "1" } else { "0" }))
        [Console]::Out.Flush()
        return
      }
      [void][PlatformWin32Glass]::ApplyAcrylic($t, 0, [uint32]0)
      [PlatformWin32Glass]::EnsureHookForWindow($t, [Action[long]]{ param($h) & $syncEntry $h })
      if (-not $entries.ContainsKey($t)) {
        $b = [PlatformWin32Glass]::CreateBackdropPopup(0, 0, 100, 100)
        [void][PlatformWin32Glass]::EnableHostBackdropAttr($b.ToInt64())
        $tgt = [Windows.UI.Composition.Desktop.DesktopWindowTarget][PlatformWin32Glass]::AttachDesktopTarget($comp, $b)
        $geo = $comp.CreateRoundedRectangleGeometry()
        $clip = $comp.CreateGeometricClip($geo)
        $vis = $comp.CreateSpriteVisual()
        $vis.Brush = $hostBrush
        $vis.Clip = $clip
        $tgt.Root = $vis
        $entries[$t] = @{ Backdrop = $b; Target = $tgt; Geo = $geo; Vis = $vis; Radius = $rad; Active = $true; W = 0; H = 0; LastR = -1 }
      } else {
        $entries[$t].Radius = $rad
        $entries[$t].Active = $true
      }
      & $syncEntry $t
      [Console]::Out.WriteLine("HOST_BLUR_RES:1")
      [Console]::Out.Flush()
    } elseif ($parts.Length -ge 3 -and $parts[0] -eq "SYNC_HOST_BLUR") {
      $t = [long]$parts[1]
      $rad = [int]$parts[2]
      if ($entries.ContainsKey($t) -and $entries[$t].Active) {
        $entries[$t].Radius = $rad
        & $syncEntry $t
      }
    } elseif ($parts.Length -ge 2 -and $parts[0] -eq "CLEAR_BLUR") {
      $t = [long]$parts[1]
      if ($entries.ContainsKey($t)) {
        $entries[$t].Active = $false
        [void][PlatformWin32Glass]::ShowWindow($entries[$t].Backdrop, 0)
      }
      [void][PlatformWin32Glass]::ApplyAcrylic($t, 0, [uint32]0)
    } elseif ($parts.Length -ge 3 -and $parts[0] -eq "RGN") {
      [void][PlatformWin32Glass]::ApplyRoundRegion([long]$parts[1], [int]$parts[2])
    } elseif ($parts.Length -ge 3 -and $parts[0] -eq "RGN_PATH") {
      [void][PlatformWin32Glass]::ApplyPathRegion([long]$parts[1], $parts[2])
    } elseif ($parts.Length -ge 11 -and $parts[0] -eq "RGN_L") {
      [void][PlatformWin32Glass]::ApplyLCornerRegion([long]$parts[1], [int]$parts[2], [int]$parts[3], [int]$parts[4], [int]$parts[5], [int]$parts[6], [int]$parts[7], [int]$parts[8], [int]$parts[9], [int]$parts[10])
    } elseif ($parts.Length -ge 2 -and $parts[0] -eq "NOACTIVATE") {
      [PlatformWin32Glass]::EnableNoActivateToolWindow([long]$parts[1])
    }
  } catch {
    # Ignore transient window destruction errors
  }
}, [Action]{
  foreach ($e in @($entries.Values)) {
    try { [void][PlatformWin32Glass]::DestroyWindow($e.Backdrop) } catch {}
  }
  $entries.Clear()
})
`;

let win32Helper: ChildProcessWithoutNullStreams | null = null;
let win32HelperReady = false;
let win32HelperFailed = false;
let win32TransparencyEnabled = true;
const pendingWin32Commands: string[] = [];

let activeGlassMode: GlassBackdropMode =
  process.platform === "win32" || process.platform === "darwin"
    ? "native-blur"
    : "frosted-fallback";

type ModeChangeListener = (mode: GlassBackdropMode) => void;
const modeListeners = new Set<ModeChangeListener>();

function setGlassMode(next: GlassBackdropMode): void {
  if (activeGlassMode === next) return;
  activeGlassMode = next;
  for (const listener of modeListeners) {
    try {
      listener(next);
    } catch {
      // Ignore listener errors
    }
  }
}

export function onPlatformGlassModeChanged(
  listener: ModeChangeListener,
): () => void {
  modeListeners.add(listener);
  return () => {
    modeListeners.delete(listener);
  };
}

export function getPlatformGlassMode(): GlassBackdropMode {
  return activeGlassMode;
}

/**
 * Returns unified borderless transparent BrowserWindow options tailored for the active OS.
 */
export function getGlassBrowserWindowOptions(
  platform: NodeJS.Platform = process.platform,
  options: { overlay?: boolean } = {},
): Partial<BrowserWindowConstructorOptions> {
  const isOverlay = Boolean(options.overlay);
  const base: Partial<BrowserWindowConstructorOptions> = {
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: false,
    roundedCorners: true,
    autoHideMenuBar: true,
    resizable: true,
    ...(isOverlay
      ? {
          skipTaskbar: true,
          focusable: false,
          ...(platform === "linux" ? { type: "toolbar" } : {}),
        }
      : {}),
  };

  if (platform === "darwin") {
    return {
      ...base,
      vibrancy: "under-window",
      visualEffectState: "active",
    };
  }

  return base;
}

/**
 * Configures an overlay window (Menubar or Avatar Stage) so interacting with it
 * over another fullscreen application does NOT steal foreground activation or
 * pull up the OS taskbar.
 */
export function configureNonIntrusiveOverlayWindow(
  win: BrowserWindow | null,
): void {
  if (!win || win.isDestroyed()) return;
  try {
    win.setSkipTaskbar(true);
  } catch {
    // Ignore unsupported platforms
  }

  if (process.platform === "win32") {
    const hwnd = getWindowHwndString(win);
    if (hwnd) {
      sendWin32Command(`NOACTIVATE ${hwnd}`);
    }
  } else if (process.platform === "darwin") {
    try {
      win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    } catch {
      // Ignore if unavailable
    }
  }
}

function ensureWin32Helper(): void {
  if (process.platform !== "win32" || win32HelperFailed || win32Helper) {
    return;
  }

  try {
    const proc = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-NoLogo",
        "-WindowStyle",
        "Hidden",
        "-Command",
        PS_WIN32_BRIDGE_SCRIPT,
      ],
      {
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      },
    );

    win32Helper = proc;

    proc.stdout.on("data", (chunk: Buffer) => {
      const lines = chunk.toString("utf8").split(/\r?\n/);
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        if (line.startsWith("READY:")) {
          win32HelperReady = true;
          win32TransparencyEnabled = line === "READY:1";
          if (!win32TransparencyEnabled) {
            setGlassMode("frosted-fallback");
          }
          flushPendingWin32();
        } else if (
          line.startsWith("HOST_BLUR_RES:") ||
          line.startsWith("BLUR_RES:")
        ) {
          const ok =
            (line === "HOST_BLUR_RES:1" || line === "BLUR_RES:1") &&
            win32TransparencyEnabled;
          setGlassMode(ok ? "native-blur" : "frosted-fallback");
        }
      }
    });

    proc.on("error", () => {
      win32HelperFailed = true;
      win32HelperReady = false;
      win32Helper = null;
      pendingWin32Commands.length = 0;
      setGlassMode("frosted-fallback");
    });

    proc.on("exit", (code) => {
      win32HelperReady = false;
      win32Helper = null;
      if (code && code !== 0) {
        win32HelperFailed = true;
        setGlassMode("frosted-fallback");
      }
    });
  } catch {
    win32HelperFailed = true;
    win32Helper = null;
    setGlassMode("frosted-fallback");
  }
}

function flushPendingWin32(): void {
  if (!win32Helper || !win32HelperReady || !win32Helper.stdin.writable) return;
  while (pendingWin32Commands.length > 0) {
    const cmd = pendingWin32Commands.shift();
    if (cmd) {
      win32Helper.stdin.write(`${cmd}\n`);
    }
  }
}

function sendWin32Command(cmd: string): void {
  if (process.platform !== "win32" || win32HelperFailed) return;
  ensureWin32Helper();
  if (win32Helper && win32HelperReady && win32Helper.stdin.writable) {
    win32Helper.stdin.write(`${cmd}\n`);
  } else {
    if (pendingWin32Commands.length > 64) {
      pendingWin32Commands.shift();
    }
    pendingWin32Commands.push(cmd);
  }
}

function getWindowHwndString(win: BrowserWindow): string | null {
  if (!win || win.isDestroyed()) return null;
  try {
    const buf = win.getNativeWindowHandle();
    if (buf.length >= 8) {
      return buf.readBigInt64LE(0).toString();
    }
    if (buf.length >= 4) {
      return buf.readInt32LE(0).toString();
    }
  } catch {
    // Window may be closing
  }
  return null;
}

function getPhysicalRadius(win: BrowserWindow, radiusDip: number): number {
  if (radiusDip <= 0 || win.isMaximized()) return 0;
  try {
    const display = screen.getDisplayMatching(win.getBounds());
    const scale = display?.scaleFactor || 1;
    return Math.max(0, Math.round(radiusDip * scale));
  } catch {
    return Math.max(0, Math.round(radiusDip));
  }
}

function applyLinuxKdeBlurBestEffort(win: BrowserWindow): void {
  // Only attempt on X11 sessions where DISPLAY is set (Wayland lacks xprop window IDs)
  if (!process.env.DISPLAY || process.env.WAYLAND_DISPLAY) {
    setGlassMode("frosted-fallback");
    return;
  }

  try {
    const buf = win.getNativeWindowHandle();
    if (buf.length < 4) {
      setGlassMode("frosted-fallback");
      return;
    }
    const xid = `0x${buf.readUInt32LE(0).toString(16)}`;
    execFile(
      "xprop",
      [
        "-id",
        xid,
        "-f",
        "_KDE_NET_WM_BLUR_BEHIND_REGION",
        "32c",
        "-set",
        "_KDE_NET_WM_BLUR_BEHIND_REGION",
        "0",
      ],
      { timeout: 1500 },
      (err) => {
        if (
          !err &&
          process.env.XDG_CURRENT_DESKTOP?.toUpperCase().includes("KDE")
        ) {
          setGlassMode("native-blur");
        } else {
          setGlassMode("frosted-fallback");
        }
      },
    );
  } catch {
    setGlassMode("frosted-fallback");
  }
}

function contourToWin32PathSpec(contour: NotchContour): string {
  const parts: string[] = [
    `M,${Math.round(contour.startX)},${Math.round(contour.startY)}`,
  ];
  for (const op of contour.ops) {
    if (op.kind === "L") {
      parts.push(`L,${Math.round(op.x)},${Math.round(op.y)}`);
    } else {
      parts.push(
        `C,${Math.round(op.c1x)},${Math.round(op.c1y)},${Math.round(op.c2x)},${Math.round(op.c2y)},${Math.round(op.x)},${Math.round(op.y)}`,
      );
    }
  }
  parts.push("Z");
  return parts.join("|");
}

const ACRYLIC_MINIMAL_LIGHT_ABGR = "04FFFFFF";
const ACRYLIC_MINIMAL_DARK_ABGR = "04000000";

/**
 * Applies OS-native desktop backdrop blur and rounded corner clipping across
 * Windows 10/11, macOS, and Linux, automatically falling back to `frosted-fallback`
 * whenever the host machine cannot provide OS-level compositor blur.
 */
export function applyPlatformGlass(
  win: BrowserWindow | null,
  theme: "light" | "dark",
  radiusDip = 24,
  dock: MenubarDockPosition = "floating",
): void {
  if (!win || win.isDestroyed()) return;

  if (process.platform === "win32") {
    const hwnd = getWindowHwndString(win);
    if (!hwnd) return;
    if (dock === "floating") {
      // Win11+: live GPU HostBackdropBrush clipped with vector RoundedRectangleGeometry(radiusPx).
      // Win10 (where DWMWA_USE_HOSTBACKDROPBRUSH=17 is unsupported): bridge applies Acrylic
      // (ACCENT_ENABLE_ACRYLICBLURBEHIND) with minimal tint so underlying videos blur cleanly.
      const radiusPx = getPhysicalRadius(win, radiusDip);
      const minimalTint =
        theme === "dark"
          ? ACRYLIC_MINIMAL_DARK_ABGR
          : ACRYLIC_MINIMAL_LIGHT_ABGR;
      sendWin32Command(`HOST_BLUR ${hwnd} ${radiusPx} ${minimalTint}`);
    } else {
      // Docked Edge/Corner Notch uses a concave SVG silhouette; hide rectangular
      // HostBackdrop so the outer concave pockets remain 100% transparent.
      sendWin32Command(`CLEAR_BLUR ${hwnd}`);
    }
    updatePlatformGlassRegion(win, radiusDip, dock);
    return;
  }

  if (process.platform === "darwin") {
    try {
      win.setVibrancy(dock === "floating" ? "under-window" : null);
      setGlassMode(dock === "floating" ? "native-blur" : "frosted-fallback");
    } catch {
      setGlassMode("frosted-fallback");
    }
    return;
  }

  if (process.platform === "linux") {
    applyLinuxKdeBlurBestEffort(win);
    return;
  }

  setGlassMode("frosted-fallback");
}

/**
 * Hides any Win32 HostBackdrop companion layer immediately when the target
 * Electron window is hidden or minimized.
 */
export function hidePlatformGlass(win: BrowserWindow | null): void {
  if (process.platform !== "win32" || !win || win.isDestroyed()) return;
  const hwnd = getWindowHwndString(win);
  if (hwnd) {
    sendWin32Command(`CLEAR_BLUR ${hwnd}`);
  }
}

/**
 * Updates rounded clipping region on resize / maximize / display DPI change.
 * Keeps `SetWindowRgn` click-through and `SYNC_HOST_BLUR` radius synchronized.
 */
export function updatePlatformGlassRegion(
  win: BrowserWindow | null,
  radiusDip = 24,
  dock: MenubarDockPosition = "floating",
): void {
  if (process.platform !== "win32" || !win || win.isDestroyed()) return;
  const hwnd = getWindowHwndString(win);
  if (!hwnd) return;

  if (dock !== "floating") {
    const bounds = win.getBounds();
    let scale = 1;
    try {
      scale = screen.getDisplayMatching(bounds)?.scaleFactor || 1;
    } catch {
      scale = 1;
    }
    const w = Math.max(32, Math.round(bounds.width * scale));
    const h = Math.max(32, Math.round(bounds.height * scale));
    const armThickness = isCornerDock(dock)
      ? Math.max(24, Math.min(w, h, Math.round(NOTCH_CORNER_THICKNESS * scale)))
      : undefined;
    const contour = buildNotchContour(dock, w, h, { armThickness });
    sendWin32Command(`RGN_PATH ${hwnd} ${contourToWin32PathSpec(contour)}`);
    return;
  }

  const radiusPx = getPhysicalRadius(win, radiusDip);
  sendWin32Command(`RGN ${hwnd} ${radiusPx}`);
  sendWin32Command(`SYNC_HOST_BLUR ${hwnd} ${radiusPx}`);
}

/**
 * Cleanly terminates any platform helper process on application quit.
 */
export function disposePlatformGlass(): void {
  pendingWin32Commands.length = 0;
  win32HelperReady = false;
  modeListeners.clear();
  if (win32Helper) {
    try {
      win32Helper.stdin.end();
      win32Helper.kill();
    } catch {
      // Ignore already exited process
    }
    win32Helper = null;
  }
}
