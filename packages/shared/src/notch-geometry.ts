/**
 * Shared parametric geometry for the Dynamic Screen-Edge Notch & 90° Corner L-Notch.
 *
 * Used identically by:
 * 1. Vue renderer (`NavigationBar.vue`) to build crisp anti-aliased SVG `<clipPath>` silhouettes.
 * 2. Electron Win32 platform glass (`platform-glass.ts`) to cut matching GDI32 Bezier regions
 *    via `PathToRegion` so OS Acrylic blur and hit-testing align with zero seam artifacts.
 */

export type SharedMenubarDockPosition =
  | "floating"
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export const NOTCH_HORIZONTAL_WIDTH = 440;
export const NOTCH_HORIZONTAL_HEIGHT = 46;

export const NOTCH_VERTICAL_WIDTH = 48;
export const NOTCH_VERTICAL_HEIGHT = 420;

export const NOTCH_CORNER_OUTER_SIZE = 236;
export const NOTCH_CORNER_THICKNESS = 48;

export type NotchContourOp =
  | { kind: "L"; x: number; y: number }
  | {
      kind: "C";
      c1x: number;
      c1y: number;
      c2x: number;
      c2y: number;
      x: number;
      y: number;
    };

export interface NotchContour {
  width: number;
  height: number;
  startX: number;
  startY: number;
  ops: NotchContourOp[];
}

export interface NotchGeometryOptions {
  /** Thickness of each corner L-arm in matching coordinate units (DIP or physical px). */
  armThickness?: number;
}

// Standard circular cubic Bezier constant 4 * (sqrt(2) - 1) / 3
const KAPPA = 0.5522847498;

function clamp(val: number, min: number, max: number): number {
  if (max <= min) return min;
  return Math.max(min, Math.min(max, val));
}

function roundCoord(n: number): number {
  return Math.round(n * 100) / 100;
}

function transformContour(
  contour: NotchContour,
  mapPoint: (x: number, y: number) => [number, number],
  outWidth: number,
  outHeight: number,
): NotchContour {
  const [sx, sy] = mapPoint(contour.startX, contour.startY);
  const ops: NotchContourOp[] = contour.ops.map((op) => {
    if (op.kind === "L") {
      const [x, y] = mapPoint(op.x, op.y);
      return { kind: "L", x: roundCoord(x), y: roundCoord(y) };
    }
    const [c1x, c1y] = mapPoint(op.c1x, op.c1y);
    const [c2x, c2y] = mapPoint(op.c2x, op.c2y);
    const [x, y] = mapPoint(op.x, op.y);
    return {
      kind: "C",
      c1x: roundCoord(c1x),
      c1y: roundCoord(c1y),
      c2x: roundCoord(c2x),
      c2y: roundCoord(c2y),
      x: roundCoord(x),
      y: roundCoord(y),
    };
  });
  return {
    width: outWidth,
    height: outHeight,
    startX: roundCoord(sx),
    startY: roundCoord(sy),
    ops,
  };
}

/**
 * Canonical iPhone-style Top Edge Notch:
 * - Outer left/right concave fillets ("tai thỏ") flush at y = 0.
 * - Sleek vertical side walls curving smoothly into deep bottom convex corners.
 */
function buildTopEdgeNotchContour(w: number, h: number): NotchContour {
  const earX = clamp(Math.round(Math.min(18, w * 0.08, h * 0.4)), 6, 36);
  const neckY = clamp(Math.round(h * 0.35), 6, Math.max(8, h - 10));
  const innerW = Math.max(12, w - earX * 2);
  const maxCornerR = Math.min(
    Math.floor(innerW * 0.25),
    Math.max(4, h - neckY),
  );
  const bottomR = clamp(Math.round(h * 0.48), 6, maxCornerR);

  // Start flush at top-left outer ear (0, 0), trace clockwise
  const ops: NotchContourOp[] = [
    // 1. Flush top edge attached to screen border
    { kind: "L", x: w, y: 0 },
    // 2. Right concave outer ear curving smoothly from horizontal screen edge down into right wall
    {
      kind: "C",
      c1x: roundCoord(w - earX * 0.62),
      c1y: 0,
      c2x: w - earX,
      c2y: roundCoord(neckY * 0.36),
      x: w - earX,
      y: neckY,
    },
  ];

  // 3. Right vertical neck (if taller than ear + bottom radius)
  if (h - bottomR > neckY) {
    ops.push({ kind: "L", x: w - earX, y: h - bottomR });
  }

  // 4. Bottom-right convex corner
  ops.push({
    kind: "C",
    c1x: w - earX,
    c1y: roundCoord(h - bottomR + bottomR * KAPPA),
    c2x: roundCoord(w - earX - bottomR * (1 - KAPPA)),
    c2y: h,
    x: w - earX - bottomR,
    y: h,
  });

  // 5. Flat bottom edge
  ops.push({ kind: "L", x: earX + bottomR, y: h });

  // 6. Bottom-left convex corner
  ops.push({
    kind: "C",
    c1x: roundCoord(earX + bottomR * (1 - KAPPA)),
    c1y: h,
    c2x: earX,
    c2y: roundCoord(h - bottomR + bottomR * KAPPA),
    x: earX,
    y: h - bottomR,
  });

  // 7. Left vertical neck up to concave ear
  if (h - bottomR > neckY) {
    ops.push({ kind: "L", x: earX, y: neckY });
  }

  // 8. Left concave outer ear flaring back to (0, 0)
  ops.push({
    kind: "C",
    c1x: earX,
    c1y: roundCoord(neckY * 0.36),
    c2x: roundCoord(earX * 0.62),
    c2y: 0,
    x: 0,
    y: 0,
  });

  return {
    width: w,
    height: h,
    startX: 0,
    startY: 0,
    ops,
  };
}

