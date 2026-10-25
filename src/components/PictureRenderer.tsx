import { useId } from 'react'
import type { CSSProperties } from 'react'
import type { PictureElement } from '../enbx/pictures'
import { pictureGeometry } from '../rendering/picture-geometry'
import { ProgressiveImage } from './ProgressiveImage'
import { PictureFrame } from './PictureFrame'
import { PictureEffects } from './PictureEffects'
import { PictureGlow } from './PictureGlow'

interface PictureRendererProps {
  element: PictureElement
  scale: number
  resourceMap: Record<string, string>
}

function resolveCssFilter(bright = 0, contrast = 0, saturation = 0) {
  const filters: string[] = []
  for (const [name, value] of [['brightness', bright], ['contrast', contrast], ['saturate', saturation]] as const) {
    if (value) filters.push(`${name}(${Math.max(0, 1 + (Math.abs(value) > 1 ? value / 100 : value)).toFixed(2)})`)
  }
  return filters.length ? filters.join(' ') : undefined
}

/** 主图、相框与特效共用原始课件坐标，最外层统一缩放。 */
export function PictureRenderer({ element, scale, resourceMap }: PictureRendererProps) {
  const clipId = `picture-clip-${useId().replace(/:/g, '')}`
  const { x, y, width, height, sourceId, alpha = 1, rotation = 0, displayRegion, pictureSize } = element
  const imageUrl = resourceMap[sourceId]
  const { shape, clip } = pictureGeometry(element)
  const hasCrop = displayRegion && pictureSize && pictureSize.width > 0 && pictureSize.height > 0
    && displayRegion.width > 0 && displayRegion.height > 0
  const imageStyle: CSSProperties = hasCrop ? {
    position: 'absolute', left: -displayRegion.x * width / displayRegion.width,
    top: -displayRegion.y * height / displayRegion.height,
    width: pictureSize.width * width / displayRegion.width,
    height: pictureSize.height * height / displayRegion.height, maxWidth: 'none', maxHeight: 'none'
  } : { display: 'block', width: '100%', height: '100%', objectFit: 'fill' }
  imageStyle.filter = resolveCssFilter(element.bright, element.contrast, element.saturation)
  imageStyle.pointerEvents = 'none'
  const image = <>
    <div data-picture-image='' style={{ position: 'absolute', inset: 0, overflow: 'hidden',
      clipPath: shape ? `url(#${clipId})` : undefined }}>
      {imageUrl ? <ProgressiveImage src={imageUrl} alt='' style={imageStyle} />
        : <div style={{ width: '100%', height: '100%', background: '#e2e8f0', color: '#718096',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>图片</div>}
    </div>
  </>
  const content = <PictureGlow element={element}>
    {image}<PictureFrame element={element} image={image} />
  </PictureGlow>
  return <div data-picture={element.id} style={{ position: 'absolute', left: x * scale, top: y * scale,
    width, height, transform: `scale(${scale})`, transformOrigin: '0 0', pointerEvents: 'none' }}>
    {shape && <svg width='0' height='0' style={{ position: 'absolute' }} aria-hidden='true'>
      <defs><clipPath id={clipId}><path d={clip} /></clipPath></defs>
    </svg>}
    <PictureEffects element={element} content={content} />
    <div data-picture-main='' style={{ position: 'absolute', inset: 0, opacity: alpha,
      transform: rotation ? `rotate(${rotation}deg)` : undefined, transformOrigin: 'center center' }}>{content}</div>
  </div>
}
