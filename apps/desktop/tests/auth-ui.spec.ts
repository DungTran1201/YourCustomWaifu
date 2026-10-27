import { describe, it, expect, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import App from "../src/workspace/App.vue";
import { useAppStore } from "@vrm/app-core";

describe("Workspace Desktop Authentication UI & Navigation Flow", () => {
  beforeEach(() => {
    const store = useAppStore();
    store.setTab("signin");
    store.state.isAuthenticated = false;
    store.state.user = null;
    store.state.sessions = [];
    store.state.secrets = [];
    store.state.authError = null;
    store.state.authNotice = null;
  });

  it("renders unauthenticated state on startup with sign in form and no legacy overview", () => {
    const wrapper = mount(App);
    const store = useAppStore();

    expect(store.state.isAuthenticated).toBe(false);
    expect(wrapper.find("#signin-email").exists()).toBe(true);
    expect(wrapper.find("#signin-password").exists()).toBe(true);
    expect(wrapper.find("#nav-signin-btn").exists()).toBe(true);
    expect(wrapper.find("#nav-signup-btn").exists()).toBe(true);

    // Strict regression assertion: legacy overview marketing strings must not exist
    expect(wrapper.text()).not.toContain("Architecture Reset Complete");
    expect(wrapper.text()).not.toContain("Monorepo Topology");
    expect(wrapper.text()).not.toContain("Unified Presentation");
    expect(wrapper.text()).not.toContain("Shared Web & Desktop Authentication");
    expect(wrapper.find("#overview-signin-btn").exists()).toBe(false);
  });

  it("navigates to Sign In view and verifies form elements", async () => {
    const wrapper = mount(App);
    const store = useAppStore();

    await wrapper.find("#nav-signin-btn").trigger("click");
    expect(store.state.currentTab).toBe("signin");
    expect(wrapper.text()).toContain("Welcome Back");
    expect(wrapper.find("#signin-email").exists()).toBe(true);
    expect(wrapper.find("#signin-password").exists()).toBe(true);
    expect(wrapper.find("#signin-submit-btn").exists()).toBe(true);
  });

  it("navigates to Sign Up view and displays NIST 15-char requirement and unverified notice", async () => {
    const wrapper = mount(App);
    const store = useAppStore();

    await wrapper.find("#nav-signup-btn").trigger("click");
    expect(store.state.currentTab).toBe("signup");
    expect(wrapper.text()).toContain("Create Account");
    expect(wrapper.text()).toContain("No Email Verification Required");
    expect(wrapper.text()).toContain(
      "15 characters minimum (NIST SP 800-63B-4 standard)",
    );
    expect(wrapper.find("#signup-email").exists()).toBe(true);
    expect(wrapper.find("#signup-password").exists()).toBe(true);
    expect(wrapper.find("#signup-submit-btn").exists()).toBe(true);
  });

  it("dynamically shows companion tabs and user pill when authenticated", async () => {
    const wrapper = mount(App);
    const store = useAppStore();

    store.state.isAuthenticated = true;
    store.state.user = {
      id: "usr_desktop_test",
      email: "desktop@waifu.local",
      displayName: "Desktop Master",
      status: "active",
      emailVerified: true,
      emailStatusNotice: "Desktop verified",
      avatarUrl: null,
      locale: "en-US",
      timezone: "UTC",
      createdAt: new Date().toISOString(),
    };

    await wrapper.vm.$nextTick();

    expect(wrapper.find("#nav-tab-chat").exists()).toBe(true);
    expect(wrapper.find("#nav-tab-avatar").exists()).toBe(true);
    expect(wrapper.find("#nav-tab-agents").exists()).toBe(true);
    expect(wrapper.find("#nav-tab-skills").exists()).toBe(true);
    expect(wrapper.find("#nav-tab-rules").exists()).toBe(true);
    expect(wrapper.find("#nav-tab-tools").exists()).toBe(true);
    expect(wrapper.find("#nav-tab-connections").exists()).toBe(true);
    expect(wrapper.find("#nav-tab-memory").exists()).toBe(true);
    expect(wrapper.find("#nav-user-pill").exists()).toBe(true);
    expect(wrapper.find("#nav-signout-btn").exists()).toBe(true);
  });

  it("submits desktop registration via window.desktopAPI and transitions to chat", async () => {
    let registrationPayload: any = null;
    (window as any).desktopAPI = {
      getDiagnostics: async () => ({}) as any,
      auth: {
        register: async (creds: any) => {
          registrationPayload = creds;
          return {
            user: {
              id: "usr_reg_123",
              email: creds.email,
              displayName: creds.displayName || "New Companion User",
              status: "active",
              emailVerified: false,
              emailStatusNotice:
                "Email address is self-asserted and unverified.",
              avatarUrl: null,
              locale: "en-US",
              timezone: "UTC",
              createdAt: new Date().toISOString(),
            },
          };
        },
      },
    };

    const wrapper = mount(App);
    const store = useAppStore();
    store.setTab("signup");
    await wrapper.vm.$nextTick();

    const emailInput = wrapper.find("#signup-email");
    const nameInput = wrapper.find("#signup-name");
    const passwordInput = wrapper.find("#signup-password");

    await emailInput.setValue("newuser@desktop.local");
    await nameInput.setValue("Local Companion User");
    await passwordInput.setValue("ValidPassword123456789!");

    const form = wrapper.find(".auth-form");
    await form.trigger("submit.prevent");
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(registrationPayload).toEqual({
      email: "newuser@desktop.local",
      displayName: "Local Companion User",
      password: "ValidPassword123456789!",
    });

    expect(store.state.isAuthenticated).toBe(true);
    expect(store.state.user?.email).toBe("newuser@desktop.local");
    expect(store.state.currentTab).toBe("chat");

    delete (window as any).desktopAPI;
  });

  it("displays actionable server error in UI when desktop registration fails", async () => {
    (window as any).desktopAPI = {
      getDiagnostics: async () => ({}) as any,
      auth: {
        register: async () => {
          throw new Error("An account with this email address already exists.");
        },
      },
    };

    const wrapper = mount(App);
    const store = useAppStore();
    store.setTab("signup");
    await wrapper.vm.$nextTick();

    await wrapper.find("#signup-email").setValue("duplicate@desktop.local");
    await wrapper.find("#signup-password").setValue("ValidPassword123456789!");

    const form = wrapper.find(".auth-form");
    await form.trigger("submit.prevent");
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(store.state.isAuthenticated).toBe(false);
    expect(wrapper.find(".alert-error").exists()).toBe(true);
    expect(wrapper.find(".alert-error").text()).toContain(
      "An account with this email address already exists.",
    );

    delete (window as any).desktopAPI;
  });
});
