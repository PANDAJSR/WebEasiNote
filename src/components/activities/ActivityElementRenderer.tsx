import type { ActivityElement } from '../../types'
import { brushToCss } from '../../enbx/brushes'
import { ElementRenderer } from '../slide-renderer/ElementRenderer'
import { TextElementRenderer } from '../slide-renderer/TextElementRenderer'
import { activityStyles as styles } from './styles'

export function ActivityElementRenderer({ element, scale, resourceMap, slideIndex, currentIndex, isEditMode }: {
  element: ActivityElement; scale: number; resourceMap: Record<string, string>
  slideIndex: number; currentIndex: number; isEditMode: boolean
}) {
  const background = element.background?.type !== 'image' ? brushToCss(element.background) : undefined
  const stroke = element.stroke && brushToCss(element.stroke)
  const image = element.background?.type === 'image' ? resourceMap[element.background.sourceId] : undefined
  return <div style={{ ...styles.frame, left: element.x * scale, top: element.y * scale,
    width: element.width * scale, height: element.height * scale, transform: `rotate(${element.rotation}deg)`,
    background,
    border: element.strokeThickness > 0 ? `${element.strokeThickness * scale}px solid ${stroke || 'transparent'}` : undefined,
    borderRadius: element.roundRadius * scale }}>
    {image && <img src={image} alt='' draggable={false} style={{ ...styles.image,
      objectFit: element.background?.type === 'image' && element.background.stretch === 'Uniform' ? 'contain' : 'fill',
      opacity: element.background?.opacity ?? 1, borderRadius: 'inherit' }} />}
    {element.text && <TextElementRenderer element={element.text} scale={scale} />}
    {element.contents.map(content => <ElementRenderer key={content.id} element={content} scale={scale}
      resourceMap={resourceMap} slideIndex={slideIndex} currentIndex={currentIndex} isEditMode={isEditMode} />)}
  </div>
}
