import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mount, enableAutoUnmount } from "@vue/test-utils";
import App from "../src/workspace/App.vue";
import ShellLayout from "../src/components/ShellLayout.vue";
import NavigationBar from "../src/components/NavigationBar.vue";
import ChatView from "../src/workspace/views/ChatView.vue";
import AvatarSettingsView from "../src/workspace/views/AvatarSettingsView.vue";
import AgentsView from "../src/workspace/views/AgentsView.vue";
import SkillsView from "../src/workspace/views/SkillsView.vue";
import RulesView from "../src/workspace/views/RulesView.vue";
import ToolsView from "../src/workspace/views/ToolsView.vue";
import ConnectionsView from "../src/workspace/views/ConnectionsView.vue";
import MemoryView from "../src/workspace/views/MemoryView.vue";
import ActivityView from "../src/workspace/views/ActivityView.vue";
import ProfileView from "../src/workspace/views/ProfileView.vue";
import SecretsView from "../src/workspace/views/SecretsView.vue";
import SecurityView from "../src/workspace/views/SecurityView.vue";
import SettingsView from "../src/workspace/views/SettingsView.vue";
import DiagnosticsView from "../src/workspace/views/DiagnosticsView.vue";
import SignInView from "../src/workspace/views/SignInView.vue";
import SignUpView from "../src/workspace/views/SignUpView.vue";
import ForgotPasswordView from "../src/workspace/views/ForgotPasswordView.vue";
import ResetPasswordView from "../src/workspace/views/ResetPasswordView.vue";
import { useAppStore } from "@vrm/app-core";

