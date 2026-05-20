# Voxel Stacking Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete voxel-style 2D side-view building stacking game on top of the existing Expo / React Native project shell.

**Architecture:** All game animation runs on the UI thread via Reanimated 4 `useSharedValue`s and `useFrameCallback`. Game logic is a pure TypeScript reducer in `slice.ts`. Rendering is a single Skia `<Canvas>`. The score is persisted to AsyncStorage via a Zustand store.

**Tech Stack:** `@shopify/react-native-skia` 2.2.12, `react-native-reanimated` 4.1.1, `zustand` 5, `@react-native-async-storage/async-storage` 2.2.0, `expo-haptics`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/game/types.ts` | Create | All TypeScript interfaces |
| `src/game/constants.ts` | Create | Tunable numeric values |
| `src/game/difficulty.ts` | Create | Sway amplitude/period curves |
| `src/game/slice.ts` | Create | Pure game reducer (no RN deps) |
| `src/utils/storage.ts` | Create | AsyncStorage typed wrappers |
| `src/store/scoreStore.ts` | Create | Zustand score + highScore store |
| `src/effects/ParticlePool.ts` | Create | Pre-allocated particle pool |
| `src/hooks/useTowerGame.ts` | Create | Main game loop hook |
| `src/components/GameCanvas.tsx` | Create | Skia canvas (tower + block + particles) |
| `src/components/GameHUD.tsx` | Create | Score overlay (RN Views) |
| `src/components/StarPop.tsx` | Create | Sparkle burst controller |
| `src/components/TowerGameScreen.tsx` | Create | Root game component |
| `app/(tabs)/index.tsx` | Modify | Replace boilerplate with TowerGameScreen |
| `assets/images/blocks/` | Create | 8 placeholder PNG block images |

---

## Task 1: Types and Constants

**Files:**
- Create: `src/game/types.ts`
- Create: `src/game/constants.ts`

- [ ] **Step 1: Create `src/game/types.ts`**

```typescript
export type GamePhase = 'idle' | 'dropping' | 'animating' | 'game_over';

export interface PlacedBlock {
  /** Horizontal center, in canvas pixels */
  cx: number;
  /** Top edge, in canvas pixels */
  y: number;
  imageIndex: number;
}

export interface GameState {
  phase: GamePhase;
  stack: PlacedBlock[];
  /** Image index for the next falling block */
  nextImageIndex: number;
  score: number;
  lastLandingWasPerfect: boolean;
}

export interface SwayConfig {
  amplitude: number; // px, 0 = no sway
  halfPeriod: number; // ms per half-cycle (left → right)
}

export interface Particle {
  active: boolean;
  startX: number;
  startY: number;
  /** Radians */
  angle: number;
  /** px/s */
  speed: number;
  color: string;
}

export type GameAction =
  | { type: 'DROP'; fallingCX: number }
  | { type: 'RESET' };

// Returned by the reducer when a block lands
export interface LandResult {
  nextState: GameState;
  perfect: boolean;
  pointsAwarded: number;
}
```

- [ ] **Step 2: Create `src/game/constants.ts`**

```typescript
/** Logical width of every block in canvas pixels */
export const BLOCK_W = 80;
/** Logical height of every block in canvas pixels */
export const BLOCK_H = 56;
/** How far from the top of the canvas the first falling block spawns (top edge) */
export const SPAWN_Y = 60;
/** Number of distinct block images */
export const BLOCK_IMAGE_COUNT = 8;

/** Fraction of BLOCK_W that must overlap for a "perfect" placement (0–1) */
export const PERFECT_OVERLAP_RATIO = 0.9;

/** Starting fall speed in px/frame (~60fps) */
export const FALL_SPEED_INITIAL = 6;
/** Speed increase per 5 blocks stacked */
export const FALL_SPEED_INCREMENT = 0.3;
/** Maximum fall speed cap */
export const FALL_SPEED_MAX = 12;

/** Duration of each sparkle particle animation in ms */
export const PARTICLE_DURATION_MS = 600;
/** Duration of the floating +N score text in ms */
export const SCORE_TEXT_DURATION_MS = 800;
/** How far the +N text travels upward during its animation */
export const SCORE_TEXT_RISE_PX = 40;
/** Total particle slots in the pool */
export const PARTICLE_POOL_SIZE = 20;
/** How many particles to activate per perfect burst */
export const PARTICLES_PER_BURST = 14;

/** Minimum particle launch speed in px/s */
export const PARTICLE_SPEED_MIN = 60;
/** Maximum particle launch speed in px/s */
export const PARTICLE_SPEED_MAX = 140;

/** Particle star colors */
export const PARTICLE_COLORS = ['#FFD700', '#FFFFFF', '#FFF3A3', '#FFE566'];

