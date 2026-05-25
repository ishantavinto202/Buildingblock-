import React from 'react';
import { Group, Image, useImage } from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';
import { CLOUD_IMAGE_SOURCES } from '../../game/background/cloudAssets';
import { CloudInstance, computeCloudX } from '../../game/background/cloudField';

interface CloudSpriteProps {
  cloud: CloudInstance;
  cloudTimeMs: SharedValue<number>;
  image: ReturnType<typeof useImage>;
}

function CloudSprite({ cloud, cloudTimeMs, image }: CloudSpriteProps) {
  const transform = useDerivedValue(() => {
    const x = computeCloudX(cloud, cloudTimeMs.value);
    return [
      { translateX: x },
      { translateY: cloud.baseY },
    ];
  });

  if (!image) return null;

  return (
    <Group transform={transform}>
      <Image
        image={image}
        x={0}
        y={0}
        width={cloud.width}
        height={cloud.height}
        fit="fill"
      />
    </Group>
  );
}

interface CloudLayerProps {
  clouds: CloudInstance[];
  cloudTimeMs: SharedValue<number>;
}

export function CloudLayer({ clouds, cloudTimeMs }: CloudLayerProps) {
  const img0 = useImage(CLOUD_IMAGE_SOURCES[0]);
  const img1 = useImage(CLOUD_IMAGE_SOURCES[1]);
  const img2 = useImage(CLOUD_IMAGE_SOURCES[2]);
  const img3 = useImage(CLOUD_IMAGE_SOURCES[3]);
  const img4 = useImage(CLOUD_IMAGE_SOURCES[4]);
  const images = [img0, img1, img2, img3, img4];

  return (
    <>
      {clouds.map((cloud) => {
        const img = images[cloud.assetIndex];
        if (!img) return null;
        return (
          <CloudSprite
            key={cloud.id}
            cloud={cloud}
            cloudTimeMs={cloudTimeMs}
            image={img}
          />
        );
      })}
    </>
  );
}
