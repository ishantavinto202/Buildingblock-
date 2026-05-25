/** Native pixels for assets/images/BASE.png */
export const BASE_NATIVE_W = 1179;
export const BASE_NATIVE_H = 247;

/** Visible strip height for BASE.png (drawn flush to screen bottom) */
export const GROUND_Y_OFFSET = 80;

/**
 * How much of the bottom block's gameplay height sits inside the base art (0–1).
 * Targets ~25–35% visual overlap with the platform top surface.
 */
export const BASE_BLOCK_EMBED_RATIO = 0.3;

export interface BaseDrawLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Draw size for BASE — height fills GROUND_Y_OFFSET; width keeps aspect ratio, centered */
export function getBaseDrawLayout(canvasWidth: number, canvasHeight: number): BaseDrawLayout {
  const h = GROUND_Y_OFFSET;
  const w = Math.min(canvasWidth, Math.round(h * (BASE_NATIVE_W / BASE_NATIVE_H)));
  return {
    x: (canvasWidth - w) / 2,
    y: canvasHeight - h,
    w,
    h,
  };
}

/**
 * World Y (top edge) for the bottom-most block, partially embedded into BASE.
 * Block bottom sits BASE_BLOCK_EMBED_RATIO * height below the platform top edge.
 */
export function getStackGroundY(canvasHeight: number, bottomBlockGameplayH: number): number {
  const baseTopY = canvasHeight - GROUND_Y_OFFSET;
  const embedPx = bottomBlockGameplayH * BASE_BLOCK_EMBED_RATIO;
  return baseTopY + embedPx - bottomBlockGameplayH;
}
