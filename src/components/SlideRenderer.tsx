import type { CSSProperties } from 'react'
import type { SlideData } from '../parser'
import { ElementRenderer } from './slide-renderer/ElementRenderer'

interface SlideRendererProps {
  slide: SlideData
  scale?: number
  resourceMap?: Record<string, string>
  slideIndex?: number
  currentIndex?: number
  elementDisplayStyles?: Record<string, CSSProperties>
  elementRenderStates?: Record<string, boolean>
  onElementClick?: (elementId: string) => boolean
}

/**
 * 幻灯片渲染器 - 使用 DOM 实现矢量渲染
 */
export function SlideRenderer({
  slide,
  scale = 1,
  resourceMap = {},
  slideIndex = 0,
  currentIndex = 0,
  elementDisplayStyles = {},
  elementRenderStates = {},
  onElementClick
}: SlideRendererProps) {
  const backgroundImageUrl = slide.backgroundImage ? resourceMap[slide.backgroundImage] : null
  const scaledWidth = slide.width * scale
  const scaledHeight = slide.height * scale

  const resolvePointElementId = (slideX: number, slideY: number): string | null => {
    for (let index = slide.elements.length - 1; index >= 0; index -= 1) {
      const element = slide.elements[index]
      if (elementRenderStates[element.id] === false) continue
      const styleOpacity = elementDisplayStyles[element.id]?.opacity
      if (typeof styleOpacity === 'number' && styleOpacity <= 0) continue
      if (!('x' in element) || !('y' in element) || !('width' in element) || !('height' in element)) continue
      const x = typeof element.x === 'number' ? element.x : NaN
      const y = typeof element.y === 'number' ? element.y : NaN
      const width = typeof element.width === 'number' ? element.width : NaN
      const height = typeof element.height === 'number' ? element.height : NaN
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) continue
      if (slideX >= x && slideX <= x + width && slideY >= y && slideY <= y + height) {
        return element.id
      }
    }
    return null
  }

  const handleSlideClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!onElementClick) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    const slideX = (event.clientX - rect.left) / scale
    const slideY = (event.clientY - rect.top) / scale
    const clickedElementId = resolvePointElementId(slideX, slideY)
    if (!clickedElementId) return
    const isConsumed = onElementClick(clickedElementId)
    if (!isConsumed) return
    event.stopPropagation()
    event.preventDefault()
  }

  return (
    <div
      style={{
        position: 'relative',
        width: scaledWidth,
        height: scaledHeight,
        overflow: 'hidden',
        transformOrigin: 'top left'
      }}
      onClickCapture={handleSlideClickCapture}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: slide.width,
          height: slide.height,
          backgroundColor: slide.backgroundColor,
          backgroundImage: backgroundImageUrl ? `url(${backgroundImageUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          transform: `scale(${scale})`,
          transformOrigin: 'top left'
        }}
      >
        {slide.elements.map(element => {
          if (elementRenderStates[element.id] === false) return null
          return (
            <div
              key={element.id}
              data-slide-element='true'
              style={elementDisplayStyles[element.id]}
              onClick={() => onElementClick?.(element.id)}
            >
              <ElementRenderer
                element={element}
                scale={1}
                resourceMap={resourceMap}
                slideIndex={slideIndex}
                currentIndex={currentIndex}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
