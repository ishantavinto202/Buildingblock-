import {
  BLOCK_W,
  BLOCK_H,
  BLOCK_IMAGE_COUNT,
  MIN_STACK_OVERLAP_RATIO,
  PERFECT_OVERLAP_RATIO,
  POINTS_LAND,
  POINTS_PERFECT_BONUS,
} from './constants';
import { flipSpawnDirection } from './swayMotion';
import { GameState, PlacedBlock, LandResult } from './types';

const GROUND_Y_OFFSET = 80;

export type LandingOutcome = 'miss' | 'unstable' | 'stack';

export interface OverlapGeometry {
  overlap: number;
  overlapCenter: number;
  /** -1…1: how far the block center is from the support centroid (tip direction) */
  leverArm: number;
  outcome: LandingOutcome;
}

export function initialState(canvasHeight: number): GameState {
  const groundY = canvasHeight - GROUND_Y_OFFSET - BLOCK_H;
  return {
    phase: 'idle',
    stack: [
      {
        cx: 0,
        y: groundY,
        imageIndex: 0,
      },
    ],
    nextImageIndex: 1 % BLOCK_IMAGE_COUNT,
    lastLandingWasPerfect: false,
    spawnDirection: 'ltr',
  };
}

/**
 * Computes the overlap fraction between a falling block centered at `fallingCX`
 * and the top-of-stack block centered at `topBlockCX`.
 * Returns a value 0–1.
 */
export function computeOverlap(fallingCX: number, topBlockCX: number): number {
  return computeOverlapGeometry(fallingCX, topBlockCX).overlap;
}

export function computeOverlapGeometry(
  fallingCX: number,
  topBlockCX: number,
): OverlapGeometry {
  const fallingLeft = fallingCX - BLOCK_W / 2;
  const fallingRight = fallingCX + BLOCK_W / 2;
  const topLeft = topBlockCX - BLOCK_W / 2;
  const topRight = topBlockCX + BLOCK_W / 2;
  const overlapLeft = Math.max(fallingLeft, topLeft);
  const overlapRight = Math.min(fallingRight, topRight);
  const overlapWidth = Math.max(0, overlapRight - overlapLeft);
  const overlap = overlapWidth / BLOCK_W;

  if (overlap === 0) {
    return { overlap: 0, overlapCenter: topBlockCX, leverArm: 0, outcome: 'miss' };
  }

  const overlapCenter = (overlapLeft + overlapRight) / 2;
  const leverArm = Math.max(-1, Math.min(1, (fallingCX - overlapCenter) / (BLOCK_W / 2)));

  let outcome: LandingOutcome = 'stack';
  if (overlap < MIN_STACK_OVERLAP_RATIO) {
    outcome = 'unstable';
  }

  return { overlap, overlapCenter, leverArm, outcome };
}

/**
 * Called when the falling block has enough support to stack.
 */
export function landBlock(state: GameState, fallingCX: number): LandResult {
  const topBlock = state.stack[state.stack.length - 1];
  const { overlap, outcome } = computeOverlapGeometry(fallingCX, topBlock.cx);

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
  const pointsAwarded = POINTS_LAND + (perfect ? POINTS_PERFECT_BONUS : 0);

  const newBlock: PlacedBlock = {
    cx: fallingCX,
    y: topBlock.y - BLOCK_H,
    imageIndex: state.nextImageIndex,
  };

  const nextState: GameState = {
    phase: 'idle',
    stack: [...state.stack, newBlock],
    nextImageIndex: (state.nextImageIndex + 1) % BLOCK_IMAGE_COUNT,
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