/** Tower sway amplitude is this fraction of the falling block amplitude */
export const TOWER_SWAY_FRACTION = 0.3;

/** withSpring config used for tower sway */
export const TOWER_SPRING = { damping: 8, stiffness: 60 };

/** Points for a plain landing */
export const POINTS_LAND = 1;
/** Bonus points for a perfect landing (in addition to POINTS_LAND) */
export const POINTS_PERFECT_BONUS = 3;
```

- [ ] **Step 3: Commit**

```bash
git add src/game/types.ts src/game/constants.ts
git commit -m "feat: add game types and constants"
```

---

## Task 2: Difficulty Curve

**Files:**
- Create: `src/game/difficulty.ts`

- [ ] **Step 1: Create `src/game/difficulty.ts`**

```typescript
import { SwayConfig } from './types';

interface DifficultyBreakpoint {
  height: number;
  amplitude: number;
  halfPeriod: number;
}

const BREAKPOINTS: DifficultyBreakpoint[] = [
  { height: 0,  amplitude: 0,  halfPeriod: 1000 },
  { height: 4,  amplitude: 0,  halfPeriod: 1000 },
  { height: 8,  amplitude: 8,  halfPeriod: 1000 },
  { height: 12, amplitude: 20, halfPeriod: 800  },
  { height: 16, amplitude: 40, halfPeriod: 650  },
  { height: 20, amplitude: 65, halfPeriod: 550  },
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Returns sway amplitude (px) and half-period (ms) for a given stack height.
 * Values are linearly interpolated between breakpoints.
 */
export function getSwayConfig(stackHeight: number): SwayConfig {
  if (stackHeight <= BREAKPOINTS[0].height) {
    return { amplitude: BREAKPOINTS[0].amplitude, halfPeriod: BREAKPOINTS[0].halfPeriod };
  }

  const last = BREAKPOINTS[BREAKPOINTS.length - 1];
  if (stackHeight >= last.height) {
    return { amplitude: last.amplitude, halfPeriod: last.halfPeriod };
  }

  for (let i = 1; i < BREAKPOINTS.length; i++) {
    const prev = BREAKPOINTS[i - 1];
    const curr = BREAKPOINTS[i];
    if (stackHeight <= curr.height) {
      const t = (stackHeight - prev.height) / (curr.height - prev.height);
      return {
        amplitude: lerp(prev.amplitude, curr.amplitude, t),
        halfPeriod: lerp(prev.halfPeriod, curr.halfPeriod, t),
      };
    }
  }

  return { amplitude: last.amplitude, halfPeriod: last.halfPeriod };
}

/**
 * Fall speed (px/frame at 60fps) for a given stack height.
 */
export function getFallSpeed(stackHeight: number): number {
  const { FALL_SPEED_INITIAL, FALL_SPEED_INCREMENT, FALL_SPEED_MAX } =
    require('./constants') as typeof import('./constants');
  const increments = Math.floor(stackHeight / 5);
  return Math.min(FALL_SPEED_INITIAL + increments * FALL_SPEED_INCREMENT, FALL_SPEED_MAX);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/game/difficulty.ts
git commit -m "feat: add difficulty/sway curve"
```

---

## Task 3: Pure Game Reducer

**Files:**
- Create: `src/game/slice.ts`

The reducer handles only landing logic. Drop and fall are managed by the animation hook. Game over is determined by the hook and triggers a `RESET` or marks the state.

- [ ] **Step 1: Create `src/game/slice.ts`**

```typescript
import {
  BLOCK_W, BLOCK_H, SPAWN_Y, BLOCK_IMAGE_COUNT,
  PERFECT_OVERLAP_RATIO, POINTS_LAND, POINTS_PERFECT_BONUS,
} from './constants';
import { GameState, PlacedBlock, LandResult } from './types';

/** Canvas height used to compute the first ground block position */
const GROUND_Y_OFFSET = 80; // px from bottom; set at runtime via initialState()

export function initialState(canvasHeight: number): GameState {
  const groundY = canvasHeight - GROUND_Y_OFFSET - BLOCK_H;
  return {
    phase: 'idle',
    stack: [
      {
        cx: 0, // set to canvas center at runtime
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
 * and the top-of-stack block centered at `topBlock.cx`.
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

  // Complete miss: center of falling block is outside top block bounds
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
  // Center the ground block
  s.stack[0].cx = canvasWidth / 2;
  return s;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/game/slice.ts
git commit -m "feat: add pure game reducer with landing and overlap logic"
```

---

## Task 4: Storage Utils and Score Store

**Files:**
- Create: `src/utils/storage.ts`
- Create: `src/store/scoreStore.ts`

- [ ] **Step 1: Create `src/utils/storage.ts`**

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function loadNumber(key: string, fallback: number): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export async function saveNumber(key: string, value: number): Promise<void> {
  try {
    await AsyncStorage.setItem(key, String(value));
  } catch {
    // Silently swallow — never crash the game
  }
}
```

- [ ] **Step 2: Create `src/store/scoreStore.ts`**

```typescript
import { create } from 'zustand';
import { loadNumber, saveNumber } from '../utils/storage';

const HIGH_SCORE_KEY = 'stacking_game_high_score';

interface ScoreStore {
  score: number;
  highScore: number;
  hasLoadedHighScore: boolean;
  loadHighScore: () => Promise<void>;
  addPoints: (points: number) => void;
  resetScore: () => void;
}

export const useScoreStore = create<ScoreStore>((set, get) => ({
  score: 0,
  highScore: 0,
  hasLoadedHighScore: false,

  loadHighScore: async () => {
    const hs = await loadNumber(HIGH_SCORE_KEY, 0);
    set({ highScore: hs, hasLoadedHighScore: true });
  },

  addPoints: (points: number) => {
    const { score, highScore } = get();
    const newScore = score + points;
    const newHigh = Math.max(newScore, highScore);
    set({ score: newScore, highScore: newHigh });
    if (newHigh > highScore) {
      saveNumber(HIGH_SCORE_KEY, newHigh);
    }
  },

  resetScore: () => {
    set({ score: 0 });
  },
}));
```

- [ ] **Step 3: Commit**

```bash
git add src/utils/storage.ts src/store/scoreStore.ts
git commit -m "feat: add storage utils and Zustand score store with AsyncStorage persistence"
```

---

## Task 5: Particle Pool

**Files:**
- Create: `src/effects/ParticlePool.ts`

- [ ] **Step 1: Create `src/effects/ParticlePool.ts`**

```typescript
import { PARTICLE_POOL_SIZE, PARTICLE_COLORS, PARTICLE_SPEED_MIN, PARTICLE_SPEED_MAX } from '../game/constants';
import { Particle } from '../game/types';

export class ParticlePool {
  private slots: Particle[];

  constructor() {
    this.slots = Array.from({ length: PARTICLE_POOL_SIZE }, () => ({
      active: false,
      startX: 0,
      startY: 0,
      angle: 0,
      speed: 0,
      color: '#FFD700',
    }));
  }

  /**
   * Activates up to `count` particles, starting from `cx, cy`.
   * Returns the indices of activated slots so the caller can drive their animations.
   */
  activate(cx: number, cy: number, count: number): number[] {
    const activated: number[] = [];
    for (let i = 0; i < this.slots.length && activated.length < count; i++) {
      if (!this.slots[i].active) {
        const angle = (Math.PI * 2 * activated.length) / count + (Math.random() * 0.5 - 0.25);
        const speed = PARTICLE_SPEED_MIN + Math.random() * (PARTICLE_SPEED_MAX - PARTICLE_SPEED_MIN);
        this.slots[i] = {
          active: true,
          startX: cx,
          startY: cy,
          angle,
          speed,
          color: PARTICLE_COLORS[activated.length % PARTICLE_COLORS.length],
        };
        activated.push(i);
      }
    }
    return activated;
  }

  deactivate(index: number): void {
    this.slots[index].active = false;
  }

  get(index: number): Particle {
    return this.slots[index];
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/effects/ParticlePool.ts
git commit -m "feat: add pre-allocated particle pool"
```

---

## Task 6: Main Game Hook

**Files:**
- Create: `src/hooks/useTowerGame.ts`

This is the core of the game. It manages:
- Sway animation (Reanimated `withRepeat`)
- Fall physics (`useFrameCallback`)
- Collision detection (runs on UI thread, calls back to JS on landing)
- Tower sway (`withSpring`)
- Particle animations

- [ ] **Step 1: Create `src/hooks/useTowerGame.ts`**

```typescript
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  useFrameCallback,
  runOnJS,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { useScoreStore } from '../store/scoreStore';
import { initialState, landBlock, resetState, computeOverlap } from '../game/slice';
import { getSwayConfig, getFallSpeed } from '../game/difficulty';
import { ParticlePool } from '../effects/ParticlePool';
import { GameState } from '../game/types';
import {
  SPAWN_Y, BLOCK_H, BLOCK_W,
  PARTICLES_PER_BURST, PARTICLE_POOL_SIZE, PARTICLE_DURATION_MS,
  SCORE_TEXT_DURATION_MS, SCORE_TEXT_RISE_PX,
  TOWER_SWAY_FRACTION, TOWER_SPRING,
} from '../game/constants';

export interface ParticleAnimState {
  t: ReturnType<typeof useSharedValue<number>>;
  active: ReturnType<typeof useSharedValue<boolean>>;
}

export interface TowerGameHook {
  gameState: GameState;
  /** Horizontal sway offset of the falling block (canvas coords) */
  swayOffset: ReturnType<typeof useSharedValue<number>>;
  /** Current Y of the falling block's top edge */
  fallY: ReturnType<typeof useSharedValue<number>>;
  /** Horizontal sway offset of the entire tower */
  towerSwayOffset: ReturnType<typeof useSharedValue<number>>;
  /** Per-slot particle animation progress [0,1] */
  particleTs: ReturnType<typeof useSharedValue<number>>[];
  /** Whether each particle slot is visible */
  particleActives: ReturnType<typeof useSharedValue<boolean>>[];
  particlePool: ParticlePool;
  /** Score text pop-up: vertical offset from burst center */
  scoreTextY: ReturnType<typeof useSharedValue<number>>;
  scoreTextOpacity: ReturnType<typeof useSharedValue<number>>;
  onTap: () => void;
  canvasWidth: number;
  canvasHeight: number;
  onLayout: (w: number, h: number) => void;
}

export function useTowerGame(): TowerGameHook {
  const [canvasSize, setCanvasSize] = useState({ width: 390, height: 844 });
  const addPoints = useScoreStore((s) => s.addPoints);
  const resetScore = useScoreStore((s) => s.resetScore);

  const [gameState, setGameState] = useState<GameState>(() =>
    resetState(canvasSize.width, canvasSize.height)
  );
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  // --- Shared values ---
  const swayOffset = useSharedValue(0);
  const fallY = useSharedValue(SPAWN_Y);
  const towerSwayOffset = useSharedValue(0);
  const scoreTextY = useSharedValue(0);
  const scoreTextOpacity = useSharedValue(0);

  // Per-particle animation values (fixed pool size)
  const particleTs = Array.from({ length: PARTICLE_POOL_SIZE }, () =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useSharedValue(0)
  );
  const particleActives = Array.from({ length: PARTICLE_POOL_SIZE }, () =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useSharedValue(false)
  );

  const particlePool = useRef(new ParticlePool()).current;

  // --- Sway animation ---
  const startSway = useCallback((stackHeight: number) => {
    const { amplitude, halfPeriod } = getSwayConfig(stackHeight);
    cancelAnimation(swayOffset);
    if (amplitude === 0) {
      swayOffset.value = 0;
      return;
    }
    swayOffset.value = withRepeat(
      withSequence(
        withTiming(-amplitude, { duration: halfPeriod, easing: Easing.inOut(Easing.sin) }),
        withTiming(amplitude, { duration: halfPeriod, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [swayOffset]);

  // --- Landing callback (called from UI thread via runOnJS) ---
  const handleLand = useCallback((fallingCX: number) => {
    const state = gameStateRef.current;
    if (state.phase !== 'dropping') return;

    const { nextState, perfect, pointsAwarded } = landBlock(state, fallingCX);

    if (nextState.phase === 'game_over') {
      cancelAnimation(swayOffset);
      cancelAnimation(towerSwayOffset);
      swayOffset.value = withTiming(0, { duration: 200 });
      towerSwayOffset.value = withTiming(0, { duration: 400 });
      setGameState(nextState);
      return;
    }

    // Update score in store
    addPoints(pointsAwarded);

    // Burst effect on perfect landing
    if (perfect) {
      const topBlock = state.stack[state.stack.length - 1];
      const burstCX = fallingCX;
      const burstCY = topBlock.y - BLOCK_H / 2;
      const activated = particlePool.activate(burstCX, burstCY, PARTICLES_PER_BURST);
      activated.forEach((idx) => {
        particleActives[idx].value = true;
        particleTs[idx].value = 0;
        particleTs[idx].value = withTiming(1, { duration: PARTICLE_DURATION_MS }, (finished) => {
          'worklet';
          if (finished) {
            particleActives[idx].value = false;
            runOnJS(particlePool.deactivate.bind(particlePool))(idx);
          }
        });
      });

      // Floating score text
      scoreTextY.value = burstCY;
      scoreTextOpacity.value = 1;
      scoreTextY.value = withTiming(burstCY - SCORE_TEXT_RISE_PX, { duration: SCORE_TEXT_DURATION_MS });
      scoreTextOpacity.value = withTiming(0, { duration: SCORE_TEXT_DURATION_MS });
    }

    // Start tower sway
    const newStackHeight = nextState.stack.length;
    const { amplitude } = getSwayConfig(newStackHeight);
    const towerAmplitude = amplitude * TOWER_SWAY_FRACTION;
    if (towerAmplitude > 0) {
      towerSwayOffset.value = withSpring(-towerAmplitude, TOWER_SPRING, () => {
        'worklet';
        towerSwayOffset.value = withSpring(0, TOWER_SPRING);
      });
    }

    setGameState(nextState);
    // Sway restarts after state update triggers useEffect
  }, [addPoints, particlePool, particleActives, particleTs, swayOffset, towerSwayOffset, scoreTextY, scoreTextOpacity]);

  // Restart sway whenever a new block is ready to drop
  useEffect(() => {
    if (gameState.phase === 'idle') {
      fallY.value = SPAWN_Y;
      startSway(gameState.stack.length);
      setGameState((prev) => ({ ...prev, phase: 'dropping' }));
    }
  }, [gameState.phase, gameState.stack.length, fallY, startSway]);

  // --- Frame callback: fall physics + collision ---
  useFrameCallback((frameInfo) => {
    'worklet';
    const state = gameStateRef.current;
    if (state.phase !== 'dropping') return;

    const dt = (frameInfo.timeSincePreviousFrame ?? 16) / 16.67; // normalize to 60fps
    const speed = getFallSpeed(state.stack.length) * dt;
    fallY.value = fallY.value + speed;

    // Check collision: falling block bottom vs top of stack
    const topBlock = state.stack[state.stack.length - 1];
    const fallingBottom = fallY.value + BLOCK_H;
    if (fallingBottom >= topBlock.y) {
      fallY.value = topBlock.y - BLOCK_H;
      const fallingCX = (canvasSize.width / 2) + swayOffset.value;
      runOnJS(handleLand)(fallingCX);
    }
  }, true);

  const onTap = useCallback(() => {
    const state = gameStateRef.current;
    if (state.phase === 'game_over') {
      // Reset
      cancelAnimation(swayOffset);
      const next = resetState(canvasSize.width, canvasSize.height);
      resetScore();
      setGameState(next);
    }
    // Drop is handled automatically by the frame callback; tap is for game-over only.
    // The block auto-falls once phase = 'dropping'.
  }, [canvasSize, resetScore, swayOffset]);

  const onLayout = useCallback((w: number, h: number) => {
    setCanvasSize({ width: w, height: h });
  }, []);

  return {
    gameState,
    swayOffset,
    fallY,
    towerSwayOffset,
    particleTs,
    particleActives,
    particlePool,
    scoreTextY,
    scoreTextOpacity,
    onTap,
    canvasWidth: canvasSize.width,
    canvasHeight: canvasSize.height,
    onLayout,
  };
}
```

> **Note:** The tap gesture does not manually trigger a drop because the block falls automatically as soon as `phase === 'dropping'`. The tap's only role is to restart on game-over. If you want a "tap to drop" mechanic (block only falls after tap), see the variation note at the end of this plan.

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useTowerGame.ts
git commit -m "feat: add main game loop hook with Reanimated frame callback"
```

---

## Task 7: Place Block PNG Assets

**Files:**
- Create: `assets/images/blocks/block_0.png` … `block_7.png`

The game expects 8 PNG files at `assets/images/blocks/block_0.png` through `block_7.png`. Put your real voxel building assets there. Until they are ready, create colored placeholder PNGs (80×56 px) so the app runs.

- [ ] **Step 1: Copy your 8 PNG building block assets into `assets/images/blocks/`**

```bash
mkdir -p assets/images/blocks
# Copy your files:
# cp ~/path/to/your/block_0.png assets/images/blocks/block_0.png
# ... repeat for block_1 through block_7
```

If you need placeholder images for now, you can generate simple colored rectangles:

```bash
# Requires ImageMagick (brew install imagemagick)
for i in 0 1 2 3 4 5 6 7; do
  convert -size 80x56 "xc:hsl($((i * 45)),70%,55%)" assets/images/blocks/block_$i.png
done
```

- [ ] **Step 2: Commit**

```bash
git add assets/images/blocks/
git commit -m "feat: add block PNG assets"
```

---

## Task 8: Skia Game Canvas

**Files:**
- Create: `src/components/GameCanvas.tsx`

- [ ] **Step 1: Create `src/components/GameCanvas.tsx`**

```typescript
import React from 'react';
import {
  Canvas,
  Image,
  useImage,
  Group,
  Path,
  Skia,
  Text,
  useFont,
  useDerivedValue,
  Fill,
} from '@shopify/react-native-skia';
import { SharedValue } from 'react-native-reanimated';
import { GameState, Particle } from '../game/types';
import { ParticlePool } from '../effects/ParticlePool';
import { BLOCK_W, BLOCK_H, PARTICLE_POOL_SIZE, PARTICLE_DURATION_MS } from '../game/constants';

// Preload all 8 block images at module level using require()
const BLOCK_REQUIRES = [
  require('../../assets/images/blocks/block_0.png'),
  require('../../assets/images/blocks/block_1.png'),
  require('../../assets/images/blocks/block_2.png'),
  require('../../assets/images/blocks/block_3.png'),
  require('../../assets/images/blocks/block_4.png'),
  require('../../assets/images/blocks/block_5.png'),
  require('../../assets/images/blocks/block_6.png'),
  require('../../assets/images/blocks/block_7.png'),
];

/** Build a 4-pointed star Skia path centered at origin, radius r */
function makeStarPath(r: number): ReturnType<typeof Skia.Path.Make> {
  const path = Skia.Path.Make();
  const inner = r * 0.4;
  const points = 4;
  for (let i = 0; i < points * 2; i++) {
    const angle = (Math.PI / points) * i - Math.PI / 2;
    const radius = i % 2 === 0 ? r : inner;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  }
  path.close();
  return path;
}

const STAR_PATH = makeStarPath(6);

interface GameCanvasProps {
  width: number;
  height: number;
  gameState: GameState;
  swayOffset: SharedValue<number>;
  fallY: SharedValue<number>;
  towerSwayOffset: SharedValue<number>;
  particleTs: SharedValue<number>[];
  particleActives: SharedValue<boolean>[];
  particlePool: ParticlePool;
  scoreTextY: SharedValue<number>;
  scoreTextOpacity: SharedValue<number>;
}

export function GameCanvas({
  width,
  height,
  gameState,
  swayOffset,
  fallY,
  towerSwayOffset,
  particleTs,
  particleActives,
  particlePool,
  scoreTextY,
  scoreTextOpacity,
}: GameCanvasProps) {
  const images = BLOCK_REQUIRES.map((req) => useImage(req));

  // Derived transform for the falling block
  const fallingTransform = useDerivedValue(() => [
    { translateX: width / 2 + swayOffset.value - BLOCK_W / 2 },
    { translateY: fallY.value },
  ]);

  // Derived transform for the tower group
  const towerTransform = useDerivedValue(() => [
    { translateX: towerSwayOffset.value },
  ]);

  // Derived score text opacity
  const scoreTextPaint = useDerivedValue(() => ({
    opacity: scoreTextOpacity.value,
  }));

  return (
    <Canvas style={{ width, height }}>
      <Fill color="#1a1a2e" />

      {/* Tower: all settled blocks */}
      <Group transform={towerTransform}>
        {gameState.stack.map((block, i) => {
          const img = images[block.imageIndex];
          if (!img) return null;
          return (
            <Image
              key={i}
              image={img}
              x={block.cx - BLOCK_W / 2}
              y={block.y}
              width={BLOCK_W}
              height={BLOCK_H}
              fit="fill"
            />
          );
        })}
      </Group>

      {/* Falling block */}
      {gameState.phase === 'dropping' && (() => {
        const img = images[gameState.nextImageIndex];
        if (!img) return null;
        return (
          <Group transform={fallingTransform}>
            <Image
              image={img}
              x={0}
              y={0}
              width={BLOCK_W}
              height={BLOCK_H}
              fit="fill"
            />
          </Group>
        );
      })()}

      {/* Particles */}
      {Array.from({ length: PARTICLE_POOL_SIZE }, (_, idx) => {
        const particle = particlePool.get(idx);
        const t = particleTs[idx];
        const active = particleActives[idx];

        const particleTransform = useDerivedValue(() => {
          if (!active.value) return [{ translateX: -9999 }, { translateY: -9999 }];
          const elapsed = t.value;
          const dx = Math.cos(particle.angle) * particle.speed * (elapsed * PARTICLE_DURATION_MS / 1000);
          const dy = Math.sin(particle.angle) * particle.speed * (elapsed * PARTICLE_DURATION_MS / 1000);
          return [
            { translateX: particle.startX + dx },
            { translateY: particle.startY + dy },
            { scale: 1.2 - 1.2 * elapsed },
          ];
        });

        const particleOpacity = useDerivedValue(() =>
          active.value ? Math.max(0, 1 - t.value) : 0
        );

        return (
          <Group key={idx} transform={particleTransform} opacity={particleOpacity}>
            <Path path={STAR_PATH} color={particle.color} />
          </Group>
        );
      })}

      {/* Floating +3 score text */}
      <Group
        transform={useDerivedValue(() => [
          { translateX: width / 2 - 14 },
          { translateY: scoreTextY.value },
        ])}
        opacity={useDerivedValue(() => scoreTextOpacity.value)}
      >
        <Text text="+3" x={0} y={0} color="#FFD700" font={null} />
      </Group>
    </Canvas>
  );
}
```

> **Note on font:** The `+3` text uses `font={null}` which falls back to Skia's default font. To use a custom font, load it with `useFont(require('...'), size)` and pass it to the `Text` element.

- [ ] **Step 2: Commit**

```bash
git add src/components/GameCanvas.tsx
git commit -m "feat: add Skia game canvas component"
```

---

## Task 9: StarPop Controller

**Files:**
- Create: `src/components/StarPop.tsx`

StarPop is a thin wrapper — the actual particle work is done inside `useTowerGame` and rendered in `GameCanvas`. This component exists to encapsulate the haptic side-effect trigger.

- [ ] **Step 1: Create `src/components/StarPop.tsx`**

```typescript
import { useEffect } from 'react';
import * as Haptics from 'expo-haptics';

interface StarPopProps {
  /** Increment this value to trigger a new burst */
  trigger: number;
}

/**
 * Fires a haptic pulse whenever `trigger` increments.
 * Rendering is handled by GameCanvas; this component owns only the side-effect.
 */
export function StarPop({ trigger }: StarPopProps) {
  useEffect(() => {
    if (trigger === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [trigger]);

  return null;
}
```

Update `useTowerGame.ts` to expose and increment a `perfectTrigger` counter when a perfect landing occurs. Add to the return type:

```typescript
perfectTrigger: number; // starts 0, increments on each perfect landing
```

Add to state inside the hook:
```typescript
const [perfectTrigger, setPerfectTrigger] = useState(0);
```

In `handleLand`, after the particle activation block:
```typescript
if (perfect) {
  // existing burst code ...
  setPerfectTrigger((n) => n + 1);
}
```

Add to the return object:
```typescript
perfectTrigger,
```

- [ ] **Step 2: Commit**

```bash
git add src/components/StarPop.tsx
git commit -m "feat: add StarPop haptic trigger component"
```

---

## Task 10: HUD Component

**Files:**
- Create: `src/components/GameHUD.tsx`

- [ ] **Step 1: Create `src/components/GameHUD.tsx`**

```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useScoreStore } from '../store/scoreStore';

interface GameHUDProps {
  isGameOver: boolean;
  onRestart: () => void;
  finalScore?: number;
}

export function GameHUD({ isGameOver, onRestart, finalScore }: GameHUDProps) {
  const { score, highScore, hasLoadedHighScore } = useScoreStore();

  return (
    <>
      {/* Live score bar */}
      <View style={styles.topBar} pointerEvents="none">
        <Text style={styles.score}>{score}</Text>
        <Text style={styles.highScore}>
          {hasLoadedHighScore && highScore > 0 ? `BEST  ${highScore}` : 'BEST  --'}
        </Text>
      </View>

      {/* Game over overlay */}
      {isGameOver && (
        <View style={styles.overlay}>
          <Text style={styles.gameOverTitle}>GAME OVER</Text>
          <Text style={styles.finalScore}>{finalScore ?? score}</Text>
          {highScore > 0 && (
            <Text style={styles.bestScore}>
              {finalScore === highScore ? '🏆 NEW BEST!' : `BEST  ${highScore}`}
            </Text>
          )}
          <Text style={styles.restartButton} onPress={onRestart}>
            PLAY AGAIN
          </Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  topBar: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    zIndex: 10,
  },
  score: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  highScore: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.55)',
    alignSelf: 'center',
    letterSpacing: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,10,20,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  gameOverTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 4,
    marginBottom: 12,
  },
  finalScore: {
    fontSize: 72,
    fontWeight: '800',
    color: '#FFD700',
    lineHeight: 80,
  },
  bestScore: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 8,
    letterSpacing: 1,
  },
  restartButton: {
    marginTop: 40,
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 3,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 8,
    overflow: 'hidden',
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/GameHUD.tsx
git commit -m "feat: add GameHUD score overlay and game-over screen"
```

---

## Task 11: TowerGameScreen Root Component

**Files:**
- Create: `src/components/TowerGameScreen.tsx`

- [ ] **Step 1: Create `src/components/TowerGameScreen.tsx`**

```typescript
import React, { useEffect } from 'react';
import { StyleSheet, View, TouchableWithoutFeedback } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTowerGame } from '../hooks/useTowerGame';
import { GameCanvas } from './GameCanvas';
import { GameHUD } from './GameHUD';
import { StarPop } from './StarPop';
import { useScoreStore } from '../store/scoreStore';

export function TowerGameScreen() {
  const insets = useSafeAreaInsets();
  const loadHighScore = useScoreStore((s) => s.loadHighScore);
  const score = useScoreStore((s) => s.score);

  const {
    gameState,
    swayOffset,
    fallY,
    towerSwayOffset,
    particleTs,
    particleActives,
    particlePool,
    scoreTextY,
    scoreTextOpacity,
    perfectTrigger,
    onTap,
    canvasWidth,
    canvasHeight,
    onLayout,
  } = useTowerGame();

  useEffect(() => {
    loadHighScore();
  }, [loadHighScore]);

  const isGameOver = gameState.phase === 'game_over';

  return (
    <TouchableWithoutFeedback onPress={onTap}>
      <View
        style={[styles.container, { paddingTop: insets.top }]}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          onLayout(width, height);
        }}
      >
        <GameCanvas
          width={canvasWidth}
          height={canvasHeight}
          gameState={gameState}
          swayOffset={swayOffset}
          fallY={fallY}
          towerSwayOffset={towerSwayOffset}
          particleTs={particleTs}
          particleActives={particleActives}
          particlePool={particlePool}
          scoreTextY={scoreTextY}
          scoreTextOpacity={scoreTextOpacity}
        />
        <GameHUD
          isGameOver={isGameOver}
          onRestart={onTap}
          finalScore={isGameOver ? score : undefined}
        />
        <StarPop trigger={perfectTrigger} />
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/TowerGameScreen.tsx
git commit -m "feat: add TowerGameScreen root component"
```

---

## Task 12: Wire into Expo Router Entry Point

**Files:**
- Modify: `app/(tabs)/index.tsx`
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Replace `app/(tabs)/index.tsx` with the game screen**

```typescript
import { TowerGameScreen } from '@/src/components/TowerGameScreen';

export default function HomeScreen() {
  return <TowerGameScreen />;
}
```

- [ ] **Step 2: Remove unused tab bar from `app/(tabs)/_layout.tsx`**

Open `app/(tabs)/_layout.tsx`. The default Expo template includes a tab bar — remove or hide it so the game is full-screen. Replace its content with:

```typescript
import { Stack } from 'expo-router';

export default function TabLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
```

- [ ] **Step 3: Verify `app.json` has portrait locked**

`app.json` already has `"orientation": "portrait"` — no change needed.

- [ ] **Step 4: Commit**

```bash
git add app/\(tabs\)/index.tsx app/\(tabs\)/_layout.tsx
git commit -m "feat: wire game screen into Expo Router entry point"
```

---

## Task 13: Run and Verify

- [ ] **Step 1: Start the dev server**

```bash
npx expo start -c
```

- [ ] **Step 2: Verify these behaviors on device or simulator**

| Behavior | Expected |
|---|---|
| App opens | Full-screen dark blue background, one block visible at the bottom, a new block swaying at top (after stack reaches height 5+) |
| Blocks 1–4 | Block falls straight, no sway |
| Blocks 5+ | Falling block sways; sway increases with each 4-block milestone |
| Tower sway | Tower gently leans after each landing (heights 5+) |
| Landing | Block snaps to stack, new block spawns immediately |
| Perfect land | Gold sparkle burst fires, haptic pulse, score shows +4 (1+3) |
| Complete miss | Game over overlay appears with final score |
| Play Again | Stack resets, score resets, high score preserved |
| High score | Persists after closing and reopening the app |

---

## Variation Note: Tap-to-Drop Mechanic

If you want the block to only fall after the player taps (not auto-fall), make these changes in `useTowerGame.ts`:

1. Change initial phase to `'idle'` instead of auto-transitioning to `'dropping'`.
2. In `onTap`, if `phase === 'idle'`, set `phase = 'dropping'`.
3. Remove the `useEffect` that auto-transitions from `'idle'` to `'dropping'`.
4. The `useFrameCallback` only moves the block when `phase === 'dropping'`.

The current design auto-drops which is the classic Stack game feel. Tap-to-drop gives more deliberate control.

---

## Self-Review Checklist

- [x] **Sway system** (Task 6, difficulty.ts) — amplitude + period curves, tower sway at 30% fraction, spring damping
- [x] **Perfect placement** (Task 3 `computeOverlap`, Task 6 `handleLand`) — ≥90% overlap → burst + haptic + +3 bonus
- [x] **StarPop sparkle** (Tasks 5, 8, 9) — particle pool, per-particle `t` values, Skia star paths, color cycling
- [x] **Score system** (Task 4) — +1 per land, +3 bonus perfect, Zustand store
- [x] **High score persistence** (Task 4) — AsyncStorage, loaded on start, saved when beaten
- [x] **HUD** (Task 10) — score top-left, best top-right, game-over overlay
- [x] **Complete miss → game over** (Task 3 `landBlock`) — center outside top block bounds
- [x] **Fall speed progression** (Task 2 `getFallSpeed`) — +0.3/5 blocks, capped at 12
- [x] **8 PNG assets** (Task 7) — cycle via `imageIndex % 8`
- [x] **Portrait lock** — already in app.json
- [x] **AsyncStorage error handling** (Task 4 `storage.ts`) — silent fallback, no crash
- [x] **Particle pool exhaustion** (Task 5 `ParticlePool.activate`) — returns fewer indices, no crash
