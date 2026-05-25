import { Fill, Image, Rect, useImage } from '@shopify/react-native-skia';
import React, { useMemo } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import { SKY_BACKGROUND_COLOR } from '../../game/background';
import type { CloudInstance } from '../../game/background/cloudField';
import { getSkyWorldUnderlayLayout } from '../../game/background/worldExtent';
import { CloudLayer } from './CloudLayer';

const BG_IMAGE_SOURCE = require('../../../assets/images/BG.png');

/** Screen-fixed overflow fill — matches world sky so edges never flash black */
export function SkyScreenFill() {
  return <Fill color={SKY_BACKGROUND_COLOR} />;
}

interface WorldBackgroundStackProps {
  width: number;
  height: number;
  clouds: CloudInstance[];
  cloudTimeMs: SharedValue<number>;
}

/**
 * Camera/world background stack (single coordinate system with blocks + BASE).
 * Bottom: extended #4bbbfb for areas above BG.png bounds.
 * Top: BG.png — active ground reference for falling/stacked blocks.
 */
export function WorldBackgroundStack({ width, height, clouds, cloudTimeMs }: WorldBackgroundStackProps) {
  const bgImg = useImage(BG_IMAGE_SOURCE);
  const skyUnderlay = useMemo(
    () => getSkyWorldUnderlayLayout(width, height),
    [width, height],
  );

  return (
    <>
      <Rect
        x={skyUnderlay.x}
        y={skyUnderlay.y}
        width={skyUnderlay.w}
        height={skyUnderlay.h}
        color={SKY_BACKGROUND_COLOR}
      />
      <CloudLayer clouds={clouds} cloudTimeMs={cloudTimeMs} />
      {bgImg && (
        <Image
          image={bgImg}
          x={0}
          y={0}
          width={width}
          height={height}
          fit="cover"
        />
      )}
    </>
  );
}
