/** iPhone 16 reference — scales spawn band and cloud sizes to the canvas */
export const DEVICE_REF_W = 1179;
export const DEVICE_REF_H = 2556;

/**
 * Bottom of the cloud spawn band (world Y, reference px).
 * Lower than the old ~1500 cap — closer to the visible gameplay / sky line.
 */
export const CLOUD_BAND_MAX_WORLD_Y = 2280;

export const CLOUD_COUNT = 5;

/** Vertical spacing between cloud rows (reference px, scaled at runtime) */
export const CLOUD_ROW_SPACING_REF = 200;

/** Minimum center-to-center vertical gap as a fraction of row spacing (prevents overlap) */
export const CLOUD_MIN_ROW_SPACING_FRAC = 0.95;

/** Max clouds kept in the active viewport + lookahead band */
export const CLOUD_MAX_ACTIVE = 14;

/** Extra sky above the viewport top to keep filled (fraction of canvas height) */
export const CLOUD_SPAWN_BUFFER_ABOVE_VIEW_MULT = 0.25;

/** How far above the viewport top to pre-spawn (fraction of canvas height) */
export const CLOUD_LOOKAHEAD_VIEWPORT_MULT = 0.85;

/** Cull clouds this far below the visible bottom */
export const CLOUD_CULL_BELOW_VIEW_MULT = 0.35;

/** Cull clouds this far above the pre-spawn ceiling */
export const CLOUD_CULL_ABOVE_VIEW_MULT = 2.5;

/** Linear drift speed (reference px / ms) — slow ambient pass */
export const CLOUD_TRAVEL_SPEED_REF_MIN = 0.014;
export const CLOUD_TRAVEL_SPEED_REF_MAX = 0.028;

/** Draw scale relative to reference width */
export const CLOUD_SCALE_MIN = 0.55;
export const CLOUD_SCALE_MAX = 1.05;

/** Re-run vertical spawn fill when camera scroll moves this many px */
export const CLOUD_SPAWN_SCROLL_STEP = 72;

/** How often to cull / recycle clouds that finished a crossing (ms) */
export const CLOUD_TICK_INTERVAL_MS = 120;