describe("Workspace Desktop Responsive Layout & Viewport Adaptation", () => {
  enableAutoUnmount(afterEach);
  const originalInnerWidth = window.innerWidth;
  const originalInnerHeight = window.innerHeight;

  function setViewport(width: number, height: number) {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: width,
    });
    Object.defineProperty(window, "innerHeight", {
      writable: true,
      configurable: true,
      value: height,
    });
    window.dispatchEvent(new Event("resize"));
  }

  beforeEach(() => {
    const store = useAppStore();
    store.state.isAuthenticated = true;
    store.state.user = {
      id: "usr_responsive_tester",
      email: "responsive@desktop.local",
      status: "active",
      emailVerified: true,
      emailStatusNotice: "VERIFIED",
      displayName: "Responsive Tester",
      avatarUrl: null,
      locale: "en-US",
      timezone: "UTC",
      createdAt: new Date().toISOString(),
    };
    store.state.windowMode = "combined";
    store.state.sidebarCollapsed = false;
    store.state.menubarVisible = true;
    store.state.panelVisible = true;
    store.updateSettings({ theme: "light" });
    store.setTab("chat");
    setViewport(1100, 740);
  });

  afterEach(() => {
    setViewport(originalInnerWidth, originalInnerHeight);
  });

  describe("ShellLayout Root & Independent Headerless Multi-Window Modes", () => {
    it("renders headerless shell layout with separated Menubar (bottom user dock) and Panel", () => {
      const wrapper = mount(ShellLayout);
      expect(wrapper.find(".shell-layout").exists()).toBe(true);
      expect(wrapper.find(".shell-topbar").exists()).toBe(false);
      expect(wrapper.find(".shell-body").exists()).toBe(true);
      expect(wrapper.find(".shell-main.glass-panel-surface").exists()).toBe(
        true,
      );
      expect(wrapper.find(".workspace-sidebar").exists()).toBe(true);
      expect(
        wrapper
          .find(".workspace-sidebar .sidebar-footer #nav-user-pill")
          .exists(),
      ).toBe(true);
      expect(
        wrapper
          .find(".workspace-sidebar .sidebar-footer #nav-signout-btn")
          .exists(),
      ).toBe(true);
    });

    it("renders standalone Menubar window cleanly without Panel when windowMode is 'menubar'", () => {
      const store = useAppStore();
      store.state.windowMode = "menubar";

      const wrapper = mount(ShellLayout);
      expect(wrapper.find(".shell-topbar").exists()).toBe(false);
      expect(wrapper.find(".workspace-sidebar.detached").exists()).toBe(true);
      expect(wrapper.find(".shell-main").exists()).toBe(false);
      expect(wrapper.find("#nav-user-pill").exists()).toBe(true);
    });

    it("renders standalone headerless Panel window cleanly without Menubar when windowMode is 'panel'", () => {
      const store = useAppStore();
      store.state.windowMode = "panel";

      const wrapper = mount(ShellLayout);
      expect(wrapper.find(".shell-topbar").exists()).toBe(false);
      expect(wrapper.find(".workspace-sidebar").exists()).toBe(false);
      expect(wrapper.find(".shell-main.detached-panel-surface").exists()).toBe(
        true,
      );
      expect(wrapper.find(".panel-drag-strip").exists()).toBe(true);
    });

    it("mounts invisible 8-direction WindowResizeHandles for borderless frameless Electron windows", () => {
      const store = useAppStore();
      store.state.windowMode = "panel";
      (window as any).desktopAPI = {
        getDiagnostics: async () => ({ platform: "electron" }),
        workspace: {
          getWindowBounds: async () => ({
            x: 100,
            y: 100,
            width: 920,
            height: 740,
          }),
          setWindowBounds: async (b: any) => b,
        },
      };

      const wrapper = mount(ShellLayout);
      expect(wrapper.find(".window-resize-layer").exists()).toBe(true);
      expect(wrapper.findAll(".resize-edge")).toHaveLength(4);
      expect(wrapper.findAll(".resize-corner")).toHaveLength(4);
      expect(
        wrapper.find(".window-floating-controls #window-close-btn").exists(),
      ).toBe(true);

      delete (window as any).desktopAPI;
    });

    it("toggles independent Menubar and Panel visibility via Settings toggles, Menubar controls, and keyboard shortcuts", async () => {
      const store = useAppStore();
      store.setTab("settings");
      const wrapper = mount(ShellLayout);
      await wrapper.vm.$nextTick();

      // 1. Toggle Menubar off via Settings switch (#settings-menubar-toggle)
      const settingsMenubarToggle = wrapper.find("#settings-menubar-toggle");
      expect(settingsMenubarToggle.exists()).toBe(true);
      await settingsMenubarToggle.setValue(false);
      expect(store.state.menubarVisible).toBe(false);
      expect(wrapper.find(".workspace-sidebar").exists()).toBe(false);

      // Restore Menubar via Ctrl+B
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "b", ctrlKey: true }),
      );
      await wrapper.vm.$nextTick();
      expect(store.state.menubarVisible).toBe(true);
      expect(wrapper.find(".workspace-sidebar").exists()).toBe(true);

      // 2. Toggle Panel off via Menubar utility button (#panel-visibility-btn)
      const panelBtn = wrapper.find("#panel-visibility-btn");
      expect(panelBtn.exists()).toBe(true);
      await panelBtn.trigger("click");
      expect(store.state.panelVisible).toBe(false);
      expect(wrapper.find(".shell-main").exists()).toBe(false);
      expect(wrapper.find("#panel-restore-btn").exists()).toBe(true);

      // Restore Panel via Ctrl+\
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "\\",
          code: "Backslash",
          ctrlKey: true,
        }),
      );
      await wrapper.vm.$nextTick();
      expect(store.state.panelVisible).toBe(true);
      expect(wrapper.find(".shell-main").exists()).toBe(true);

      // 3. Collapse / Expand Menubar via Ctrl+Shift+B and Settings switch
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "B",
          ctrlKey: true,
          shiftKey: true,
        }),
      );
      await wrapper.vm.$nextTick();
      expect(store.state.sidebarCollapsed).toBe(true);
      expect(wrapper.find(".workspace-sidebar").classes()).toContain(
        "collapsed",
      );

      wrapper.unmount();
    });

    it("switches seamlessly between Light Glass and Dark Glass themes from Menubar dock", async () => {
      const store = useAppStore();
      const wrapper = mount(ShellLayout);

      expect(store.resolvedTheme.value).toBe("light");
      expect(document.documentElement.getAttribute("data-theme")).toBe("light");
      expect(wrapper.find(".shell-layout").classes()).toContain("theme-light");

      await wrapper.find("#theme-toggle-btn").trigger("click");
      await wrapper.vm.$nextTick();
      expect(store.resolvedTheme.value).toBe("dark");
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
      expect(wrapper.find(".shell-layout").classes()).toContain("theme-dark");

      wrapper.unmount();
    });

    it("applies 'chat-view-active' on .shell-main only when currentTab is 'chat'", async () => {
      const store = useAppStore();
      const wrapper = mount(ShellLayout);

      store.setTab("chat");
      await wrapper.vm.$nextTick();
      expect(wrapper.find(".shell-main").classes()).toContain(
        "chat-view-active",
      );

      store.setTab("avatar");
      await wrapper.vm.$nextTick();
      expect(wrapper.find(".shell-main").classes()).not.toContain(
        "chat-view-active",
      );

      store.setTab("settings");
      await wrapper.vm.$nextTick();
      expect(wrapper.find(".shell-main").classes()).not.toContain(
        "chat-view-active",
      );
    });
  });

  describe("NavigationBar Responsive Adaptation", () => {
    it("automatically collapses sidebar when window width <= 860px (e.g. 800px minimum)", async () => {
      setViewport(800, 560);
      const wrapper = mount(NavigationBar);
      await wrapper.vm.$nextTick();

      expect(wrapper.find(".workspace-sidebar").classes()).toContain(
        "collapsed",
      );
    });

    it("restores expanded state when window is resized above 860px if user has not collapsed it", async () => {
      setViewport(800, 560);
      const wrapper = mount(NavigationBar);
      await wrapper.vm.$nextTick();
      expect(wrapper.find(".workspace-sidebar").classes()).toContain(
        "collapsed",
      );

      // Expand window
      setViewport(1024, 768);
      await wrapper.vm.$nextTick();
      expect(wrapper.find(".workspace-sidebar").classes()).not.toContain(
        "collapsed",
      );
    });

    it("respects user's manual sidebar collapse even on wide viewports (1440px)", async () => {
      setViewport(1440, 900);
      const store = useAppStore();
      store.state.sidebarCollapsed = true;

      const wrapper = mount(NavigationBar);
      await wrapper.vm.$nextTick();
      expect(wrapper.find(".workspace-sidebar").classes()).toContain(
        "collapsed",
      );
    });

    it("preserves accessible titles and aria-labels on navigation items regardless of collapse state", async () => {
      setViewport(800, 560);
      const wrapper = mount(NavigationBar);
      await wrapper.vm.$nextTick();

      const chatTab = wrapper.find("#nav-tab-chat");
      expect(chatTab.exists()).toBe(true);
      expect(chatTab.attributes("title")).toBe("Chat");
      expect(chatTab.attributes("aria-label")).toBe("Chat");

      const avatarTab = wrapper.find("#nav-tab-avatar");
      expect(avatarTab.exists()).toBe(true);
      expect(avatarTab.attributes("title")).toBe("Avatar Stage");
      expect(avatarTab.attributes("aria-label")).toBe("Avatar Stage");
    });
  });

  describe("Target Viewport Matrix — 800x560 to 1440x900", () => {
    const targetSizes = [
      { width: 800, height: 560, name: "800x560 (Declared Native Minimum)" },
      { width: 900, height: 650, name: "900x650 (Compact Desktop)" },
      { width: 1024, height: 768, name: "1024x768 (Standard Small)" },
      { width: 1280, height: 800, name: "1280x800 (Standard Desktop)" },
      { width: 1440, height: 900, name: "1440x900 (Spacious Desktop)" },
    ];

    for (const size of targetSizes) {
      it(`renders full App shell cleanly at ${size.name}`, async () => {
        setViewport(size.width, size.height);
        const wrapper = mount(App);
        await wrapper.vm.$nextTick();

        expect(wrapper.find(".shell-layout").exists()).toBe(true);
        expect(wrapper.find(".shell-topbar").exists()).toBe(false);
        expect(wrapper.find(".workspace-sidebar").exists()).toBe(true);
        expect(wrapper.find(".shell-main").exists()).toBe(true);
      });
    }
  });

  describe("ChatView Layout and Composer Accessibility", () => {
    it("renders chat messages stream and keeps composer reachable", () => {
      const wrapper = mount(ChatView);
      expect(wrapper.find(".chat-workspace").exists()).toBe(true);
      expect(wrapper.find(".chat-header").exists()).toBe(true);
      expect(wrapper.find(".chat-messages").exists()).toBe(true);
      expect(wrapper.find(".chat-composer-container").exists()).toBe(true);
      expect(wrapper.find("#chat-composer-input").exists()).toBe(true);
      expect(wrapper.find("#chat-send-btn").exists()).toBe(true);
    });

    it("displays quick prompt chips that can wrap without breaking the layout", async () => {
      const store = useAppStore();
      store.state.messages = [];
      const wrapper = mount(ChatView);
      await wrapper.vm.$nextTick();
      const chips = wrapper.findAll(".quick-prompt-chip");
      expect(chips.length).toBeGreaterThan(0);
    });
  });

  describe("All 18 Workspace Views Mount Cleanly", () => {
    const views = [
      { name: "ChatView", component: ChatView },
      { name: "AvatarSettingsView", component: AvatarSettingsView },
      { name: "AgentsView", component: AgentsView },
      { name: "SkillsView", component: SkillsView },
      { name: "RulesView", component: RulesView },
      { name: "ToolsView", component: ToolsView },
      { name: "ConnectionsView", component: ConnectionsView },
      { name: "MemoryView", component: MemoryView },
      { name: "ActivityView", component: ActivityView },
      { name: "ProfileView", component: ProfileView },
      { name: "SecretsView", component: SecretsView },
      { name: "SecurityView", component: SecurityView },
      { name: "SettingsView", component: SettingsView },
      { name: "DiagnosticsView", component: DiagnosticsView },
      { name: "SignInView", component: SignInView },
      { name: "SignUpView", component: SignUpView },
      { name: "ForgotPasswordView", component: ForgotPasswordView },
      { name: "ResetPasswordView", component: ResetPasswordView },
    ];

    for (const v of views) {
      it(`mounts ${v.name} without layout errors or uncaught exceptions at 800x560`, async () => {
        setViewport(800, 560);
        const wrapper = mount(v.component);
        expect(wrapper.exists()).toBe(true);
      });
    }
  });

  describe("Anti-Regression: No Global Zoom or Transform Scaling", () => {
    it("confirms no zoom or scale(...) transforms exist in component root styles", () => {
      const wrapper = mount(ShellLayout);
      const html = wrapper.html();
      expect(html).not.toContain("zoom:");
      expect(html).not.toContain("transform: scale(");
    });
  });
});
