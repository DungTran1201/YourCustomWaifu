export interface DisplayBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DisplayLike {
  bounds: DisplayBounds;
  workArea: DisplayBounds;
}

export interface ValidatedBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Validates requested window bounds against current active displays.
 * If target coordinates fall outside all known displays (e.g. unplugged monitor),
 * safely repositions the window to the bottom-right of the primary display work area.
 */
export function validateWindowBounds(
  target: { x?: number; y?: number; width?: number; height?: number },
  displays: DisplayLike[],
): ValidatedBounds {
  const width = Math.max(240, target.width || 420);
  const height = Math.max(320, target.height || 640);

  if (!displays || displays.length === 0) {
    return { x: 100, y: 100, width, height };
  }

  if (typeof target.x === "number" && typeof target.y === "number") {
    const isVisibleOnAnyDisplay = displays.some((display) => {
      const b = display.bounds;
      // Allow window to be partially visible with at least 50px anchor
      return (
        target.x! >= b.x - 50 &&
        target.x! <= b.x + b.width - 50 &&
        target.y! >= b.y - 50 &&
        target.y! <= b.y + b.height - 50
      );
    });

    if (isVisibleOnAnyDisplay) {
      return {
        x: target.x,
        y: target.y,
        width,
        height,
      };
    }
  }

  // Fallback: place on bottom-right of primary display work area
  const primary = displays[0]!.workArea;
  const fallbackX = Math.max(primary.x, primary.x + primary.width - width - 40);
  const fallbackY = Math.max(
    primary.y,
    primary.y + primary.height - height - 40,
  );

  return {
    x: fallbackX,
    y: fallbackY,
    width,
    height,
  };
}
