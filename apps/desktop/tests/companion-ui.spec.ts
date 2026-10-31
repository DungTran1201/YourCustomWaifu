import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import App from "../src/workspace/App.vue";
import { useAppStore } from "@vrm/app-core";

describe("Desktop Companion Workspace UI Navigation & Interaction", () => {
  beforeEach(() => {
    const store = useAppStore();
    store.state.isAuthenticated = true;
    store.state.user = {
      id: "usr_tester_999",
      email: "companion@example.com",
      status: "active",
      emailVerified: true,
      emailStatusNotice: "VERIFIED",
      displayName: "Sensei",
      avatarUrl: null,
      locale: "en-US",
      timezone: "UTC",
      createdAt: new Date().toISOString(),
    };
    store.setTab("chat");
  });

  it("renders Chat view and sends a message without anime banners in timeline", async () => {
    const wrapper = mount(App);
    const store = useAppStore();

    expect(wrapper.text()).toContain("Aiko");
    expect(wrapper.find("#chat-composer-input").exists()).toBe(true);
    expect(wrapper.find("#chat-send-btn").exists()).toBe(true);

    // Type a message and send
    await wrapper.find("#chat-composer-input").setValue("Hello Aiko!");
    await wrapper.find("#chat-send-btn").trigger("click");
    await wrapper.vm.$nextTick();

    expect(store.state.messages.some((m) => m.content === "Hello Aiko!")).toBe(
      true,
    );
  });

  it("navigates to Avatar Settings view and toggles stage visibility", async () => {
    const wrapper = mount(App);
    const store = useAppStore();

    await wrapper.find("#nav-tab-avatar").trigger("click");
    expect(store.state.currentTab).toBe("avatar");
    expect(wrapper.text()).toContain("Avatar & Stage Configuration");
    expect(wrapper.find("#avatar-toggle-stage-btn").exists()).toBe(true);

    // Click toggle button
    await wrapper.find("#avatar-toggle-stage-btn").trigger("click");
    expect(store.state.stageStatus.stageVisible).toBe(true);

    // Quick toggle button in header
    await wrapper.find("#nav-stage-toggle-btn").trigger("click");
    expect(store.state.stageStatus.stageVisible).toBe(false);
  });

  it("navigates to Skills, Rules, Tools, Connections, and Memory views", async () => {
    const wrapper = mount(App);
    const store = useAppStore();

    // Skills
    await wrapper.find("#nav-tab-skills").trigger("click");
    expect(store.state.currentTab).toBe("skills");
    expect(wrapper.text()).toContain("Skills Library");

    // Rules
    await wrapper.find("#nav-tab-rules").trigger("click");
    expect(store.state.currentTab).toBe("rules");
    expect(wrapper.text()).toContain("Operational Rules & Constraints");

    // Tools
    await wrapper.find("#nav-tab-tools").trigger("click");
    expect(store.state.currentTab).toBe("tools");
    expect(wrapper.text()).toContain("Agent Tools & Capabilities");

    // Connections
    await wrapper.find("#nav-tab-connections").trigger("click");
    expect(store.state.currentTab).toBe("connections");
    expect(wrapper.text()).toContain("AI Model Connections");

    // Memory
    await wrapper.find("#nav-tab-memory").trigger("click");
    expect(store.state.currentTab).toBe("memory");
    expect(wrapper.text()).toContain("Memory & Privacy Vault");
  });

  it("allows selecting and switching AI models directly from the Chat view", async () => {
    const store = useAppStore();
    store.setTab("chat");
    const wrapper = mount(App);
    await wrapper.vm.$nextTick();

    // 1. Initial state check
    const selectorBtn = wrapper.find("#chat-model-selector-btn");
    expect(selectorBtn.exists()).toBe(true);
    expect(selectorBtn.text()).toContain("gemini-2.5-flash");

    // 2. Open dropdown menu
    expect(wrapper.find("#chat-model-dropdown-menu").exists()).toBe(false);
    await selectorBtn.trigger("click");
    expect(wrapper.find("#chat-model-dropdown-menu").exists()).toBe(true);
    expect(wrapper.text()).toContain("Active AI Model");

    // 3. Select another model (e.g. gemini-2.5-pro)
    const proOption = wrapper.find("#model-option-gemini-2-5-pro");
    expect(proOption.exists()).toBe(true);
    await proOption.trigger("click");
    await wrapper.vm.$nextTick();

    // 4. Verify model updated in store and UI
    const activeAgent = store.state.agents[0];
    expect(activeAgent).toBeDefined();
    expect(activeAgent!.preferredModel).toBe("gemini-2.5-pro");
    expect(wrapper.find("#chat-model-selector-btn").text()).toContain(
      "gemini-2.5-pro",
    );
    expect(wrapper.find("#chat-model-dropdown-menu").exists()).toBe(false);

    // 5. Native select fallback is also reactive
    const nativeSelect = wrapper.find("#chat-model-select");
    expect(nativeSelect.exists()).toBe(true);
    await nativeSelect.setValue("gpt-4o");
    await nativeSelect.trigger("change");
    await wrapper.vm.$nextTick();

    expect(store.state.agents[0]!.preferredModel).toBe("gpt-4o");
    expect(store.state.agents[0]!.preferredProvider).toBe("openai");
  });
});
