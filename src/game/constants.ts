/** Logical width of every block in canvas pixels */
export const BLOCK_W = 80;
/** Logical height of every block in canvas pixels */
export const BLOCK_H = 56;
/** Gap in world px between tower top and the next block spawn (top edge) */
export const SPAWN_ABOVE_TOWER_PX = 28;
/** @deprecated Screen-fixed spawn — use computeSpawnWorldY(towerTop) instead */
export const SPAWN_SCREEN_Y = 72;
/** @deprecated Use SPAWN_ABOVE_TOWER_PX — kept for docs */
export const SPAWN_Y = SPAWN_SCREEN_Y;
/** Screen fraction where the tower top should anchor when scrolling (0–1 from top) */
export const CAMERA_ANCHOR_FRACTION = 0.35;
/** Number of distinct block images */
export const BLOCK_IMAGE_COUNT = 8;

/** Fraction of BLOCK_W that must overlap for a "perfect" placement (0–1) */
export const PERFECT_OVERLAP_RATIO = 0.9;

/** Minimum supported overlap to stack; below this the block tips off (0–1) */
export const MIN_STACK_OVERLAP_RATIO = 0.42;

/** Tipping physics (per frame at ~60fps, scaled by dt in worklet) */
export const TIP_GRAVITY = 0.38;
export const TIP_INITIAL_ANG_VEL = 0.09;
export const TIP_INITIAL_DROP_VEL = 0.15;
export const TIP_INITIAL_SLIDE_VEL = 0.55;
export const TIP_TORQUE_ACCEL = 0.0035;
export const TIP_FAIL_ANGLE_RAD = 1.05;

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
export const PARTICLE_COLORS = ['#FFD700', '#FFFFFF', '#FFF3A3', '#FFE566'] as const;

/** Tower rotation scales with falling-block difficulty by this fraction */
export const TOWER_SWAY_FRACTION = 0.35;

/** Max tower lean (degrees) at full sway reach — applied at base pivot */
export const TOWER_SWAY_MAX_DEG = 3.2;

/** Stack height before the tower starts leaning */
export const TOWER_MIN_STACK_HEIGHT_FOR_SWAY = 5;

/** Brief camera nudge on sloppy landings only (not continuous sway) */
export const CAMERA_SHAKE_MAX_X_PX = 4;
export const CAMERA_SHAKE_MAX_Y_PX = 2;
export const CAMERA_SHAKE_NEAR_COLLAPSE_HEIGHT = 14;
export const CAMERA_SHAKE_NEAR_COLLAPSE_MULT = 1.35;

/** Points for a plain landing */
export const POINTS_LAND = 1;
/** Bonus points for a perfect landing (in addition to POINTS_LAND) */
export const POINTS_PERFECT_BONUS = 3;

/** Per-frame lerp at 60fps for vertical camera follow (lower = smoother) */
export const CAMERA_SMOOTH_FACTOR = 0.09;
/** Duration when resetting camera after game restart */
export const CAMERA_RESET_MS = 450;

/** Minimum time (ms) the moving block must sway before the player can drop */
export const MIN_DROP_DELAY_MS = 320;

/** Extra fall time after a miss before game over (ms) */
export const MISS_FALL_GAME_OVER_DELAY_MS = 750;

/** >1 = faster horizontal ping-pong (same bounds and difficulty curve) */
export const SWAY_HORIZONTAL_SPEED_MULT = 1.28;
