import type {
  MenubarDockPosition,
  WindowBounds,
} from "@vrm/platform-contracts";
import {
  MENUBAR_COLLAPSED_WIDTH,
  MENUBAR_EXPANDED_WIDTH,
  NOTCH_CORNER_OUTER_SIZE,
  NOTCH_CORNER_THICKNESS,
  NOTCH_HORIZONTAL_HEIGHT,
  NOTCH_HORIZONTAL_WIDTH,
  NOTCH_VERTICAL_HEIGHT,
  NOTCH_VERTICAL_WIDTH,
} from "@vrm/shared";
import type { DisplayBounds } from "./bounds.js";

export {
  NOTCH_CORNER_OUTER_SIZE,
  NOTCH_CORNER_THICKNESS,
  NOTCH_HORIZONTAL_HEIGHT,
  NOTCH_HORIZONTAL_WIDTH,
  NOTCH_VERTICAL_HEIGHT,
  NOTCH_VERTICAL_WIDTH,
};

const SNAP_EDGE_THRESHOLD = 22;
const DETACH_FROM_EDGE_THRESHOLD = 82;
const CORNER_ENTER_THRESHOLD = 58;
const CORNER_EXIT_THRESHOLD = 82;

export type CornerDockPosition =
  "top-left" | "top-right" | "bottom-left" | "bottom-right";

export function isCornerDock(
  dock: MenubarDockPosition,
): dock is CornerDockPosition {
  return (
    dock === "top-left" ||
    dock === "top-right" ||
    dock === "bottom-left" ||
    dock === "bottom-right"
  );
}

export function isEdgeDock(dock: MenubarDockPosition): boolean {
  return (
    dock === "top" || dock === "bottom" || dock === "left" || dock === "right"
  );
}

export function isHorizontalNotchDock(dock: MenubarDockPosition): boolean {
  return dock === "top" || dock === "bottom";
}

export function isVerticalNotchDock(dock: MenubarDockPosition): boolean {
  return dock === "left" || dock === "right";
}

export function getFloatingMenubarDimensions(
  collapsed: boolean,
  savedWidth: number | undefined,
  savedHeight: number | undefined,
  workArea: DisplayBounds,
): { width: number; height: number } {
  const width = collapsed
    ? MENUBAR_COLLAPSED_WIDTH
    : Math.max(MENUBAR_EXPANDED_WIDTH, Math.min(320, savedWidth || 228));
  const targetH = savedHeight || 740;
  const maxAllowedH = Math.max(420, workArea.height - 24);
  const height = Math.max(420, Math.min(maxAllowedH, targetH));
  return { width, height };
}

export function getNotchDimensionsForDock(
  dock: MenubarDockPosition,
  workArea: DisplayBounds,
  floatingDims: { width: number; height: number },
): { width: number; height: number } {
  if (dock === "floating") {
    return floatingDims;
  }
  if (dock === "top" || dock === "bottom") {
    return {
      width: Math.min(
        NOTCH_HORIZONTAL_WIDTH,
        Math.max(260, workArea.width - 140),
      ),
      height: NOTCH_HORIZONTAL_HEIGHT,
    };
  }
  if (dock === "left" || dock === "right") {
    return {
      width: NOTCH_VERTICAL_WIDTH,
      height: Math.min(
        NOTCH_VERTICAL_HEIGHT,
        Math.max(280, workArea.height - 140),
      ),
    };
  }
  // 90-degree folded corner L-shape container
  const size = Math.min(
    NOTCH_CORNER_OUTER_SIZE,
    Math.floor(Math.min(workArea.width, workArea.height) * 0.45),
  );
  return { width: size, height: size };
}

function clamp(val: number, min: number, max: number): number {
  if (max <= min) return min;
  return Math.max(min, Math.min(max, val));
}

