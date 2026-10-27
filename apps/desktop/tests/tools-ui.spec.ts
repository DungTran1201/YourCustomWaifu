import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import ToolsView from "../src/workspace/views/ToolsView.vue";
import { useAppStore } from "@vrm/app-core";

describe("F08: Tools UI - Interactive Sandbox & Parameter Discovery", () => {
  let store: ReturnType<typeof useAppStore>;

  beforeEach(() => {
    store = useAppStore();
    store.state.tools = [
      {
        id: "tool_test_expression",
        name: "Avatar Expression Engine",
        category: "Presentation",
        description: "Triggers facial expressions on Avatar Stage",
        permissionLevel: "user-action",
        requiresConfirmation: false,
        enabled: true,
        status: "ready",
        parameters: {
          expression: {
            type: "string",
            description: "Target expression",
            required: true,
            enum: ["neutral", "happy", "wink"],
          },
          intensity: {
            type: "number",
            description: "Intensity between 0 and 1",
            required: false,
            default: 1.0,
          },
        },
      },
      {
        id: "tool_test_sensitive",
        name: "Sensitive System Action",
        category: "System",
        description: "Requires explicit user confirmation",
        permissionLevel: "system",
        requiresConfirmation: true,
        enabled: true,
        status: "ready",
        parameters: {},
      },
    ];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders tool cards and toggles enablement", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ id: "tool_test_expression", enabled: false }),
    } as Response);

    const wrapper = mount(ToolsView);
    expect(wrapper.text()).toContain("Avatar Expression Engine");
    expect(wrapper.text()).toContain("Sensitive System Action");

    const toggle = wrapper.find("#tool-toggle-tool_test_expression");
    expect(toggle.exists()).toBe(true);
    await toggle.trigger("change");
    expect(store.state.tools[0]?.enabled).toBe(false);
    expect(fetchSpy).toHaveBeenCalled();
  });

  it("expands testing sandbox and submits tool execution", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({
        success: true,
        toolId: "tool_test_expression",
        result: { applied: true, expression: "happy", intensity: 1.0 },
        executionTimeMs: 12,
      }),
    } as Response);

    const wrapper = mount(ToolsView);
    const testBtn = wrapper.find("#tool-test-btn-tool_test_expression");
    expect(testBtn.exists()).toBe(true);

    // Click Test Execution button
    await testBtn.trigger("click");
    expect(wrapper.find("#tool-test-panel-tool_test_expression").exists()).toBe(
      true,
    );

    // Verify parameter controls
    const select = wrapper.find("#tool-input-tool_test_expression-expression");
    expect(select.exists()).toBe(true);
    await select.setValue("happy");

    // Click execute
    const execBtn = wrapper.find("#tool-exec-btn-tool_test_expression");
    await execBtn.trigger("click");
    await flushPromises();

    expect(fetchSpy).toHaveBeenCalled();
    const calls = fetchSpy.mock.calls;
    const executeCall = calls.find((c) =>
      String(c[0]).includes("/api/v1/tools/tool_test_expression/execute"),
    );
    expect(executeCall).toBeDefined();

    const requestBody = JSON.parse(String((executeCall![1] as any).body));
    expect(requestBody.args.expression).toBe("happy");
    expect(requestBody.confirmed).toBe(false);

    // Check result rendered in DOM
    expect(wrapper.text()).toContain("Success");
    expect(wrapper.text()).toContain("12ms");
  });

  it("passes confirmation flag when user confirms gate", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({
        success: true,
        toolId: "tool_test_sensitive",
        result: { executed: true },
        executionTimeMs: 8,
      }),
    } as Response);

    const wrapper = mount(ToolsView);
    await wrapper.find("#tool-test-btn-tool_test_sensitive").trigger("click");

    // Check confirmation warning
    expect(wrapper.text()).toContain("Requires User Confirmation Gate");

    // Check confirmation checkbox
    const confirmCheck = wrapper.find(
      "#tool-confirm-check-tool_test_sensitive",
    );
    expect(confirmCheck.exists()).toBe(true);
    await confirmCheck.setValue(true);

    await wrapper.find("#tool-exec-btn-tool_test_sensitive").trigger("click");
    await flushPromises();

    expect(fetchSpy).toHaveBeenCalled();
    const calls = fetchSpy.mock.calls;
    const executeCall = calls.find((c) =>
      String(c[0]).includes("/api/v1/tools/tool_test_sensitive/execute"),
    );
    expect(executeCall).toBeDefined();

    const requestBody = JSON.parse(String((executeCall![1] as any).body));
    expect(requestBody.confirmed).toBe(true);
  });
});
