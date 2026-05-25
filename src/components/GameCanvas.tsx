import React, { useMemo } from 'react';
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
import { getBaseDrawLayout } from '../game/basePlatform';
import { getBlockGameplaySize } from '../game/blockCatalog';
import { BLOCK_IMAGE_SOURCES } from '../game/blockImages';
import { GameState } from '../game/types';
import { ParticlePool } from '../effects/ParticlePool';
import { PARTICLE_POOL_SIZE, PARTICLE_DURATION_MS } from '../game/constants';

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
  tipBlockCx: SharedValue<number>;
  tipBlockY: SharedValue<number>;
  tipBlockAngle: SharedValue<number>;
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
  tipBlockCx,
  tipBlockY,
  tipBlockAngle,
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
  const img0 = useImage(BLOCK_IMAGE_SOURCES[0]);
  const img1 = useImage(BLOCK_IMAGE_SOURCES[1]);
  const img2 = useImage(BLOCK_IMAGE_SOURCES[2]);
  const img3 = useImage(BLOCK_IMAGE_SOURCES[3]);
  const img4 = useImage(BLOCK_IMAGE_SOURCES[4]);
  const img5 = useImage(BLOCK_IMAGE_SOURCES[5]);
  const img6 = useImage(BLOCK_IMAGE_SOURCES[6]);
  const img7 = useImage(BLOCK_IMAGE_SOURCES[7]);
  const images = [img0, img1, img2, img3, img4, img5, img6, img7];
  const baseImg = useImage(require('../../assets/images/BASE.png'));

  const baseLayout = useMemo(
    () => getBaseDrawLayout(width, height),
    [width, height],
  );

  const fallingIndex = gameState.nextImageIndex;
  const fallingSize = useMemo(() => getBlockGameplaySize(fallingIndex), [fallingIndex]);
  const tipSize = fallingSize;

  const cameraTransform = useDerivedValue(() => [
    { translateX: cameraShakeX.value },
    { translateY: cameraOffsetY.value + cameraShakeY.value },
  ]);

  const fallingHalfW = fallingSize.w / 2;
  const fallingTransform = useDerivedValue(() => [
    { translateX: swayAnchorCx.value + swayOffset.value - fallingHalfW },
    { translateY: fallY.value },
  ]);

  const tipHalfW = tipSize.w / 2;
  const tipHalfH = tipSize.h / 2;
  const tipTransform = useDerivedValue(() => {
    const cx = tipBlockCx.value;
    const cy = tipBlockY.value;
    const pivotY = cy + tipHalfH;
    return [
      { translateX: cx },
      { translateY: pivotY },
      { rotate: tipBlockAngle.value },
      { translateX: -tipHalfW },
      { translateY: -tipHalfH },
    ];
  });

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

  const fallingImg = images[fallingIndex];

  const particleSnapshots = Array.from({ length: PARTICLE_POOL_SIZE }, (_, i) => particlePool.get(i));

  return (
    <Canvas style={{ width, height }} pointerEvents="none">
      <Fill color="#1a1a2e" />

      <Group transform={cameraTransform}>
        {baseImg && (
          <Image
            image={baseImg}
            x={baseLayout.x}
            y={baseLayout.y}
            width={baseLayout.w}
            height={baseLayout.h}
            fit="fill"
          />
        )}

        <Group transform={towerTransform}>
          {gameState.stack.map((block, i) => {
            const img = images[block.imageIndex];
            if (!img) return null;
            const { w, h } = getBlockGameplaySize(block.imageIndex);
            return (
              <Image
                key={i}
                image={img}
                x={block.cx - w / 2}
                y={block.y}
                width={w}
                height={h}
                fit="fill"
              />
            );
          })}
        </Group>

        {(gameState.phase === 'idle' || gameState.phase === 'dropping') && fallingImg && (
          <Group transform={fallingTransform}>
            <Image
              image={fallingImg}
              x={0}
              y={0}
              width={fallingSize.w}
              height={fallingSize.h}
              fit="fill"
            />
          </Group>
        )}

        {gameState.phase === 'tipping' && fallingImg && (
          <Group transform={tipTransform}>
            <Image
              image={fallingImg}
              x={0}
              y={0}
              width={tipSize.w}
              height={tipSize.h}
              fit="fill"
            />
          </Group>
        )}

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
