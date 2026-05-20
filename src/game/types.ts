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
