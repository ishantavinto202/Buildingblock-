import { BLOCK_H, BLOCK_W, CAMERA_ANCHOR_FRACTION, SPAWN_ABOVE_TOWER_PX } from './constants';

export interface HorizontalMovementBounds {
  /** Block center X when the sprite's left edge is at viewport x = 0 */
  minCenterX: number;
  /** Block center X when the sprite's right edge is at viewport x = width */
  maxCenterX: number;
  anchorCx: number;
  /** Half-range from anchor (px); block center = anchorCx + swayOffset */
  maxSwayAmplitude: number;
}

/**
 * Edge-to-edge horizontal lane for the canvas/viewport width.
 * World X matches canvas X (no safe-area or gameplay padding).
 */
export function getHorizontalMovementBounds(canvasWidth: number): HorizontalMovementBounds {
  if (canvasWidth <= 0) {
    return {
      minCenterX: 0,
      maxCenterX: 0,
      anchorCx: 0,
      maxSwayAmplitude: 0,
    };
  }

  const halfBlock = BLOCK_W / 2;
  const anchorCx = canvasWidth / 2;
  const maxSwayAmplitude = Math.max(0, anchorCx - halfBlock);

  return {
    minCenterX: halfBlock,
    maxCenterX: canvasWidth - halfBlock,
    anchorCx,
    maxSwayAmplitude,
  };
}

export function getMaxSwayAmplitudePx(canvasWidth: number): number {
  return getHorizontalMovementBounds(canvasWidth).maxSwayAmplitude;
}

export function getMaxSwayAmplitudePxWorklet(canvasWidth: number): number {
  'worklet';
  if (canvasWidth <= 0) return 0;
  return Math.max(0, canvasWidth / 2 - BLOCK_W / 2);
}

export function getGlobalSwayAnchorCx(canvasWidth: number): number {
  return canvasWidth / 2;
}

export function getGlobalSwayAnchorCxWorklet(canvasWidth: number): number {
  'worklet';
  return canvasWidth / 2;
}

/**
 * World-space Y for the active block spawn (top edge), above the tower top.
 * Horizontal travel uses the full viewport width via getHorizontalMovementBounds().
 */
export function spawnWorldYForTower(towerTopWorldY: number): number {
  return towerTopWorldY - BLOCK_H - SPAWN_ABOVE_TOWER_PX;
}

/** Worklet-safe spawn Y — must not call non-worklet helpers. */
export function computeSpawnWorldY(towerTopWorldY: number): number {
  'worklet';
  return towerTopWorldY - BLOCK_H - SPAWN_ABOVE_TOWER_PX;
}

export interface TowerSpawnPlacement {
  worldY: number;
  bounds: HorizontalMovementBounds;
}

/** World Y + edge-to-edge horizontal lane for the given viewport/canvas width. */
export function getTowerBlockSpawnPlacement(
  towerTopWorldY: number,
  viewportWidth: number,
): TowerSpawnPlacement {
  return {
    worldY: spawnWorldYForTower(towerTopWorldY),
    bounds: getHorizontalMovementBounds(viewportWidth),
  };
}

/**
 * World-space Y → screen Y. Physics use worldY only; call this at render time.
 * screenY = worldY + cameraScrollY
 */
export function worldToScreenY(worldY: number, cameraScrollY: number): number {
  'worklet';
  return worldY + cameraScrollY;
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