export function getCornerBounds(
  corner: "top-left" | "top-right" | "bottom-left" | "bottom-right",
  workArea: DisplayBounds,
): WindowBounds {
  const size = Math.min(
    NOTCH_CORNER_OUTER_SIZE,
    Math.floor(Math.min(workArea.width, workArea.height) * 0.45),
  );
  switch (corner) {
    case "top-left":
      return { x: workArea.x, y: workArea.y, width: size, height: size };
    case "top-right":
      return {
        x: workArea.x + workArea.width - size,
        y: workArea.y,
        width: size,
        height: size,
      };
    case "bottom-left":
      return {
        x: workArea.x,
        y: workArea.y + workArea.height - size,
        width: size,
        height: size,
      };
    case "bottom-right":
      return {
        x: workArea.x + workArea.width - size,
        y: workArea.y + workArea.height - size,
        width: size,
        height: size,
      };
  }
}

export interface ResolveMenubarDragParams {
  cursorX: number;
  cursorY: number;
  grabOffsetX: number;
  grabOffsetY: number;
  currentDock: MenubarDockPosition;
  workArea: DisplayBounds;
  floatingWidth: number;
  floatingHeight: number;
}

export interface ResolveMenubarDragResult {
  dock: MenubarDockPosition;
  bounds: WindowBounds;
}

/**
 * Computes the target Menubar dock state (`floating`, `edge`, or `corner` 90° L-fold)
 * and exact window bounds during continuous pointer dragging around the screen.
 */
