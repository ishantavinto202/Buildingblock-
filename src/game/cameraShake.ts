import {
  CAMERA_SHAKE_MAX_X_PX,
  CAMERA_SHAKE_MAX_Y_PX,
  CAMERA_SHAKE_NEAR_COLLAPSE_HEIGHT,
  CAMERA_SHAKE_NEAR_COLLAPSE_MULT,
} from './constants';

/** 0 = perfect, 1 = barely landed */
export function landingShakeSeverity(
  overlapRatio: number,
  stackHeight: number,
): number {
  if (overlapRatio >= 0.9) return 0;
  const base = Math.min(1, Math.max(0, 1 - overlapRatio / 0.9));
  if (stackHeight >= CAMERA_SHAKE_NEAR_COLLAPSE_HEIGHT && overlapRatio < 0.55) {
    return Math.min(1, base * CAMERA_SHAKE_NEAR_COLLAPSE_MULT);
  }
  return base;
}

export function shakeMagnitudeX(severity: number): number {
  return severity * CAMERA_SHAKE_MAX_X_PX;
}

export function shakeMagnitudeY(severity: number): number {
  return severity * CAMERA_SHAKE_MAX_Y_PX;
}
