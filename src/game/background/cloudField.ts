import {
  CLOUD_CULL_ABOVE_VIEW_MULT,
  CLOUD_CULL_BELOW_VIEW_MULT,
  CLOUD_LOOKAHEAD_VIEWPORT_MULT,
  CLOUD_MAX_ACTIVE,
  CLOUD_MIN_ROW_SPACING_FRAC,
  CLOUD_ROW_SPACING_REF,
  CLOUD_SCALE_MAX,
  CLOUD_SCALE_MIN,
  CLOUD_SPAWN_BUFFER_ABOVE_VIEW_MULT,
  CLOUD_TRAVEL_SPEED_REF_MAX,
  CLOUD_TRAVEL_SPEED_REF_MIN,
  DEVICE_REF_H,
  DEVICE_REF_W,
} from './cloudConstants';
import { CLOUD_NATIVE_SIZES } from './cloudAssets';

/** 1 = left → right, -1 = right → left */
export type CloudDirection = 1 | -1;

export interface CloudInstance {
  id: number;
  assetIndex: number;
  baseY: number;
  width: number;
  height: number;
  direction: CloudDirection;
  velocityX: number;
  startX: number;
  spawnTimeMs: number;
}

let nextCloudId = 1;

function refScale(canvasWidth: number, canvasHeight: number): number {
  const sx = canvasWidth / DEVICE_REF_W;
  const sy = canvasHeight / DEVICE_REF_H;
  return (sx + sy) / 2;
}