export function resolveMenubarPerimeterDrag(
  params: ResolveMenubarDragParams,
): ResolveMenubarDragResult {
  const {
    cursorX,
    cursorY,
    grabOffsetX,
    grabOffsetY,
    currentDock,
    workArea: wa,
    floatingWidth,
    floatingHeight,
  } = params;

  const floatingDims = { width: floatingWidth, height: floatingHeight };
  const distCursorLeft = cursorX - wa.x;
  const distCursorRight = wa.x + wa.width - cursorX;
  const distCursorTop = cursorY - wa.y;
  const distCursorBottom = wa.y + wa.height - cursorY;

  // -------------------------------------------------------------------------
  // Case 1: Currently in 90-degree Corner Fold (`top-left`, `top-right`, ...)
  // -------------------------------------------------------------------------
  if (isCornerDock(currentDock)) {
    const nearLeft = distCursorLeft <= DETACH_FROM_EDGE_THRESHOLD;
    const nearRight = distCursorRight <= DETACH_FROM_EDGE_THRESHOLD;
    const nearTop = distCursorTop <= DETACH_FROM_EDGE_THRESHOLD;
    const nearBottom = distCursorBottom <= DETACH_FROM_EDGE_THRESHOLD;

    if (currentDock === "top-left") {
      if (!nearLeft && !nearTop) {
        return makeFloatingResult(
          cursorX,
          cursorY,
          floatingWidth,
          floatingHeight,
          wa,
        );
      }
      if (
        distCursorLeft > CORNER_EXIT_THRESHOLD &&
        distCursorTop <= DETACH_FROM_EDGE_THRESHOLD
      ) {
        return makeEdgeResult("top", cursorX, cursorY, wa, floatingDims);
      }
      if (
        distCursorTop > CORNER_EXIT_THRESHOLD &&
        distCursorLeft <= DETACH_FROM_EDGE_THRESHOLD
      ) {
        return makeEdgeResult("left", cursorX, cursorY, wa, floatingDims);
      }
      return { dock: "top-left", bounds: getCornerBounds("top-left", wa) };
    }

    if (currentDock === "top-right") {
      if (!nearRight && !nearTop) {
        return makeFloatingResult(
          cursorX,
          cursorY,
          floatingWidth,
          floatingHeight,
          wa,
        );
      }
      if (
        distCursorRight > CORNER_EXIT_THRESHOLD &&
        distCursorTop <= DETACH_FROM_EDGE_THRESHOLD
      ) {
        return makeEdgeResult("top", cursorX, cursorY, wa, floatingDims);
      }
      if (
        distCursorTop > CORNER_EXIT_THRESHOLD &&
        distCursorRight <= DETACH_FROM_EDGE_THRESHOLD
      ) {
        return makeEdgeResult("right", cursorX, cursorY, wa, floatingDims);
      }
      return { dock: "top-right", bounds: getCornerBounds("top-right", wa) };
    }

    if (currentDock === "bottom-left") {
      if (!nearLeft && !nearBottom) {
        return makeFloatingResult(
          cursorX,
          cursorY,
          floatingWidth,
          floatingHeight,
          wa,
        );
      }
      if (
        distCursorLeft > CORNER_EXIT_THRESHOLD &&
        distCursorBottom <= DETACH_FROM_EDGE_THRESHOLD
      ) {
        return makeEdgeResult("bottom", cursorX, cursorY, wa, floatingDims);
      }
      if (
        distCursorBottom > CORNER_EXIT_THRESHOLD &&
        distCursorLeft <= DETACH_FROM_EDGE_THRESHOLD
      ) {
        return makeEdgeResult("left", cursorX, cursorY, wa, floatingDims);
      }
      return {
        dock: "bottom-left",
        bounds: getCornerBounds("bottom-left", wa),
      };
    }

    if (currentDock === "bottom-right") {
      if (!nearRight && !nearBottom) {
        return makeFloatingResult(
          cursorX,
          cursorY,
          floatingWidth,
          floatingHeight,
          wa,
        );
      }
      if (
        distCursorRight > CORNER_EXIT_THRESHOLD &&
        distCursorBottom <= DETACH_FROM_EDGE_THRESHOLD
      ) {
        return makeEdgeResult("bottom", cursorX, cursorY, wa, floatingDims);
      }
      if (
        distCursorBottom > CORNER_EXIT_THRESHOLD &&
        distCursorRight <= DETACH_FROM_EDGE_THRESHOLD
      ) {
        return makeEdgeResult("right", cursorX, cursorY, wa, floatingDims);
      }
      return {
        dock: "bottom-right",
        bounds: getCornerBounds("bottom-right", wa),
      };
    }
  }

  // -------------------------------------------------------------------------
  // Case 2: Currently snapped to a Screen Edge (`top`, `bottom`, `left`, `right`)
  // -------------------------------------------------------------------------
  if (isEdgeDock(currentDock)) {
    if (currentDock === "top") {
      if (distCursorTop > DETACH_FROM_EDGE_THRESHOLD) {
        return makeFloatingResult(
          cursorX,
          cursorY,
          floatingWidth,
          floatingHeight,
          wa,
        );
      }
      if (distCursorLeft <= CORNER_ENTER_THRESHOLD) {
        return { dock: "top-left", bounds: getCornerBounds("top-left", wa) };
      }
      if (distCursorRight <= CORNER_ENTER_THRESHOLD) {
        return { dock: "top-right", bounds: getCornerBounds("top-right", wa) };
      }
      return makeEdgeResult("top", cursorX, cursorY, wa, floatingDims);
    }

    if (currentDock === "bottom") {
      if (distCursorBottom > DETACH_FROM_EDGE_THRESHOLD) {
        return makeFloatingResult(
          cursorX,
          cursorY,
          floatingWidth,
          floatingHeight,
          wa,
        );
      }
      if (distCursorLeft <= CORNER_ENTER_THRESHOLD) {
        return {
          dock: "bottom-left",
          bounds: getCornerBounds("bottom-left", wa),
        };
      }
      if (distCursorRight <= CORNER_ENTER_THRESHOLD) {
        return {
          dock: "bottom-right",
          bounds: getCornerBounds("bottom-right", wa),
        };
      }
      return makeEdgeResult("bottom", cursorX, cursorY, wa, floatingDims);
    }

    if (currentDock === "left") {
      if (distCursorLeft > DETACH_FROM_EDGE_THRESHOLD) {
        return makeFloatingResult(
          cursorX,
          cursorY,
          floatingWidth,
          floatingHeight,
          wa,
        );
      }
      if (distCursorTop <= CORNER_ENTER_THRESHOLD) {
        return { dock: "top-left", bounds: getCornerBounds("top-left", wa) };
      }
      if (distCursorBottom <= CORNER_ENTER_THRESHOLD) {
        return {
          dock: "bottom-left",
          bounds: getCornerBounds("bottom-left", wa),
        };
      }
      return makeEdgeResult("left", cursorX, cursorY, wa, floatingDims);
    }

    if (currentDock === "right") {
      if (distCursorRight > DETACH_FROM_EDGE_THRESHOLD) {
        return makeFloatingResult(
          cursorX,
          cursorY,
          floatingWidth,
          floatingHeight,
          wa,
        );
      }
      if (distCursorTop <= CORNER_ENTER_THRESHOLD) {
        return { dock: "top-right", bounds: getCornerBounds("top-right", wa) };
      }
      if (distCursorBottom <= CORNER_ENTER_THRESHOLD) {
        return {
          dock: "bottom-right",
          bounds: getCornerBounds("bottom-right", wa),
        };
      }
      return makeEdgeResult("right", cursorX, cursorY, wa, floatingDims);
    }
  }

  // -------------------------------------------------------------------------
  // Case 3: Currently Floating -> Check snap to edge or straight into corner
  // -------------------------------------------------------------------------
  const rawX = Math.round(cursorX - grabOffsetX);
  const rawY = Math.round(cursorY - grabOffsetY);

  const hitLeft =
    rawX <= wa.x + SNAP_EDGE_THRESHOLD || distCursorLeft <= SNAP_EDGE_THRESHOLD;
  const hitRight =
    rawX + floatingWidth >= wa.x + wa.width - SNAP_EDGE_THRESHOLD ||
    distCursorRight <= SNAP_EDGE_THRESHOLD;
  const hitTop =
    rawY <= wa.y + SNAP_EDGE_THRESHOLD || distCursorTop <= SNAP_EDGE_THRESHOLD;
  // Floating sidebar can be up to ~740px tall, so checking window bottom edge
  // (rawY + floatingHeight) would falsely fire hitBottom across the lower 70%
  // of the screen when dragging horizontally to left/right. Use cursor proximity
  // for bottom-edge snapping.
  const hitBottom = distCursorBottom <= SNAP_EDGE_THRESHOLD;

  // Direct corner snap only when near both edges / inside a corner zone
  if (
    hitTop &&
    hitLeft &&
    (distCursorTop <= CORNER_ENTER_THRESHOLD ||
      distCursorLeft <= CORNER_ENTER_THRESHOLD)
  ) {
    return { dock: "top-left", bounds: getCornerBounds("top-left", wa) };
  }
  if (
    hitTop &&
    hitRight &&
    (distCursorTop <= CORNER_ENTER_THRESHOLD ||
      distCursorRight <= CORNER_ENTER_THRESHOLD)
  ) {
    return { dock: "top-right", bounds: getCornerBounds("top-right", wa) };
  }
  if (
    hitBottom &&
    hitLeft &&
    (distCursorBottom <= CORNER_ENTER_THRESHOLD ||
      distCursorLeft <= CORNER_ENTER_THRESHOLD)
  ) {
    return { dock: "bottom-left", bounds: getCornerBounds("bottom-left", wa) };
  }
  if (
    hitBottom &&
    hitRight &&
    (distCursorBottom <= CORNER_ENTER_THRESHOLD ||
      distCursorRight <= CORNER_ENTER_THRESHOLD)
  ) {
    return {
      dock: "bottom-right",
      bounds: getCornerBounds("bottom-right", wa),
    };
  }

  // Single-edge snap (pick whichever axis cursor/edge is closest to)
  if (hitTop && !hitBottom) {
    if (distCursorLeft <= CORNER_ENTER_THRESHOLD) {
      return { dock: "top-left", bounds: getCornerBounds("top-left", wa) };
    }
    if (distCursorRight <= CORNER_ENTER_THRESHOLD) {
      return { dock: "top-right", bounds: getCornerBounds("top-right", wa) };
    }
    return makeEdgeResult("top", cursorX, cursorY, wa, floatingDims);
  }
  if (hitBottom && !hitTop) {
    if (distCursorLeft <= CORNER_ENTER_THRESHOLD) {
      return {
        dock: "bottom-left",
        bounds: getCornerBounds("bottom-left", wa),
      };
    }
    if (distCursorRight <= CORNER_ENTER_THRESHOLD) {
      return {
        dock: "bottom-right",
        bounds: getCornerBounds("bottom-right", wa),
      };
    }
    return makeEdgeResult("bottom", cursorX, cursorY, wa, floatingDims);
  }
  if (hitLeft && !hitRight) {
    if (distCursorTop <= CORNER_ENTER_THRESHOLD) {
      return { dock: "top-left", bounds: getCornerBounds("top-left", wa) };
    }
    if (distCursorBottom <= CORNER_ENTER_THRESHOLD) {
      return {
        dock: "bottom-left",
        bounds: getCornerBounds("bottom-left", wa),
      };
    }
    return makeEdgeResult("left", cursorX, cursorY, wa, floatingDims);
  }
  if (hitRight && !hitLeft) {
    if (distCursorTop <= CORNER_ENTER_THRESHOLD) {
      return { dock: "top-right", bounds: getCornerBounds("top-right", wa) };
    }
    if (distCursorBottom <= CORNER_ENTER_THRESHOLD) {
      return {
        dock: "bottom-right",
        bounds: getCornerBounds("bottom-right", wa),
      };
    }
    return makeEdgeResult("right", cursorX, cursorY, wa, floatingDims);
  }

  // Remain free-floating within workArea bounds
  return {
    dock: "floating",
    bounds: {
      x: clamp(rawX, wa.x, wa.x + wa.width - floatingWidth),
      y: clamp(rawY, wa.y, wa.y + wa.height - floatingHeight),
      width: floatingWidth,
      height: floatingHeight,
    },
  };
}

