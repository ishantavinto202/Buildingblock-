import {
  BLOCK_W, BLOCK_H, BLOCK_IMAGE_COUNT,
  PERFECT_OVERLAP_RATIO, POINTS_LAND, POINTS_PERFECT_BONUS,
} from './constants';
import { GameState, PlacedBlock, LandResult } from './types';

const GROUND_Y_OFFSET = 80;

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
    score: 0,
    lastLandingWasPerfect: false,
  };
}

/**
 * Computes the overlap fraction between a falling block centered at `fallingCX`
 * and the top-of-stack block centered at `topBlockCX`.
 * Returns a value 0–1.
 */
export function computeOverlap(fallingCX: number, topBlockCX: number): number {
  const fallingLeft = fallingCX - BLOCK_W / 2;
  const fallingRight = fallingCX + BLOCK_W / 2;
  const topLeft = topBlockCX - BLOCK_W / 2;
  const topRight = topBlockCX + BLOCK_W / 2;
  const overlapLeft = Math.max(fallingLeft, topLeft);
  const overlapRight = Math.min(fallingRight, topRight);
  const overlap = Math.max(0, overlapRight - overlapLeft);
  return overlap / BLOCK_W;
}

/**
 * Called when the falling block reaches the top of the stack.
 * Returns the next state + metadata about the landing.
 */
export function landBlock(state: GameState, fallingCX: number): LandResult {
  const topBlock = state.stack[state.stack.length - 1];
  const overlap = computeOverlap(fallingCX, topBlock.cx);

  const isMiss = fallingCX < topBlock.cx - BLOCK_W / 2 || fallingCX > topBlock.cx + BLOCK_W / 2;

  if (isMiss) {
    return {
      nextState: { ...state, phase: 'game_over' },
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
    score: state.score + pointsAwarded,
    lastLandingWasPerfect: perfect,
  };

  return { nextState, perfect, pointsAwarded };
}

export function resetState(canvasWidth: number, canvasHeight: number): GameState {
  const s = initialState(canvasHeight);
  s.stack[0].cx = canvasWidth / 2;
  return s;
}
