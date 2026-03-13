import type { SlideElement, UnknownElement, TopicElement, CylinderElement, ConeElement, CubeElement, GeometryElement, MathFormulaElement } from '../../parser'
import type { ShapeElement } from '../../shapes'
import type { PictureElement } from '../../pictures'
import type { VideoElement } from '../../videos'
import type { TableElement } from '../../types'
import { ShapeRenderer } from '../ShapeRenderer'
import { PictureRenderer } from '../PictureRenderer'
import { VideoRenderer } from '../VideoRenderer'
import { TableRenderer } from '../TableRenderer'
import { TopicRenderer } from '../TopicRenderer'
import { CylinderRenderer } from '../CylinderRenderer'
import { ConeRenderer } from '../ConeRenderer'
import { CubeRenderer } from '../CubeRenderer'
import { GeometryRenderer } from '../GeometryRenderer'
import { MathFormulaRenderer } from '../MathFormulaRenderer'
import { TextElementRenderer } from './TextElementRenderer'

interface ElementRendererProps {
  element: SlideElement
  scale: number
  resourceMap: Record<string, string>
  slideIndex: number
  currentIndex: number
}

export function ElementRenderer({
  element,
  scale,
  resourceMap,
  slideIndex,
  currentIndex
}: ElementRendererProps) {
  switch (element.type) {
    case 'text':
      return <TextElementRenderer element={element} scale={scale} />
    case 'shape':
      return <ShapeRenderer element={element as ShapeElement} scale={scale} />
    case 'picture':
      return <PictureRenderer element={element as PictureElement} scale={scale} resourceMap={resourceMap} />
    case 'video':
      return (
        <VideoRenderer
          element={element as VideoElement}
          scale={scale}
          resourceMap={resourceMap}
          isCurrentSlide={slideIndex === currentIndex}
          currentSlideNumber={currentIndex + 1}
          sourceSlideNumber={slideIndex + 1}
        />
      )
    case 'table':
      return <TableRenderer element={element as TableElement} scale={scale} />
    case 'topic':
      return <TopicRenderer element={element as TopicElement} scale={scale} />
    case 'cylinder':
      return <CylinderRenderer element={element as CylinderElement} scale={scale} />
    case 'cone':
      return <ConeRenderer element={element as ConeElement} scale={scale} />
    case 'cube':
      return <CubeRenderer element={element as CubeElement} scale={scale} />
    case 'geometry':
      return <GeometryRenderer element={element as GeometryElement} scale={scale} />
    case 'mathFormula':
      return <MathFormulaRenderer element={element as MathFormulaElement} scale={scale} />
    case 'unknown':
      return <UnknownElementPlaceholder element={element as UnknownElement} scale={scale} />
    default:
      return <UnknownElementPlaceholder element={element} scale={scale} />
  }
}

function UnknownElementPlaceholder({ element, scale }: { element: SlideElement; scale: number }) {
  const x = (element as { x?: number }).x ?? 0
  const y = (element as { y?: number }).y ?? 0
  const width = (element as { width?: number }).width ?? 100
  const height = (element as { height?: number }).height ?? 50
  const id = (element as { id?: string }).id ?? 'unknown'
  const rawType = (element as { type?: string }).type ?? 'unknown'
  const originalType = (element as { originalType?: string }).originalType
  const typeName = originalType || rawType

  return (
    <div
      style={{
        position: 'absolute',
        left: x * scale,
        top: y * scale,
        width: width * scale,
        height: height * scale,
        backgroundColor: '#fef3c7',
        border: '1px dashed #f59e0b',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 10 * scale,
        color: '#92400e',
        textAlign: 'center',
        overflow: 'hidden',
        pointerEvents: 'none'
      }}
    >
      <span style={{ fontWeight: 'bold', marginBottom: 2 * scale }}>⚠️ 无法显示</span>
      <span>类型: {typeName}</span>
      <span style={{ fontSize: 8 * scale, opacity: 0.7, marginTop: 2 * scale }}>
        ID: {id.slice(0, 8)}...
      </span>
    </div>
  )
}
