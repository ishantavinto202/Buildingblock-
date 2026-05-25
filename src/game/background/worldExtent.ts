/** Vertical padding for the camera-scrolled sky underlay (world px) */
export function getSkyWorldUnderlayPad(canvasHeight: number): number {
  return canvasHeight * 4;
}

export interface SkyWorldUnderlayLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Sky rect in world space — scrolls with BG.png and blocks */
export function getSkyWorldUnderlayLayout(
  canvasWidth: number,
  canvasHeight: number,
): SkyWorldUnderlayLayout {
  const pad = getSkyWorldUnderlayPad(canvasHeight);
  return {
    x: 0,
    y: -pad,
    w: canvasWidth,
    h: pad + canvasHeight + pad,
  };
}
