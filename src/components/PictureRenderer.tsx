import { useState, useEffect } from 'react';
import type { PictureElement } from '../pictures';

interface PictureRendererProps {
  element: PictureElement;
  scale: number;
  resourceMap: Record<string, string>; // sourceId -> blob URL
}

/**
 * 图片渲染器
 */
export function PictureRenderer({ element, scale, resourceMap }: PictureRendererProps) {
  const { x, y, width, height, sourceId, alpha, rotation, displayRegion, pictureSize } = element;
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = resourceMap[sourceId];
    if (url) {
      setImageUrl(url);
    }
  }, [sourceId, resourceMap]);

  if (!imageUrl) {
    return (
      <div
        style={{
          position: 'absolute',
          left: x * scale,
          top: y * scale,
          width: width * scale,
          height: height * scale,
          backgroundColor: '#e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12 * scale,
          color: '#718096',
        }}
      >
        图片
      </div>
    );
  }

  const hasCropRegion = !!(
    displayRegion &&
    pictureSize &&
    pictureSize.width > 0 &&
    pictureSize.height > 0 &&
    displayRegion.width > 0 &&
    displayRegion.height > 0
  )

  if (hasCropRegion && displayRegion && pictureSize) {
    const scaleX = width / displayRegion.width
    const scaleY = height / displayRegion.height
    const renderedImageWidth = pictureSize.width * scaleX
    const renderedImageHeight = pictureSize.height * scaleY

    return (
      <div
        style={{
          position: 'absolute',
          left: x * scale,
          top: y * scale,
          width: width * scale,
          height: height * scale,
          opacity: alpha,
          transform: rotation ? `rotate(${rotation}deg)` : undefined,
          transformOrigin: 'center center',
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
      >
        <img
          src={imageUrl}
          alt=""
          style={{
            position: 'absolute',
            left: -displayRegion.x * scaleX * scale,
            top: -displayRegion.y * scaleY * scale,
            width: renderedImageWidth * scale,
            height: renderedImageHeight * scale,
            maxWidth: 'none',
            maxHeight: 'none',
            pointerEvents: 'none',
          }}
        />
      </div>
    )
  }

  return (
    <img
      src={imageUrl}
      alt=""
      style={{
        position: 'absolute',
        left: x * scale,
        top: y * scale,
        width: width * scale,
        height: height * scale,
        opacity: alpha,
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
        transformOrigin: 'center center',
        objectFit: 'fill',
        pointerEvents: 'none',
      }}
    />
  );
}