function makeEdgeResult(
  edge: "top" | "bottom" | "left" | "right",
  cursorX: number,
  cursorY: number,
  wa: DisplayBounds,
  floatingDims: { width: number; height: number },
): ResolveMenubarDragResult {
  const dims = getNotchDimensionsForDock(edge, wa, floatingDims);
  if (edge === "top") {
    return {
      dock: "top",
      bounds: {
        x: clamp(
          Math.round(cursorX - dims.width / 2),
          wa.x,
          wa.x + wa.width - dims.width,
        ),
        y: wa.y,
        width: dims.width,
        height: dims.height,
      },
    };
  }
  if (edge === "bottom") {
    return {
      dock: "bottom",
      bounds: {
        x: clamp(
          Math.round(cursorX - dims.width / 2),
          wa.x,
          wa.x + wa.width - dims.width,
        ),
        y: wa.y + wa.height - dims.height,
        width: dims.width,
        height: dims.height,
      },
    };
  }
  if (edge === "left") {
    return {
      dock: "left",
      bounds: {
        x: wa.x,
        y: clamp(
          Math.round(cursorY - dims.height / 2),
          wa.y,
          wa.y + wa.height - dims.height,
        ),
        width: dims.width,
        height: dims.height,
      },
    };
  }
  return {
    dock: "right",
    bounds: {
      x: wa.x + wa.width - dims.width,
      y: clamp(
        Math.round(cursorY - dims.height / 2),
        wa.y,
        wa.y + wa.height - dims.height,
      ),
      width: dims.width,
      height: dims.height,
    },
  };
}

function makeFloatingResult(
  cursorX: number,
  cursorY: number,
  floatingWidth: number,
  floatingHeight: number,
  wa: DisplayBounds,
): ResolveMenubarDragResult {
  const safeLeft = wa.x + DETACH_FROM_EDGE_THRESHOLD - 12;
  const safeRight =
    wa.x + wa.width - floatingWidth - (DETACH_FROM_EDGE_THRESHOLD - 12);
  const safeTop = wa.y + DETACH_FROM_EDGE_THRESHOLD - 12;
  const safeBottom =
    wa.y + wa.height - floatingHeight - (DETACH_FROM_EDGE_THRESHOLD - 12);

  return {
    dock: "floating",
    bounds: {
      x: clamp(
        Math.round(cursorX - floatingWidth / 2),
        safeLeft,
        Math.max(safeLeft, safeRight),
      ),
      y: clamp(
        Math.round(cursorY - 24),
        safeTop,
        Math.max(safeTop, safeBottom),
      ),
      width: floatingWidth,
      height: floatingHeight,
    },
  };
}
