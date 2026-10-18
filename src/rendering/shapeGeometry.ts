import type { ShapeElement } from '../shapes'
import { estimatePathBounds, inferFillRule } from '../path-utils'

const geometryCache = new WeakMap<ShapeElement, ReturnType<typeof calculateGeometry>>()

function calculateGeometry(element: ShapeElement) {
  const { width, height, path } = element
  const reference = element.shapePaths?.find(item => item.width && item.height)
  const bounds = estimatePathBounds(path)
  const boundsWidth = bounds ? Math.abs(bounds.maxX - bounds.minX) : 0
  const boundsHeight = bounds ? Math.abs(bounds.maxY - bounds.minY) : 0
  const renderWidth = Math.max(1, width)
  const renderHeight = Math.max(1, height)
  const pathScaleX = renderWidth / (boundsWidth > 0.000001 ? boundsWidth : (reference?.width || Math.max(1, width)))
  const pathScaleY = renderHeight / (boundsHeight > 0.000001 ? boundsHeight : (reference?.height || Math.max(1, height)))
  return {
    renderWidth,
    renderHeight,
    pathScaleX,
    pathScaleY,
    pathTranslateX: -(bounds?.minX || 0) * pathScaleX,
    pathTranslateY: -(bounds?.minY || 0) * pathScaleY,
    resolvedFillRule: element.fillRule || inferFillRule(path) || 'nonzero'
  }
}

/** SVG 与栅格缓存共用几何计算，保持现有路径归一化行为。 */
export function getShapeGeometry(element: ShapeElement) {
  let geometry = geometryCache.get(element)
  if (!geometry) {
    geometry = calculateGeometry(element)
    geometryCache.set(element, geometry)
  }
  return geometry
}
