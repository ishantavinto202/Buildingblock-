import React from 'react';
import {
  Canvas,
  Image,
  useImage,
  Group,
  Path,
  Skia,
  Fill,
} from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';
import { GameState } from '../game/types';
import { ParticlePool } from '../effects/ParticlePool';
import { BLOCK_W, BLOCK_H, PARTICLE_POOL_SIZE, PARTICLE_DURATION_MS } from '../game/constants';

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

function makeStarPath(r: number) {
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

export interface GameCanvasProps {
  width: number;
  height: number;
  gameState: GameState;
  swayOffset: SharedValue<number>;
  swayAnchorCx: SharedValue<number>;
  fallY: SharedValue<number>;
  towerSwayAngle: SharedValue<number>;
  towerPivotCx: SharedValue<number>;
  towerPivotY: SharedValue<number>;
  cameraOffsetY: SharedValue<number>;
  cameraShakeX: SharedValue<number>;
  cameraShakeY: SharedValue<number>;
  particleTs: SharedValue<number>[];
  particleActives: SharedValue<boolean>[];
  particlePool: ParticlePool;
}

// Particle rendering extracted to its own component to allow hooks at top level
interface ParticleItemProps {
  particleT: SharedValue<number>;
  particleActive: SharedValue<boolean>;
  startX: number;
  startY: number;
  angle: number;
  speed: number;
  color: string;
}

function ParticleItem({ particleT, particleActive, startX, startY, angle, speed, color }: ParticleItemProps) {
  const transform = useDerivedValue(() => {
    if (!particleActive.value) return [{ translateX: -9999 as number }, { translateY: -9999 as number }];
    const elapsed = particleT.value;
    const dist = speed * (elapsed * PARTICLE_DURATION_MS / 1000);
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    const scale = 1.2 - 1.2 * elapsed;
    return [
      { translateX: startX + dx },
      { translateY: startY + dy },
      { scale },
    ];
  }, [startX, startY, angle, speed]);

  const opacity = useDerivedValue(() =>
    particleActive.value ? Math.max(0, 1 - particleT.value) : 0
  , []);

  return (
    <Group transform={transform} opacity={opacity}>
      <Path path={STAR_PATH} color={color} />
    </Group>
  );
}

export function GameCanvas({
  width,
  height,
  gameState,
  swayOffset,
  swayAnchorCx,
  fallY,
  towerSwayAngle,
  towerPivotCx,
  towerPivotY,
  cameraOffsetY,
  cameraShakeX,
  cameraShakeY,
  particleTs,
  particleActives,
  particlePool,
}: GameCanvasProps) {
  // Load all 8 images at top level (hooks)
  const img0 = useImage(BLOCK_REQUIRES[0]);
  const img1 = useImage(BLOCK_REQUIRES[1]);
  const img2 = useImage(BLOCK_REQUIRES[2]);
  const img3 = useImage(BLOCK_REQUIRES[3]);
  const img4 = useImage(BLOCK_REQUIRES[4]);
  const img5 = useImage(BLOCK_REQUIRES[5]);
  const img6 = useImage(BLOCK_REQUIRES[6]);
  const img7 = useImage(BLOCK_REQUIRES[7]);
  const images = [img0, img1, img2, img3, img4, img5, img6, img7];

  /** Vertical scroll only + brief landing shake (no continuous camera sway). */
  const cameraTransform = useDerivedValue(() => [
    { translateX: cameraShakeX.value },
    { translateY: cameraOffsetY.value + cameraShakeY.value },
  ]);

  const fallingTransform = useDerivedValue(() => [
    { translateX: swayAnchorCx.value + swayOffset.value - BLOCK_W / 2 },
    { translateY: fallY.value },
  ]);

  /** Rotate the whole tower around the base block (bottom-center pivot). */
  const towerTransform = useDerivedValue(() => {
    const px = towerPivotCx.value;
    const py = towerPivotY.value;
    return [
      { translateX: px },
      { translateY: py },
      { rotate: towerSwayAngle.value },
      { translateX: -px },
      { translateY: -py },
    ];
  });

  const fallingImg = images[gameState.nextImageIndex];

  // Snapshot particle data for rendering (particles are JS objects, not shared values)
  const particleSnapshots = Array.from({ length: PARTICLE_POOL_SIZE }, (_, i) => particlePool.get(i));

  return (
    <Canvas style={{ width, height }} pointerEvents="none">
      <Fill color="#1a1a2e" />

      <Group transform={cameraTransform}>
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

        {/* Active block: sways at spawn, falls after tap */}
        {(gameState.phase === 'idle' || gameState.phase === 'dropping') && fallingImg && (
          <Group transform={fallingTransform}>
            <Image
              image={fallingImg}
              x={0}
              y={0}
              width={BLOCK_W}
              height={BLOCK_H}
              fit="fill"
            />
          </Group>
        )}

        {/* Particles — each gets its own component for hook compliance */}
        {particleSnapshots.map((p, idx) => (
          <ParticleItem
            key={idx}
            particleT={particleTs[idx]}
            particleActive={particleActives[idx]}
            startX={p.startX}
            startY={p.startY}
            angle={p.angle}
            speed={p.speed}
            color={p.color}
          />
        ))}
      </Group>
    </Canvas>
  );
}
