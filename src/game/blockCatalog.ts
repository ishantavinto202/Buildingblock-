/**
 * Final asset dimensions (native px) and normalized gameplay sizes.
 * Gameplay scale: longest edge → GAMEPLAY_MAX_EDGE_PX (preserves aspect ratio).
 */

export const GAMEPLAY_MAX_EDGE_PX = 80;

export interface BlockAssetDef {
  id: string;
  /** Asset file stem under assets/images/blocks/ */
  file: string;
  nativeW: number;
  nativeH: number;
  gameplayW: number;
  gameplayH: number;
  /** Placeholder fill color */
  color: string;
}

function scaleToGameplay(nativeW: number, nativeH: number): { gameplayW: number; gameplayH: number } {
  const scale = GAMEPLAY_MAX_EDGE_PX / Math.max(nativeW, nativeH);
  return {
    gameplayW: Math.round(nativeW * scale),
    gameplayH: Math.round(nativeH * scale),
  };
}

function def(
  id: string,
  file: string,
  nativeW: number,
  nativeH: number,
  color: string,
): BlockAssetDef {
  const { gameplayW, gameplayH } = scaleToGameplay(nativeW, nativeH);
  return { id, file, nativeW, nativeH, gameplayW, gameplayH, color };
}

/** Order matches imageIndex 0…7 — files under assets/images/blocks/ */
export const BLOCK_ASSETS: readonly BlockAssetDef[] = [
  def('DJ_Controller', 'DJ_Controller.png', 197, 218, '#5B8DEF'),
  def('Equipment_Box', 'Equipment_Box.png', 218, 194, '#6BCB77'),
  def('LED_Panel_Block', 'LED_Panel_Block.png', 164, 259, '#F4D35E'),
  def('Light_Projector', 'Light_Projector.png', 258, 177, '#EE6C4D'),
  def('Speaker_1', 'Speaker_1.png', 224, 260, '#9B5DE5'),
  def('Speaker_2', 'Speaker_2.png', 243, 259, '#00BBF9'),
  def('Speaker_3', 'Speaker_3.png', 150, 200, '#F15BB5'),
  def('Stage_Truss', 'Stage truss block.png', 219, 255, '#E07A5F'),
] as const;

export const BLOCK_IMAGE_COUNT = BLOCK_ASSETS.length;

/** Longest gameplay width/height across the catalog (sway lane + legacy constants). */
export const MAX_BLOCK_GAMEPLAY_W = Math.max(...BLOCK_ASSETS.map((a) => a.gameplayW));
export const MAX_BLOCK_GAMEPLAY_H = Math.max(...BLOCK_ASSETS.map((a) => a.gameplayH));

/** UI-thread lookup tables — keep indices aligned with BLOCK_ASSETS */
export const BLOCK_GAMEPLAY_W: readonly number[] = BLOCK_ASSETS.map((a) => a.gameplayW);
export const BLOCK_GAMEPLAY_H: readonly number[] = BLOCK_ASSETS.map((a) => a.gameplayH);

export function getBlockAsset(index: number): BlockAssetDef {
  return BLOCK_ASSETS[((index % BLOCK_IMAGE_COUNT) + BLOCK_IMAGE_COUNT) % BLOCK_IMAGE_COUNT]!;
}

export function getBlockGameplaySize(index: number): { w: number; h: number } {
  const a = getBlockAsset(index);
  return { w: a.gameplayW, h: a.gameplayH };
}

export function getBlockGameplayW(index: number): number {
  return getBlockAsset(index).gameplayW;
}

export function getBlockGameplayH(index: number): number {
  return getBlockAsset(index).gameplayH;
}

export function getBlockGameplayWWorklet(index: number): number {
  'worklet';
  const i = Math.max(0, Math.min(BLOCK_GAMEPLAY_W.length - 1, Math.floor(index)));
  return BLOCK_GAMEPLAY_W[i] ?? MAX_BLOCK_GAMEPLAY_W;
}

export function getBlockGameplayHWorklet(index: number): number {
  'worklet';
  const i = Math.max(0, Math.min(BLOCK_GAMEPLAY_H.length - 1, Math.floor(index)));
  return BLOCK_GAMEPLAY_H[i] ?? MAX_BLOCK_GAMEPLAY_H;
}

export function getMaxBlockHalfWidthWorklet(): number {
  'worklet';
  return MAX_BLOCK_GAMEPLAY_W / 2;
}
