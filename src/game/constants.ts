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
export const PARTICLE_COLORS = ['#FFD700', '#FFFFFF', '#FFF3A3', '#FFE566'] as const;

/** Tower sway amplitude is this fraction of the falling block amplitude */
export const TOWER_SWAY_FRACTION = 0.3;

/** withSpring config used for tower sway */
export const TOWER_SPRING = { damping: 8, stiffness: 60 } as const;

/** Points for a plain landing */
export const POINTS_LAND = 1;
/** Bonus points for a perfect landing (in addition to POINTS_LAND) */
export const POINTS_PERFECT_BONUS = 3;
