import { CAMERA_ANCHOR_FRACTION, CAMERA_SMOOTH_FACTOR } from './constants';

export { CAMERA_ANCHOR_FRACTION } from './constants';

/**
 * Target camera scroll (render-only). Physics never read this value.
 * Must be a top-level worklet — class static methods crash in useFrameCallback.
 */
export function cameraComputeTarget(canvasHeight: number, towerTopWorldY: number): number {
  'worklet';
  if (canvasHeight <= 0) return 0;
  const anchorY = canvasHeight * CAMERA_ANCHOR_FRACTION;
  return Math.max(0, anchorY - towerTopWorldY);
}

/**
 * Smooth interpolation — scroll += (target - scroll) * smoothFactor
 */
export function cameraStep(currentY: number, targetY: number, deltaMs: number): number {
  'worklet';
  const frames = deltaMs / 16.67;
  const t = 1 - Math.pow(1 - CAMERA_SMOOTH_FACTOR, frames);
  return currentY + (targetY - currentY) * t;
}

/** Non-worklet API surface for tests / docs */
export const CameraManager = {
  computeTarget: cameraComputeTarget,
  step: cameraStep,
};
