import {
  MIN_STACK_OVERLAP_RATIO,
  NORMAL_POINTS,
  PERFECT_OVERLAP_RATIO,
  PERFECT_POINTS,
} from './constants';
import { getStackGroundY } from './basePlatform';
import { getBlockGameplayH, getBlockGameplayW, pickRandomBlockIndex } from './blockCatalog';
import { flipSpawnDirection } from './swayMotion';
import { GameState, PlacedBlock, LandResult } from './types';

export type LandingOutcome = 'miss' | 'unstable' | 'stack';

export interface OverlapGeometry {
  overlap: number;
  overlapCenter: number;
  /** -1…1: how far the block center is from the support centroid (tip direction) */
  leverArm: number;
  outcome: LandingOutcome;
}

export function initialState(canvasHeight: number): GameState {
  const startIndex = pickRandomBlockIndex();
  const startH = getBlockGameplayH(startIndex);
  const groundY = getStackGroundY(canvasHeight, startH);
  return {
    phase: 'idle',
    stack: [
      {
        cx: 0,
        y: groundY,
        imageIndex: startIndex,
      },
    ],
    nextImageIndex: pickRandomBlockIndex(),
    lastLandingWasPerfect: false,
    spawnDirection: 'ltr',
  };
}

/**
 * Computes overlap between falling and support blocks (per-type widths).
 * Overlap fraction is relative to the falling block width.
 */
export function computeOverlap(
  fallingCX: number,
  fallingImageIndex: number,
  topBlockCX: number,
  topImageIndex: number,
): number {
  return computeOverlapGeometry(fallingCX, fallingImageIndex, topBlockCX, topImageIndex).overlap;
}

export function computeOverlapGeometry(
  fallingCX: number,
  fallingImageIndex: number,
  topBlockCX: number,
  topImageIndex: number,
): OverlapGeometry {
  const fallingW = getBlockGameplayW(fallingImageIndex);
  const topW = getBlockGameplayW(topImageIndex);
  const fallingLeft = fallingCX - fallingW / 2;
  const fallingRight = fallingCX + fallingW / 2;
  const topLeft = topBlockCX - topW / 2;
  const topRight = topBlockCX + topW / 2;
  const overlapLeft = Math.max(fallingLeft, topLeft);
  const overlapRight = Math.min(fallingRight, topRight);
  const overlapWidth = Math.max(0, overlapRight - overlapLeft);
  const overlap = fallingW > 0 ? overlapWidth / fallingW : 0;

  if (overlap === 0) {
    return { overlap: 0, overlapCenter: topBlockCX, leverArm: 0, outcome: 'miss' };
  }

  const overlapCenter = (overlapLeft + overlapRight) / 2;
  const leverArm = Math.max(-1, Math.min(1, (fallingCX - overlapCenter) / (fallingW / 2)));

  let outcome: LandingOutcome = 'stack';
  if (overlap < MIN_STACK_OVERLAP_RATIO) {
    outcome = 'unstable';
  }

  return { overlap, overlapCenter, leverArm, outcome };
}

/**
 * Called when the falling block reaches the tower top plane.
 */
export function landBlock(state: GameState, fallingCX: number): LandResult {
  const topBlock = state.stack[state.stack.length - 1];
  const fallingIdx = state.nextImageIndex;
  const { overlap, outcome } = computeOverlapGeometry(
    fallingCX,
    fallingIdx,
    topBlock.cx,
    topBlock.imageIndex,
  );

  if (outcome === 'miss') {
    return {
      nextState: { ...state, phase: 'game_over' },
      perfect: false,
      pointsAwarded: 0,
    };
  }

  if (outcome === 'unstable') {
    return {
      nextState: { ...state, phase: 'tipping' },
      perfect: false,
      pointsAwarded: 0,
    };
  }

  const perfect = overlap >= PERFECT_OVERLAP_RATIO;
  const pointsAwarded = perfect ? PERFECT_POINTS : NORMAL_POINTS;
  const fallingH = getBlockGameplayH(fallingIdx);

  const newBlock: PlacedBlock = {
    cx: fallingCX,
    y: topBlock.y - fallingH,
    imageIndex: fallingIdx,
  };

  const nextState: GameState = {
    phase: 'idle',
    stack: [...state.stack, newBlock],
    nextImageIndex: pickRandomBlockIndex(),
    lastLandingWasPerfect: perfect,
    spawnDirection: flipSpawnDirection(state.spawnDirection ?? 'ltr'),
  };

  return { nextState, perfect, pointsAwarded };
}

export function resetState(canvasWidth: number, canvasHeight: number): GameState {
  const s = initialState(canvasHeight);
  s.stack[0].cx = canvasWidth / 2;
  return s;
}
