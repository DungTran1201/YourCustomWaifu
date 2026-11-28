import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { useAppStore } from "@vrm/app-core";
import { IPC_CHANNELS } from "@vrm/platform-contracts";
import { buildNotchContour, contourToSvgPath } from "@vrm/shared";
import NavigationBar from "../src/components/NavigationBar.vue";
import { getGlassBrowserWindowOptions } from "../electron/main/platform-glass.js";
import {
  resolveMenubarPerimeterDrag,
  NOTCH_HORIZONTAL_WIDTH,
  NOTCH_HORIZONTAL_HEIGHT,
  NOTCH_VERTICAL_WIDTH,
  NOTCH_VERTICAL_HEIGHT,
  NOTCH_CORNER_OUTER_SIZE,
} from "../electron/main/menubar-notch.js";

const WORK_AREA = { x: 0, y: 0, width: 1920, height: 1040 };

describe("Menubar Dynamic Edge Notch & 90-Degree Corner Folding", () => {
  beforeEach(() => {
    const store = useAppStore();
    store.state.isAuthenticated = true;
    store.state.isGuest = false;
    store.state.windowMode = "menubar";
    store.state.menubarDock = "floating";
    store.state.sidebarCollapsed = false;
  });

  describe("1. Pure Perimeter Drag & Morph Geometry", () => {
    it("snaps floating Menubar into a compact vertical Notch on left and right edges", () => {
      const snapLeft = resolveMenubarPerimeterDrag({
        cursorX: 8,
        cursorY: 420,
        grabOffsetX: 30,
        grabOffsetY: 16,
        currentDock: "floating",
        workArea: WORK_AREA,
        floatingWidth: 228,
        floatingHeight: 740,
      });
      expect(snapLeft.dock).toBe("left");
      expect(snapLeft.bounds.x).toBe(0);
      expect(snapLeft.bounds.width).toBe(NOTCH_VERTICAL_WIDTH);
      expect(snapLeft.bounds.height).toBe(NOTCH_VERTICAL_HEIGHT);

      const snapRight = resolveMenubarPerimeterDrag({
        cursorX: 1912,
        cursorY: 420,
        grabOffsetX: 180,
        grabOffsetY: 16,
        currentDock: "floating",
        workArea: WORK_AREA,
        floatingWidth: 228,
        floatingHeight: 740,
      });
      expect(snapRight.dock).toBe("right");
      expect(snapRight.bounds.x).toBe(1920 - NOTCH_VERTICAL_WIDTH);
      expect(snapRight.bounds.width).toBe(NOTCH_VERTICAL_WIDTH);
    });

    it("snaps floating Menubar into a compact horizontal Notch on top and bottom edges", () => {
      const snapTop = resolveMenubarPerimeterDrag({
        cursorX: 960,
        cursorY: 6,
        grabOffsetX: 100,
        grabOffsetY: 12,
        currentDock: "floating",
        workArea: WORK_AREA,
        floatingWidth: 228,
        floatingHeight: 740,
      });
      expect(snapTop.dock).toBe("top");
      expect(snapTop.bounds.y).toBe(0);
      expect(snapTop.bounds.width).toBe(NOTCH_HORIZONTAL_WIDTH);
      expect(snapTop.bounds.height).toBe(NOTCH_HORIZONTAL_HEIGHT);

      const snapBottom = resolveMenubarPerimeterDrag({
        cursorX: 960,
        cursorY: 1034,
        grabOffsetX: 100,
        grabOffsetY: 12,
        currentDock: "floating",
        workArea: WORK_AREA,
        floatingWidth: 228,
        floatingHeight: 740,
      });
      expect(snapBottom.dock).toBe("bottom");
      expect(snapBottom.bounds.y).toBe(1040 - NOTCH_HORIZONTAL_HEIGHT);
      expect(snapBottom.bounds.height).toBe(NOTCH_HORIZONTAL_HEIGHT);
    });

    it("slides smoothly around the screen perimeter and folds 90 degrees at every corner", () => {
      // Slide along top edge into top-right corner
      const foldTopRight = resolveMenubarPerimeterDrag({
        cursorX: 1890,
        cursorY: 14,
        grabOffsetX: 20,
        grabOffsetY: 12,
        currentDock: "top",
        workArea: WORK_AREA,
        floatingWidth: 228,
        floatingHeight: 740,
      });
      expect(foldTopRight.dock).toBe("top-right");
      expect(foldTopRight.bounds).toEqual({
        x: 1920 - NOTCH_CORNER_OUTER_SIZE,
        y: 0,
        width: NOTCH_CORNER_OUTER_SIZE,
        height: NOTCH_CORNER_OUTER_SIZE,
      });

      // Continue down from top-right corner -> unfolds onto right vertical edge
      const slideToRight = resolveMenubarPerimeterDrag({
        cursorX: 1905,
        cursorY: 140,
        grabOffsetX: 20,
        grabOffsetY: 20,
        currentDock: "top-right",
        workArea: WORK_AREA,
        floatingWidth: 228,
        floatingHeight: 740,
      });
      expect(slideToRight.dock).toBe("right");
      expect(slideToRight.bounds.x).toBe(1920 - NOTCH_VERTICAL_WIDTH);

      // Slide down right edge into bottom-right 90-degree corner
      const foldBottomRight = resolveMenubarPerimeterDrag({
        cursorX: 1905,
        cursorY: 1015,
        grabOffsetX: 20,
        grabOffsetY: 20,
        currentDock: "right",
        workArea: WORK_AREA,
        floatingWidth: 228,
        floatingHeight: 740,
      });
      expect(foldBottomRight.dock).toBe("bottom-right");
      expect(foldBottomRight.bounds).toEqual({
        x: 1920 - NOTCH_CORNER_OUTER_SIZE,
        y: 1040 - NOTCH_CORNER_OUTER_SIZE,
        width: NOTCH_CORNER_OUTER_SIZE,
        height: NOTCH_CORNER_OUTER_SIZE,
      });

      // Continue left from bottom-right -> bottom edge -> bottom-left corner
      const slideToBottom = resolveMenubarPerimeterDrag({
        cursorX: 1780,
        cursorY: 1020,
        grabOffsetX: 20,
        grabOffsetY: 20,
        currentDock: "bottom-right",
        workArea: WORK_AREA,
        floatingWidth: 228,
        floatingHeight: 740,
      });
      expect(slideToBottom.dock).toBe("bottom");

      const foldBottomLeft = resolveMenubarPerimeterDrag({
        cursorX: 30,
        cursorY: 1020,
        grabOffsetX: 20,
        grabOffsetY: 20,
        currentDock: "bottom",
        workArea: WORK_AREA,
        floatingWidth: 228,
        floatingHeight: 740,
      });
      expect(foldBottomLeft.dock).toBe("bottom-left");

      // Continue up left edge -> top-left corner -> top edge
      const slideToLeft = resolveMenubarPerimeterDrag({
        cursorX: 14,
        cursorY: 900,
        grabOffsetX: 20,
        grabOffsetY: 20,
        currentDock: "bottom-left",
        workArea: WORK_AREA,
        floatingWidth: 228,
        floatingHeight: 740,
      });
      expect(slideToLeft.dock).toBe("left");

      const foldTopLeft = resolveMenubarPerimeterDrag({
        cursorX: 14,
        cursorY: 20,
        grabOffsetX: 20,
        grabOffsetY: 20,
        currentDock: "left",
        workArea: WORK_AREA,
        floatingWidth: 228,
        floatingHeight: 740,
      });
      expect(foldTopLeft.dock).toBe("top-left");
    });

    it("detaches back into floating Menubar when dragged inward away from border", () => {
      const detach = resolveMenubarPerimeterDrag({
        cursorX: 320,
        cursorY: 480,
        grabOffsetX: 20,
        grabOffsetY: 20,
        currentDock: "left",
        workArea: WORK_AREA,
        floatingWidth: 228,
        floatingHeight: 740,
      });
      expect(detach.dock).toBe("floating");
      expect(detach.bounds.width).toBe(228);
      expect(detach.bounds.height).toBe(740);
    });
  });

  describe("2. Vue NavigationBar Morph Rendering & IPC Contracts", () => {
    it("exports WORKSPACE_SET_MENUBAR_DOCK and WORKSPACE_DRAG_MENUBAR IPC channels", () => {
      expect(IPC_CHANNELS.WORKSPACE_SET_MENUBAR_DOCK).toBe(
        "workspace:set-menubar-dock",
      );
      expect(IPC_CHANNELS.WORKSPACE_DRAG_MENUBAR).toBe(
        "workspace:drag-menubar",
      );
    });

    it("morphs NavigationBar DOM across floating sidebar, horizontal/vertical edge notch, and 90-degree L-corner notch", async () => {
      const store = useAppStore();
      const wrapper = mount(NavigationBar, { props: { detached: true } });

      // Default: floating sidebar
      expect(wrapper.find(".workspace-sidebar.detached").exists()).toBe(true);
      expect(wrapper.find(".edge-notch-bar").exists()).toBe(false);
      expect(wrapper.find(".corner-notch-shell").exists()).toBe(false);

      // Horizontal top edge notch with iPhone-notch SVG clipPath
      store.state.menubarDock = "top";
      await wrapper.vm.$nextTick();
      expect(
        wrapper.find(".edge-notch-bar.dock-top.notch-horizontal").exists(),
      ).toBe(true);
      expect(wrapper.find("#menubar-notch-silhouette-clip path").exists()).toBe(
        true,
      );
      expect(wrapper.find("#nav-tab-chat").exists()).toBe(true);
      expect(wrapper.find("#notch-undock-btn").exists()).toBe(true);

      // Vertical right edge notch
      store.state.menubarDock = "right";
      await wrapper.vm.$nextTick();
      expect(
        wrapper.find(".edge-notch-bar.dock-right.notch-vertical").exists(),
      ).toBe(true);
      expect(wrapper.find("#menubar-notch-silhouette-clip path").exists()).toBe(
        true,
      );

      // 90-degree Corner L-Notch with unified L-arm SVG clipPath
      store.state.menubarDock = "bottom-right";
      await wrapper.vm.$nextTick();
      expect(
        wrapper.find(".corner-notch-shell.dock-bottom-right").exists(),
      ).toBe(true);
      expect(wrapper.find(".corner-arm-horizontal").exists()).toBe(true);
      expect(wrapper.find(".corner-arm-vertical").exists()).toBe(true);
      expect(wrapper.find(".corner-pivot-handle").exists()).toBe(true);
      expect(wrapper.find("#menubar-notch-silhouette-clip path").exists()).toBe(
        true,
      );

      // Click expand/undock restores floating and removes clipPath
      await wrapper.find("#notch-undock-btn").trigger("click");
      await wrapper.vm.$nextTick();
      expect(store.state.menubarDock).toBe("floating");
      expect(wrapper.find(".workspace-sidebar.detached").exists()).toBe(true);
      expect(wrapper.find("#menubar-notch-silhouette-clip").exists()).toBe(
        false,
      );
    });

    it("builds iPhone-style concave-ear & convex-corner Bezier contours for all 8 docked modes", () => {
      const topContour = buildNotchContour(
        "top",
        NOTCH_HORIZONTAL_WIDTH,
        NOTCH_HORIZONTAL_HEIGHT,
      );
      const topPath = contourToSvgPath(topContour);
      expect(topContour.startX).toBe(0);
      expect(topContour.startY).toBe(0);
      expect(topContour.ops.some((op) => op.kind === "C")).toBe(true);
      expect(
        topPath.startsWith("M 0 0 L " + NOTCH_HORIZONTAL_WIDTH + " 0"),
      ).toBe(true);
      expect(topPath.endsWith(" Z")).toBe(true);

      const cornerContour = buildNotchContour(
        "top-left",
        NOTCH_CORNER_OUTER_SIZE,
        NOTCH_CORNER_OUTER_SIZE,
      );
      const cornerPath = contourToSvgPath(cornerContour);
      expect(cornerContour.ops.filter((op) => op.kind === "C").length).toBe(5);
      expect(cornerPath.endsWith(" Z")).toBe(true);

      for (const dock of [
        "bottom",
        "left",
        "right",
        "top-right",
        "bottom-left",
        "bottom-right",
      ] as const) {
        const w =
          dock === "bottom"
            ? NOTCH_HORIZONTAL_WIDTH
            : dock === "left" || dock === "right"
              ? NOTCH_VERTICAL_WIDTH
              : NOTCH_CORNER_OUTER_SIZE;
        const h =
          dock === "bottom"
            ? NOTCH_HORIZONTAL_HEIGHT
            : dock === "left" || dock === "right"
              ? NOTCH_VERTICAL_HEIGHT
              : NOTCH_CORNER_OUTER_SIZE;
        const svg = contourToSvgPath(buildNotchContour(dock, w, h));
        expect(svg).toContain(" C ");
        expect(svg.endsWith(" Z")).toBe(true);
      }
    });
  });

  describe("3. Live Underlying Window & Video Blur Backdrop Contract", () => {
    it("configures borderless transparent BrowserWindows so live WinRT HostBackdropBlur shows underlying apps/video without corner bleed", () => {
      const winOpts = getGlassBrowserWindowOptions("win32");
      expect(winOpts.transparent).toBe(true);
      expect(winOpts.frame).toBe(false);
      expect(winOpts.backgroundColor).toBe("#00000000");

      const macOpts = getGlassBrowserWindowOptions("darwin");
      expect(macOpts.vibrancy).toBe("under-window");
      expect(macOpts.transparent).toBe(true);
    });
  });
});
