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
  elementDisplayStyles = {}
}: SlideRendererProps) {
  const backgroundImageUrl = slide.backgroundImage ? resourceMap[slide.backgroundImage] : null
  const scaledWidth = slide.width * scale
  const scaledHeight = slide.height * scale

  return (
    <div
      style={{
        position: 'relative',
        width: scaledWidth,
        height: scaledHeight,
        overflow: 'hidden',
        transformOrigin: 'top left'
      }}
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
        {slide.elements.map(element => (
          <div
            key={element.id}
            data-slide-element='true'
            style={elementDisplayStyles[element.id]}
          >
            <ElementRenderer
              element={element}
              scale={1}
              resourceMap={resourceMap}
              slideIndex={slideIndex}
              currentIndex={currentIndex}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
