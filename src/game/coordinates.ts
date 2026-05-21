import { BLOCK_H, CAMERA_ANCHOR_FRACTION, SPAWN_ABOVE_TOWER_PX } from './constants';

/**
 * World-space Y → screen Y. Physics use worldY only; call this at render time.
 * screenY = worldY + cameraScrollY
 */
export function worldToScreenY(worldY: number, cameraScrollY: number): number {
  'worklet';
  return worldY + cameraScrollY;
}

/**
 * World Y for the active block spawn (top edge), above the tower top.
 * Vertical only — horizontal position uses the global sway anchor, not stack X.
 */
export function spawnWorldYForTower(towerTopWorldY: number): number {
  return towerTopWorldY - BLOCK_H - SPAWN_ABOVE_TOWER_PX;
}

/** Worklet-safe spawn — must not call non-worklet helpers. */
export function computeSpawnWorldY(towerTopWorldY: number): number {
  'worklet';
  return towerTopWorldY - BLOCK_H - SPAWN_ABOVE_TOWER_PX;
}

/**
 * Camera scroll so the tower top stays near the upper anchor.
 * Only uses tower top — never the falling block or spawn position.
 */
export function computeCameraScrollY(canvasHeight: number, towerTopWorldY: number): number {
  'worklet';
  if (canvasHeight <= 0) return 0;
  const anchorY = canvasHeight * CAMERA_ANCHOR_FRACTION;
  return Math.max(0, anchorY - towerTopWorldY);
}
