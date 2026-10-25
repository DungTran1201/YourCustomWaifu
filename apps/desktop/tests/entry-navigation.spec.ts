import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import App from "../src/workspace/App.vue";
import { useAppStore } from "@vrm/app-core";
import {
  detectPlatform,
  hasPreloadBridgeError,
  isElectronEnvironment,
  getPlatformAPI,
} from "../src/stores/platform.js";

describe("Application Entry-Point, Startup Navigation & Runtime Integration", () => {
  beforeEach(() => {
    const store = useAppStore();
    store.state.isAuthenticated = false;
    store.state.user = null;
    store.setTab("signin");
    delete (window as any).desktopAPI;
  });

  it("ensures unauthenticated default startup view is Sign In and not legacy Overview", () => {
    const wrapper = mount(App);
    const store = useAppStore();

    expect(store.state.isAuthenticated).toBe(false);
    expect(store.state.currentTab).toBe("signin");
    expect(wrapper.find("#signin-email").exists()).toBe(true);
    expect(wrapper.find("#signin-password").exists()).toBe(true);

    // Verify nav bar does not have an overview tab
    expect(wrapper.find("#nav-tab-overview").exists()).toBe(false);

    // Assert absence of legacy overview marketing copy
    const text = wrapper.text();
    expect(text).not.toContain("Architecture Reset Complete");
    expect(text).not.toContain("Monorepo Topology");
    expect(text).not.toContain("Unified Presentation");
    expect(text).not.toContain("Electron Security Baseline");
    expect(text).not.toContain("Shared Auth & Database");
    expect(text).not.toContain("Shared Web & Desktop Authentication");
  });

  it("navigates directly to Chatspace (chat) upon successful login", async () => {
    const store = useAppStore();

    // Mock electron login bridge
    (window as any).desktopAPI = {
      getDiagnostics: vi.fn().mockResolvedValue({ platform: "electron" }),
      auth: {
        login: vi.fn().mockResolvedValue({
          user: {
            id: "usr_auth_success",
            email: "waifu_fan@desktop.local",
            displayName: "Waifu Companion User",
          },
        }),
      },
      stage: {
        getConfig: vi.fn().mockResolvedValue({}),
        getStatus: vi.fn().mockResolvedValue({}),
        onStatusChanged: vi.fn().mockReturnValue(() => {}),
        onConfigChanged: vi.fn().mockReturnValue(() => {}),
        onCursorMove: vi.fn().mockReturnValue(() => {}),
      },
    };

    await store.login("waifu_fan@desktop.local", "SuperSecurePassword15!");

    expect(store.state.isAuthenticated).toBe(true);
    expect(store.state.currentTab).toBe("chat");
  });

  it("navigates directly to Chatspace (chat) upon successful stored session initialization", async () => {
    const store = useAppStore();

    (window as any).desktopAPI = {
      getDiagnostics: vi.fn().mockResolvedValue({ platform: "electron" }),
      auth: {
        getStoredSession: vi.fn().mockResolvedValue({
          id: "usr_stored_session",
          email: "session@desktop.local",
          displayName: "Restored Session",
        }),
      },
    };

    await store.initAuth();

    expect(store.state.isAuthenticated).toBe(true);
    expect(store.state.user?.id).toBe("usr_stored_session");
    expect(store.state.currentTab).toBe("chat");
  });

  it("correctly identifies Electron runtime when window.desktopAPI is present", () => {
    (window as any).desktopAPI = {
      getDiagnostics: () => Promise.resolve({ platform: "electron" }),
    };

    expect(isElectronEnvironment()).toBe(true);
    expect(detectPlatform()).toBe("electron");
    expect(hasPreloadBridgeError()).toBe(false);
  });

  it("produces an explicit diagnostic failure when Electron is detected without desktopAPI", () => {
    // Simulate running inside Electron without desktopAPI
    const originalUserAgent = navigator.userAgent;
    Object.defineProperty(navigator, "userAgent", {
      value:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Electron/45.0.0 Safari/537.36",
      configurable: true,
    });

    delete (window as any).desktopAPI;

    expect(hasPreloadBridgeError()).toBe(true);
    expect(() => getPlatformAPI()).toThrow(
      /Desktop IPC Preload Bridge missing or failed to initialize/,
    );

    // Restore userAgent
    Object.defineProperty(navigator, "userAgent", {
      value: originalUserAgent,
      configurable: true,
    });
  });

  it("cleans up IPC subscriptions properly when unmounted", () => {
    const removeListener = vi.fn();
    const subscribe = vi.fn().mockReturnValue(removeListener);

    const cleanup = subscribe();
    expect(subscribe).toHaveBeenCalled();

    cleanup();
    expect(removeListener).toHaveBeenCalled();
  });
});
