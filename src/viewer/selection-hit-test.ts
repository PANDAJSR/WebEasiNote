import type { SlideElement } from '../types'
import { getShapeGeometry } from '../rendering/shapeGeometry'
import { rotatePoint, selectionContains, type SelectionPoint } from './selection-geometry'
import { hitInk } from './annotation/ink-geometry'

let context: CanvasRenderingContext2D | null | undefined

/** 图形使用真实路径命中；透明区域可选中下面的元素。 */
export function hitSelectionElement(element: SlideElement, point: SelectionPoint, scale: number) {
  if (element.type === 'ink') return hitInk(element, point, 4 / scale)
  if (!selectionContains(element, point)) return false
  if (element.type !== 'shape' || typeof Path2D === 'undefined') return true
  if (context === undefined) context = document.createElement('canvas').getContext('2d')
  if (!context) return true
  const local = rotatePoint({ x: point.x - element.x - element.width / 2,
    y: point.y - element.y - element.height / 2 }, -(element.rotation || 0))
  let x = local.x + element.width / 2
  let y = local.y + element.height / 2
  if (element.flipHorizontal) x = element.width - x
  if (element.flipVertical) y = element.height - y
  const geometry = getShapeGeometry(element)
  context.save()
  try {
    context.scale(geometry.pathScaleX, geometry.pathScaleY)
    context.translate(geometry.pathTranslateX / geometry.pathScaleX, geometry.pathTranslateY / geometry.pathScaleY)
    context.lineWidth = Math.max(element.borderWidth || 0, 10 / scale)
      / Math.max(0.001, Math.min(Math.abs(geometry.pathScaleX), Math.abs(geometry.pathScaleY)))
    const paths = element.shapePaths?.length ? element.shapePaths : [{ path: element.path, isFilled: true, isStroke: true }]
    return paths.some(item => {
      const path = new Path2D(item.path)
      return (item.isFilled && element.backgroundColor !== 'transparent' && context!.isPointInPath(path, x, y, geometry.resolvedFillRule))
        || (item.isStroke && context!.isPointInStroke(path, x, y))
    }) || Boolean(element.inlineText?.length)
  } catch {
    return true
  } finally {
    context.restore()
  }
}
