import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import App from "../src/renderer/src/App.vue";
import { useAppStore } from "@vrm/app-core";

describe("Workspace Desktop Authentication UI & Navigation Flow", () => {
  beforeEach(() => {
    const store = useAppStore();
    store.setTab("overview");
    store.state.isAuthenticated = false;
    store.state.user = null;
    store.state.sessions = [];
    store.state.secrets = [];
    store.state.authError = null;
    store.state.authNotice = null;
  });

  it("renders unauthenticated state on overview with sign in and register buttons", () => {
    const wrapper = mount(App);
    const store = useAppStore();

    expect(store.state.isAuthenticated).toBe(false);
    expect(wrapper.find("#overview-signin-btn").exists()).toBe(true);
    expect(wrapper.find("#overview-signup-btn").exists()).toBe(true);
    expect(wrapper.find("#nav-signin-btn").exists()).toBe(true);
    expect(wrapper.find("#nav-signup-btn").exists()).toBe(true);
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
});