/**
 * Canonical 90-degree folded Top-Left L-Notch:
 * - Flush along both (0, 0 -> w, 0) and (0, h -> 0, 0) screen edges.
 * - Outer arm ends feature smooth concave ears merging into the monitor borders.
 * - Inner L-junction features a smooth concave fillet curving between both arms.
 */
function buildTopLeftCornerContour(
  w: number,
  h: number,
  armThickness: number,
): NotchContour {
  const arm = clamp(
    Math.round(armThickness),
    24,
    Math.max(24, Math.floor(Math.min(w, h) * 0.45)),
  );
  const ear = clamp(Math.round(arm * 0.34), 8, 28);
  const tipR = clamp(Math.round(arm * 0.42), 8, Math.floor(arm * 0.55));
  const neck = clamp(Math.round(arm * 0.34), 6, Math.max(8, arm - tipR));
  const elbowR = clamp(
    Math.round(arm * 0.38),
    8,
    Math.max(8, Math.min(w, h) - arm - ear - tipR - 4),
  );

  const ops: NotchContourOp[] = [
    // 1. Flush along top monitor border
    { kind: "L", x: w, y: 0 },
    // 2. Concave ear at far tip of horizontal arm
    {
      kind: "C",
      c1x: roundCoord(w - ear * 0.62),
      c1y: 0,
      c2x: w - ear,
      c2y: roundCoord(neck * 0.36),
      x: w - ear,
      y: neck,
    },
  ];

  if (arm - tipR > neck) {
    ops.push({ kind: "L", x: w - ear, y: arm - tipR });
  }

  // 3. Convex rounded tip of horizontal arm
  ops.push({
    kind: "C",
    c1x: w - ear,
    c1y: roundCoord(arm - tipR + tipR * KAPPA),
    c2x: roundCoord(w - ear - tipR * (1 - KAPPA)),
    c2y: arm,
    x: w - ear - tipR,
    y: arm,
  });

  // 4. Inner bottom edge of horizontal arm
  ops.push({ kind: "L", x: arm + elbowR, y: arm });

  // 5. Concave inner L-elbow fillet (curving smoothly between horizontal & vertical arms)
  ops.push({
    kind: "C",
    c1x: roundCoord(arm + elbowR * (1 - KAPPA)),
    c1y: arm,
    c2x: arm,
    c2y: roundCoord(arm + elbowR * (1 - KAPPA)),
    x: arm,
    y: arm + elbowR,
  });

  // 6. Inner right edge of vertical arm
  ops.push({ kind: "L", x: arm, y: h - ear - tipR });

  // 7. Convex rounded bottom tip of vertical arm
  ops.push({
    kind: "C",
    c1x: arm,
    c1y: roundCoord(h - ear - tipR * (1 - KAPPA)),
    c2x: roundCoord(arm - tipR + tipR * KAPPA),
    c2y: h - ear,
    x: arm - tipR,
    y: h - ear,
  });

  if (arm - tipR > neck) {
    ops.push({ kind: "L", x: neck, y: h - ear });
  }

  // 8. Concave ear at far tip of vertical arm merging into left monitor border
  ops.push({
    kind: "C",
    c1x: roundCoord(neck * 0.36),
    c1y: h - ear,
    c2x: 0,
    c2y: roundCoord(h - ear * 0.62),
    x: 0,
    y: h,
  });

  // 9. Flush back up left monitor border
  ops.push({ kind: "L", x: 0, y: 0 });

  return {
    width: w,
    height: h,
    startX: 0,
    startY: 0,
    ops,
  };
}

/**
 * Generates the exact closed Bezier contour for any docked Menubar mode.
 */
export function buildNotchContour(
  dock: Exclude<SharedMenubarDockPosition, "floating">,
  width: number,
  height: number,
  options: NotchGeometryOptions = {},
): NotchContour {
  const w = Math.max(32, Math.round(width));
  const h = Math.max(32, Math.round(height));

  if (dock === "top") {
    return buildTopEdgeNotchContour(w, h);
  }
  if (dock === "bottom") {
    return transformContour(
      buildTopEdgeNotchContour(w, h),
      (x, y) => [x, h - y],
      w,
      h,
    );
  }
  if (dock === "left") {
    return transformContour(
      buildTopEdgeNotchContour(h, w),
      (x, y) => [y, x],
      w,
      h,
    );
  }
  if (dock === "right") {
    return transformContour(
      buildTopEdgeNotchContour(h, w),
      (x, y) => [w - y, x],
      w,
      h,
    );
  }

  const armThickness = options.armThickness ?? NOTCH_CORNER_THICKNESS;
  const baseCorner = buildTopLeftCornerContour(w, h, armThickness);

  if (dock === "top-left") {
    return baseCorner;
  }
  if (dock === "top-right") {
    return transformContour(baseCorner, (x, y) => [w - x, y], w, h);
  }
  if (dock === "bottom-left") {
    return transformContour(baseCorner, (x, y) => [x, h - y], w, h);
  }
  // bottom-right
  return transformContour(baseCorner, (x, y) => [w - x, h - y], w, h);
}

/**
 * Serializes a NotchContour into a standard SVG `<path d="...">` string.
 */
export function contourToSvgPath(contour: NotchContour): string {
  const parts: string[] = [`M ${contour.startX} ${contour.startY}`];
  for (const op of contour.ops) {
    if (op.kind === "L") {
      parts.push(`L ${op.x} ${op.y}`);
    } else {
      parts.push(`C ${op.c1x} ${op.c1y} ${op.c2x} ${op.c2y} ${op.x} ${op.y}`);
    }
  }
  parts.push("Z");
  return parts.join(" ");
}
