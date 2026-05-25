import { useCallback, useEffect, useRef, useState } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import {
  runOnJS,
  useAnimatedReaction,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';
import { CLOUD_SPAWN_SCROLL_STEP, CLOUD_TICK_INTERVAL_MS } from '../game/background/cloudConstants';
import { CloudInstance, fillCloudBand, tickCloudField } from '../game/background/cloudField';

export interface UseCloudFieldResult {
  clouds: CloudInstance[];
  cloudTimeMs: SharedValue<number>;
}

export function useCloudField(
  canvasWidth: number,
  canvasHeight: number,
  cameraOffsetY: SharedValue<number>,
  isPaused: boolean,
  isActive: boolean,
): UseCloudFieldResult {
  const [clouds, setClouds] = useState<CloudInstance[]>([]);
  const cloudTimeMs = useSharedValue(0);
  const cloudsRef = useRef<CloudInstance[]>([]);
  const lastSpawnScrollRef = useRef<number | null>(null);
  const lastViewTopRef = useRef<number | null>(null);
  const tickAccumMs = useSharedValue(0);
  const isPausedShared = useSharedValue(isPaused ? 1 : 0);

  useEffect(() => {
    isPausedShared.value = isPaused ? 1 : 0;
  }, [isPaused, isPausedShared]);

  const applyClouds = useCallback((next: CloudInstance[]) => {
    cloudsRef.current = next;
    setClouds(next);
  }, []);

  const syncSpawns = useCallback(
    (scrollY: number) => {
      if (canvasWidth <= 0 || canvasHeight <= 0) return;
      const next = fillCloudBand(
        cloudsRef.current,
        scrollY,
        canvasWidth,
        canvasHeight,
        cloudTimeMs.value,
        lastViewTopRef.current,
      );
      applyClouds(next);
      lastSpawnScrollRef.current = scrollY;
      lastViewTopRef.current = -scrollY;
    },
    [canvasWidth, canvasHeight, cloudTimeMs, applyClouds],
  );

  const tickClouds = useCallback(() => {
    if (canvasWidth <= 0 || canvasHeight <= 0) return;
    const scrollY = cameraOffsetY.value;
    const next = tickCloudField(
      cloudsRef.current,
      scrollY,
      canvasWidth,
      canvasHeight,
      cloudTimeMs.value,
    );
    applyClouds(next);
    lastViewTopRef.current = -scrollY;
  }, [canvasWidth, canvasHeight, cameraOffsetY, cloudTimeMs, applyClouds]);

  useEffect(() => {
    if (!isActive) {
      lastViewTopRef.current = null;
      lastSpawnScrollRef.current = null;
      cloudsRef.current = [];
      setClouds([]);
      return;
    }
    if (canvasWidth <= 0 || canvasHeight <= 0) return;
    lastViewTopRef.current = null;
    syncSpawns(cameraOffsetY.value);
  }, [isActive, canvasWidth, canvasHeight, syncSpawns, cameraOffsetY]);

  const onSpawnScroll = useCallback(
    (scrollY: number) => {
      const last = lastSpawnScrollRef.current;
      if (last !== null && Math.abs(scrollY - last) < CLOUD_SPAWN_SCROLL_STEP) return;
      syncSpawns(scrollY);
    },
    [syncSpawns],
  );

  useAnimatedReaction(
    () => cameraOffsetY.value,
    (scrollY, prev) => {
      if (!isActive) return;
      if (prev === null || Math.abs(scrollY - prev) >= CLOUD_SPAWN_SCROLL_STEP) {
        runOnJS(onSpawnScroll)(scrollY);
      }
    },
    [isActive, onSpawnScroll],
  );

  useFrameCallback((frameInfo) => {
    'worklet';
    if (!isActive) return;
    if (isPausedShared.value === 1) return;

    const deltaMs = Math.min(frameInfo.timeSincePreviousFrame ?? 16.67, 50);
    cloudTimeMs.value += deltaMs;
    tickAccumMs.value += deltaMs;

    if (tickAccumMs.value >= CLOUD_TICK_INTERVAL_MS) {
      tickAccumMs.value = 0;
      runOnJS(tickClouds)();
    }
  });

  return { clouds, cloudTimeMs };
}
