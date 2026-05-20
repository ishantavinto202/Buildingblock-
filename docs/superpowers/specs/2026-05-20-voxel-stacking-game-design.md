# Voxel Stacking Game — Design Spec

**Date:** 2026-05-20  
**Platform:** iOS (primary), Expo / React Native  
**Rendering:** Full Skia Canvas (`@shopify/react-native-skia`)  
**State:** Zustand + Reanimated shared values  

---

## Overview

A 2D side-view building stacking game. The player taps to drop a swaying block onto a growing tower. The tower sways increasingly as it grows taller. Perfect placements trigger a sparkle burst and bonus points. A complete miss (block falls off entirely) ends the game.

---

## Architecture

### File Structure

```
src/
  game/
    types.ts          — Block, GameState, Particle, SwayConfig interfaces
    constants.ts      — block dimensions, fall speed, sway table, particle config
    difficulty.ts     — sway amplitude/frequency curves keyed to stack height
    slice.ts          — pure reducer: DROP, LAND, GAME_OVER, RESET actions
  store/
    scoreStore.ts     — Zustand store: score, highScore; persists via AsyncStorage
  hooks/
    useTowerGame.ts   — main game loop: sway clock, drop physics, collision, events
  components/
    TowerGameScreen.tsx  — root component; touch handler; renders Canvas + HUD
    GameCanvas.tsx       — Skia <Canvas>: draws tower, falling block, particles
    GameHUD.tsx          — score/highScore overlay (RN Views above the Canvas)
    StarPop.tsx          — sparkle burst logic; drives particle pool via Reanimated
  effects/
    ParticlePool.ts   — fixed-size pre-allocated pool (avoids GC mid-game)
  utils/
    color.ts          — block tint/color helpers
    storage.ts        — AsyncStorage typed read/write wrappers
```

### Data Flow

```
Touch event
  → TowerGameScreen (onPress)
    → useTowerGame.drop()
      → slice reducer (pure TS, no RN deps)
        → GameState update
          → GameCanvas re-renders via Skia shared values
          → GameHUD re-renders via Zustand score store
```

All animation state (`swayOffset`, `fallY`, `towerSwayOffset`, `particles`) lives in Reanimated `useSharedValue`s inside `useTowerGame`. This keeps animations on the UI thread and avoids bridge round-trips.

`slice.ts` is pure TypeScript with no Skia/RN imports — fully unit-testable without a device.

---

## Section 1: Block Assets

- 8 PNG building block images, stored in `assets/images/blocks/`
- Loaded as Skia `Image` objects via `useImage()` at startup
- Blocks cycle through the 8 images as the tower grows (index = stackHeight % 8)
- Each block is drawn at a fixed logical size: **80px wide × 60px tall**

---

## Section 2: Game Mechanics

### Spawning

A new block spawns horizontally centered at the top of the screen (`y = SPAWN_Y`). It immediately begins swaying left/right.

### Sway (Falling Block)

Driven by `withRepeat(withSequence(withTiming(-amplitude), withTiming(amplitude)))` in Reanimated. Parameters come from `difficulty.ts` keyed to `stackHeight`:

| Stack Height | Amplitude (px) | Period (ms) |
|---|---|---|
| 1–4          | 0              | —           |
| 5–8          | 8              | 2000        |
| ~12          | 20             | 1600        |
| ~16          | 40             | 1300        |
| ~20+         | 65             | 1100        |

Values between breakpoints are linearly interpolated.

### Tower Sway

The entire settled tower sways as a unit. Amplitude = 30% of the falling block's current amplitude. Uses `withSpring` with `{ damping: 8, stiffness: 60 }` — low damping makes it feel organic and top-heavy. Tower sway is phase-shifted 180° from the falling block (leans opposite direction).

No tower sway at stack heights 1–4.

### Drop & Fall

- Player taps anywhere to drop.
- Block falls straight down (no horizontal drift after tap).
- Fall speed starts at **6 px/frame**, increases by **0.3 px/frame** per 5 blocks stacked, capped at **12 px/frame**.
- Constant speed (not gravity-accelerated) for predictable, skill-based gameplay.

### Landing & Collision

On each frame while a block is falling, check if `blockBottom >= topOfStack`:
- **Complete miss** (the horizontal center of the falling block, at the moment it reaches stack height, falls outside the [left edge, right edge] of the top-of-stack block): transition to GAME_OVER state.
- **Landing** (any overlap): snap block to top of stack, update `GameState`, trigger next spawn.

### Perfect Placement

Condition: horizontal overlap between falling block and top-of-stack block ≥ 90%.

On perfect placement:
1. Fire `StarPop` effect at block center.
2. Trigger `expo-haptics` `ImpactFeedbackStyle.Medium`.
3. Award `+3` bonus points (shown as a brief floating `+3` text above the burst).

---

## Section 3: StarPop / Sparkle Effect

### Particle System

- `ParticlePool` pre-allocates **20 particle slots** at startup (reused, not recreated).
- On perfect landing, activate 12–16 particles from the pool.

### Each Particle

- Shape: small 4-pointed star path (drawn with Skia `Path`)
- Shoots outward from the block center at a random angle and speed (speed range: 60–140 px/s)
- Animation driven by a single `t` value (0 → 1) over **600ms** using `withTiming`
- Position: `center + direction * speed * t`
- Opacity: `1 - t` (fades out)
- Scale: `1.2 - (1.2 * t)` (shrinks to zero)
- Colors cycle: gold (`#FFD700`) → white (`#FFFFFF`) → light yellow (`#FFF3A3`)

### Floating Score Text

A `+3` text animates upward ~40px and fades out over 800ms via Reanimated `useSharedValue`. Rendered as a Skia `Text` element above the burst.

---

## Section 4: Score & Persistence

### Scoring

- Successful landing: `+1` point
- Perfect placement bonus: `+3` additional points
- Score resets to 0 on game over / restart

### High Score

- Zustand store (`scoreStore.ts`) holds `score` and `highScore`.
- On each score update, if `score > highScore`, update and persist immediately.
- Persistence via `AsyncStorage` using typed wrappers in `storage.ts`.
- High score is loaded from AsyncStorage on app start (async, non-blocking).

### HUD Layout

```
┌─────────────────────────────────┐
│  [SCORE: 12]          [BEST: 24]│  ← GameHUD (RN Views, above Canvas)
│                                 │
│         [falling block]         │
│                                 │
│      [tower of blocks]          │
│                                 │
└─────────────────────────────────┘
```

Score is centered-top (large, white bold). High score is top-right (smaller, muted).

### Game Over Screen

An overlay rendered inside `TowerGameScreen` on `gameState === 'GAME_OVER'`:
- Semi-transparent dark background
- Final score (large)
- High score (below, with "NEW BEST!" label if beaten)
- "Play Again" button → dispatches RESET action

---

## Section 5: Error Handling & Edge Cases

- **AsyncStorage failure on load:** silently default `highScore` to 0; log warning.
- **AsyncStorage failure on save:** silently swallow; do not crash the game.
- **Particle pool exhausted:** skip spawning additional particles for that burst (never block gameplay).
- **Screen resize / orientation:** game is portrait-locked via Expo config.
- **First launch:** high score label displays "BEST: --" until the first game is completed and a real score is saved.

---

## Out of Scope (YAGNI)

- Sound effects (placeholder: haptics only)
- Multiple game modes
- Online leaderboards
- Animations for the game-over modal entrance
- Android / Web support (iOS first)
