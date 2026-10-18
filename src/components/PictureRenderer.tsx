import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import type { PictureElement } from '../pictures'
import { ProgressiveImage } from './ProgressiveImage'

interface PictureRendererProps {
  element: PictureElement
  scale: number
  resourceMap: Record<string, string> // sourceId -> blob URL
}

function resolveCssFilter(bright = 0, contrast = 0, saturation = 0): string | undefined {
  const filters: string[] = []
  if (bright !== 0) {
    const b = bright > 1 || bright < -1 ? 1 + bright / 100 : 1 + bright
    filters.push(`brightness(${Math.max(0, b).toFixed(2)})`)
  }
  if (contrast !== 0) {
    const c = contrast > 1 || contrast < -1 ? 1 + contrast / 100 : 1 + contrast
    filters.push(`contrast(${Math.max(0, c).toFixed(2)})`)
  }
  if (saturation !== 0) {
    const s = saturation > 1 || saturation < -1 ? 1 + saturation / 100 : 1 + saturation
    filters.push(`saturate(${Math.max(0, s).toFixed(2)})`)
  }
  return filters.length > 0 ? filters.join(' ') : undefined
}

function resolveRahmenStyle(
  rahmenType?: string | number,
  rahmenThickness = 0,
  scale = 1
): CSSProperties {
  if (!rahmenType) return {}
  const norm = String(rahmenType).trim().toLowerCase()
  const thickness = Math.max(1, (rahmenThickness || 4) * scale)

  switch (norm) {
    case '1':
    case 'rectframe':
    case '100':
    case 'normalframe':
      return {
        border: `${thickness}px solid #ffffff`,
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.22)',
        boxSizing: 'border-box'
      }
    case '2':
    case 'roundrectframe':
    case 'roundrect':
      return {
        borderRadius: `${14 * scale}px`,
        border: `${thickness}px solid #ffffff`,
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.18)',
        boxSizing: 'border-box'
      }
    case '3':
    case 'ellipseframe':
    case 'ellipse':
      return {
        borderRadius: '50%',
        border: `${thickness}px solid #ffffff`,
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.18)',
        boxSizing: 'border-box'
      }
    case '6':
    case 'stampphotoframe':
      return {
        border: `${thickness * 1.5}px dashed #ffffff`,
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.25)',
        outline: `${thickness * 0.5}px solid #cbd5e1`,
        boxSizing: 'border-box'
      }
    case '7':
    case 'flowerphotoframe':
      return {
        borderRadius: `${18 * scale}px`,
        border: `${thickness * 1.5}px double #f472b6`,
        boxSizing: 'border-box'
      }
    case '101':
    case 'dotdashframe':
      return {
        border: `${thickness}px dashed #3b82f6`,
        boxSizing: 'border-box'
      }
    default:
      return {}
  }
}

/**
 * 图片渲染器 (带 HLSL 滤镜映射、异形裁剪、相框边框与矩阵变换)
 */
export function PictureRenderer({ element, scale, resourceMap }: PictureRendererProps) {
  const {
    x,
    y,
    width,
    height,
    sourceId,
    alpha = 1,
    rotation = 0,
    bright = 0,
    contrast = 0,
    saturation = 0,
    clippingShape,
    pictureRahmenType,
    rahmenThickness = 0,
    displayRegion,
    pictureSize
  } = element
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  useEffect(() => {
    const url = resourceMap[sourceId]
    setImageUrl(url || null)
  }, [sourceId, resourceMap])

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
          color: '#718096'
        }}
      >
        图片
      </div>
    )
  }

  const cssFilter = resolveCssFilter(bright, contrast, saturation)
  const rahmenStyle = resolveRahmenStyle(pictureRahmenType, rahmenThickness, scale)
  const isEllipseClip = (clippingShape || '').trim().toLowerCase() === 'ellipse'

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
          clipPath: isEllipseClip ? 'ellipse(50% 50% at 50% 50%)' : undefined,
          pointerEvents: 'none',
          ...rahmenStyle
        }}
      >
        <ProgressiveImage
          src={imageUrl}
          alt=''
          style={{
            position: 'absolute',
            left: -displayRegion.x * scaleX * scale,
            top: -displayRegion.y * scaleY * scale,
            width: renderedImageWidth * scale,
            height: renderedImageHeight * scale,
            maxWidth: 'none',
            maxHeight: 'none',
            filter: cssFilter,
            pointerEvents: 'none'
          }}
        />
      </div>
    )
  }

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
        clipPath: isEllipseClip ? 'ellipse(50% 50% at 50% 50%)' : undefined,
        overflow: 'hidden',
        pointerEvents: 'none',
        ...rahmenStyle
      }}
    >
      <ProgressiveImage
        src={imageUrl}
        alt=''
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'fill',
          filter: cssFilter,
          pointerEvents: 'none'
        }}
      />
    </div>
  )
}