export function getScaledRowSpacing(canvasWidth: number, canvasHeight: number): number {
  return CLOUD_ROW_SPACING_REF * refScale(canvasWidth, canvasHeight);
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pickAssetIndex(): number {
  return Math.floor(Math.random() * CLOUD_NATIVE_SIZES.length);
}

function cloudDrawSize(assetIndex: number, scale: number): { w: number; h: number } {
  const native = CLOUD_NATIVE_SIZES[assetIndex];
  const s = scale * rand(CLOUD_SCALE_MIN, CLOUD_SCALE_MAX);
  return { w: native.w * s, h: native.h * s };
}

function pickDirection(): CloudDirection {
  return Math.random() < 0.5 ? 1 : -1;
}

/**
 * Spawns on the leading edge with optional phase along the crossing so bands look populated.
 */
export function makeCloud(
  canvasWidth: number,
  canvasHeight: number,
  worldY: number,
  timeMs: number,
): CloudInstance {
  const scale = refScale(canvasWidth, canvasHeight);
  const assetIndex = pickAssetIndex();
  const { w, h } = cloudDrawSize(assetIndex, scale);
  const direction = pickDirection();
  const velocityX =
    rand(CLOUD_TRAVEL_SPEED_REF_MIN, CLOUD_TRAVEL_SPEED_REF_MAX) * scale;
  const travelSpan = canvasWidth + w;
  const travelMs = travelSpan / velocityX;
  const phase = Math.random();
  const elapsed = phase * travelMs;
  const startX = direction > 0 ? -w : canvasWidth;

  return {
    id: nextCloudId++,
    assetIndex,
    baseY: worldY,
    width: w,
    height: h,
    direction,
    velocityX,
    startX,
    spawnTimeMs: timeMs - elapsed,
  };
}

export function getCloudViewportBounds(
  cameraScrollY: number,
  canvasWidth: number,
  canvasHeight: number,
): {
  viewTop: number;
  viewBottom: number;
  spawnTop: number;
  spawnCeiling: number;
} {
  const viewTop = -cameraScrollY;
  const viewBottom = canvasHeight - cameraScrollY;
  const spawnTop = viewTop - canvasHeight * CLOUD_LOOKAHEAD_VIEWPORT_MULT;
  const spawnCeiling =
    viewTop + canvasHeight * CLOUD_SPAWN_BUFFER_ABOVE_VIEW_MULT;
  return { viewTop, viewBottom, spawnTop, spawnCeiling };
}

export function computeCloudX(cloud: CloudInstance, timeMs: number): number {
  'worklet';
  const elapsed = Math.max(0, timeMs - cloud.spawnTimeMs);
  return cloud.startX + cloud.direction * cloud.velocityX * elapsed;
}

export function isCloudPastScreen(
  cloud: CloudInstance,
  timeMs: number,
  canvasWidth: number,
): boolean {
  const x = computeCloudX(cloud, timeMs);
  if (cloud.direction > 0) {
    return x > canvasWidth;
  }
  return x + cloud.width < 0;
}

function isInActiveBand(
  baseY: number,
  spawnTop: number,
  spawnCeiling: number,
  viewBottom: number,
  canvasHeight: number,
): boolean {
  const bandBottom = viewBottom + canvasHeight * CLOUD_CULL_BELOW_VIEW_MULT;
  return baseY >= spawnTop && baseY <= Math.max(spawnCeiling, bandBottom);
}

export function countCloudsInActiveBand(
  clouds: CloudInstance[],
  spawnTop: number,
  spawnCeiling: number,
  viewBottom: number,
  canvasHeight: number,
): number {
  return clouds.filter((c) =>
    isInActiveBand(c.baseY, spawnTop, spawnCeiling, viewBottom, canvasHeight),
  ).length;
}

export function hasCloudNearY(
  clouds: CloudInstance[],
  y: number,
  minSpacing: number,
): boolean {
  for (const c of clouds) {
    if (Math.abs(c.baseY - y) < minSpacing) return true;
  }
  return false;
}

/** Deterministic row anchors from spawnTop through spawnCeiling (inclusive). */
export function buildCloudRowYs(
  spawnTop: number,
  spawnCeiling: number,
  rowSpacing: number,
): number[] {
  if (rowSpacing <= 0 || spawnCeiling < spawnTop) return [];
  const start = Math.ceil(spawnTop / rowSpacing) * rowSpacing;
  const rows: number[] = [];
  for (let y = start; y <= spawnCeiling + 0.5; y += rowSpacing) {
    rows.push(y);
  }
  return rows;
}

export function cullClouds(
  clouds: CloudInstance[],
  cameraScrollY: number,
  canvasWidth: number,
  canvasHeight: number,
  timeMs: number,
): CloudInstance[] {
  const { viewTop, viewBottom } = getCloudViewportBounds(
    cameraScrollY,
    canvasWidth,
    canvasHeight,
  );
  const cullBelow = viewBottom + canvasHeight * CLOUD_CULL_BELOW_VIEW_MULT;
  const cullAbove = viewTop - canvasHeight * CLOUD_CULL_ABOVE_VIEW_MULT;

  return clouds.filter((c) => {
    if (c.baseY > cullBelow || c.baseY < cullAbove) return false;
    if (isCloudPastScreen(c, timeMs, canvasWidth)) return false;
    return true;
  });
}

/**
 * Extend the sky band ahead of the camera with one cloud per row at fixed spacing.
 * Independent of tower spawn placement.
 */
export function fillCloudBand(
  existing: CloudInstance[],
  cameraScrollY: number,
  canvasWidth: number,
  canvasHeight: number,
  timeMs: number,
  lastViewTop: number | null = null,
): CloudInstance[] {
  if (canvasWidth <= 0 || canvasHeight <= 0) return existing;

  const { viewTop, viewBottom, spawnTop, spawnCeiling } = getCloudViewportBounds(
    cameraScrollY,
    canvasWidth,
    canvasHeight,
  );

  const rowSpacing = getScaledRowSpacing(canvasWidth, canvasHeight);
  const minSpacing = rowSpacing * CLOUD_MIN_ROW_SPACING_FRAC;

  let clouds = cullClouds(existing, cameraScrollY, canvasWidth, canvasHeight, timeMs);

  const rowYs = buildCloudRowYs(spawnTop, spawnCeiling, rowSpacing);
  const incrementalFloor =
    lastViewTop !== null ? Math.max(spawnTop, lastViewTop) : spawnTop;

  for (let i = 0; i < rowYs.length; i++) {
    const y = rowYs[i];
    if (y < incrementalFloor) continue;
    if (hasCloudNearY(clouds, y, minSpacing)) continue;
    if (
      countCloudsInActiveBand(
        clouds,
        spawnTop,
        spawnCeiling,
        viewBottom,
        canvasHeight,
      ) >= CLOUD_MAX_ACTIVE
    ) {
      break;
    }
    clouds.push(makeCloud(canvasWidth, canvasHeight, y, timeMs));
  }

  return clouds;
}

/** Recycle clouds that finished a full crossing so the band stays active. */
export function recycleCrossedClouds(
  clouds: CloudInstance[],
  cameraScrollY: number,
  canvasWidth: number,
  canvasHeight: number,
  timeMs: number,
): CloudInstance[] {
  const { viewTop, viewBottom, spawnTop, spawnCeiling } = getCloudViewportBounds(
    cameraScrollY,
    canvasWidth,
    canvasHeight,
  );
  const rowSpacing = getScaledRowSpacing(canvasWidth, canvasHeight);
  const minSpacing = rowSpacing * CLOUD_MIN_ROW_SPACING_FRAC;

  return clouds.flatMap((c) => {
    if (!isCloudPastScreen(c, timeMs, canvasWidth)) {
      return [c];
    }
    if (
      c.baseY < viewTop - canvasHeight * 0.5 ||
      c.baseY > viewBottom + canvasHeight * 0.2
    ) {
      return [];
    }
    const others = clouds.filter((o) => o.id !== c.id);
    if (hasCloudNearY(others, c.baseY, minSpacing)) {
      return [];
    }
    return [makeCloud(canvasWidth, canvasHeight, c.baseY, timeMs)];
  });
}

export function tickCloudField(
  clouds: CloudInstance[],
  cameraScrollY: number,
  canvasWidth: number,
  canvasHeight: number,
  timeMs: number,
): CloudInstance[] {
  let next = cullClouds(clouds, cameraScrollY, canvasWidth, canvasHeight, timeMs);
  next = recycleCrossedClouds(next, cameraScrollY, canvasWidth, canvasHeight, timeMs);
  return fillCloudBand(
    next,
    cameraScrollY,
    canvasWidth,
    canvasHeight,
    timeMs,
    null,
  );
}
