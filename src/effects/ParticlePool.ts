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
   * Activates up to `count` particles starting from `cx, cy`.
   * Returns the indices of activated slots so the caller can drive their animations.
   * If fewer than `count` slots are available, activates as many as possible (never crashes).
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
