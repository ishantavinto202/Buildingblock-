import { SWAY_HORIZONTAL_SPEED_MULT } from './constants';

/** 1 = moving toward +amplitude (right); -1 = moving toward -amplitude (left) */
export type TraverseSignCode = 1 | -1;

export type SpawnDirection = 'ltr' | 'rtl';

/** Initial lane side + first travel direction when a new block spawns */
export function spawnDirectionToCode(dir: SpawnDirection): TraverseSignCode {
  return dir === 'ltr' ? 1 : -1;
}

export function flipSpawnDirection(dir: SpawnDirection): SpawnDirection {
  return dir === 'ltr' ? 'rtl' : 'ltr';
}

/** Starting sway offset at spawn: left for ltr, right for rtl */
export function spawnSwayOffset(amplitude: number, dir: SpawnDirection): number {
  return dir === 'ltr' ? -amplitude : amplitude;
}

export function spawnSwayOffsetWorklet(amplitude: number, spawnDirection: number): number {
  'worklet';
  return spawnDirection >= 0 ? -amplitude : amplitude;
}

/**
 * Triangle-wave ping-pong from a monotonic clock — no per-frame integration drift or
 * boundary overshoot (which caused brief reverse motion / micro-jitter).
 */
export function computePingPongSwayFromElapsedWorklet(
  elapsedMs: number,
  amplitude: number,
  halfPeriodMs: number,
): { swayOffset: number; traverseSign: TraverseSignCode } {
  'worklet';
  if (amplitude <= 0) {
    return { swayOffset: 0, traverseSign: 1 };
  }

  const periodMs = (halfPeriodMs * 2) / SWAY_HORIZONTAL_SPEED_MULT;
  if (periodMs <= 0) {
    return { swayOffset: 0, traverseSign: 1 };
  }

  const t = elapsedMs % periodMs;
  const half = periodMs * 0.5;

  if (t < half) {
    const u = t / half;
    return { swayOffset: -amplitude + 2 * amplitude * u, traverseSign: 1 };
  }

  const u = (t - half) / half;
  return { swayOffset: amplitude - 2 * amplitude * u, traverseSign: -1 };
}

/** Map a lane offset back onto the sway clock (after amplitude rescale). */
export function swayElapsedForOffsetWorklet(
  swayOffset: number,
  amplitude: number,
  halfPeriodMs: number,
  traverseSign: number,
): number {
  'worklet';
  if (amplitude <= 0) return 0;

  const periodMs = (halfPeriodMs * 2) / SWAY_HORIZONTAL_SPEED_MULT;
  if (periodMs <= 0) return 0;

  const half = periodMs * 0.5;
  const norm = Math.max(-1, Math.min(1, swayOffset / amplitude));

  if (traverseSign >= 0) {
    return ((norm + 1) * 0.5) * half;
  }
  return half + ((1 - norm) * 0.5) * half;
}

/** Preserve lane position when difficulty amplitude changes after a placement. */
export function rescaleSwayOffsetForAmplitudeWorklet(
  swayOffset: number,
  oldAmplitude: number,
  newAmplitude: number,
): number {
  'worklet';
  if (newAmplitude <= 0) return 0;
  if (oldAmplitude <= 0) return Math.max(-newAmplitude, Math.min(newAmplitude, swayOffset));
  const scaled = (swayOffset / oldAmplitude) * newAmplitude;
  return Math.max(-newAmplitude, Math.min(newAmplitude, scaled));
}

export function rescaleSwayOffsetForAmplitude(
  swayOffset: number,
  oldAmplitude: number,
  newAmplitude: number,
): number {
  if (newAmplitude <= 0) return 0;
  if (oldAmplitude <= 0) return Math.max(-newAmplitude, Math.min(newAmplitude, swayOffset));
  const scaled = (swayOffset / oldAmplitude) * newAmplitude;
  return Math.max(-newAmplitude, Math.min(newAmplitude, scaled));
}

/** Tower lean opposite to instantaneous travel direction */
export function computeTowerLeanFromPingPongWorklet(
  maxRad: number,
  swayOffset: number,
  amplitude: number,
  traverseSign: number,
): number {
  'worklet';
  if (amplitude <= 0) return 0;
  const norm = Math.max(-1, Math.min(1, swayOffset / amplitude));
  return maxRad * Math.sin((norm * Math.PI) / 2 + Math.PI);
}
