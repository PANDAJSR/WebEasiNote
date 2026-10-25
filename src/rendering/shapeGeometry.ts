import type { ShapeElement } from '../enbx/shapes'
import { estimatePathBounds, inferFillRule } from '../enbx/path-utils'
import { resolveShapeIsClosed } from './shape-stroke'
import { bezierPathBounds } from '../enbx/bezier-path-bounds'

const geometryCache = new WeakMap<ShapeElement, ReturnType<typeof calculateGeometry>>()

function calculateGeometry(element: ShapeElement) {
  const { width, height, path } = element
  const reference = element.shapePaths?.find(item => item.width && item.height)
  const bounds = element.geometryType.toLowerCase() === 'freeline'
    ? bezierPathBounds(path) || estimatePathBounds(path) : estimatePathBounds(path)
  const boundsWidth = bounds ? Math.abs(bounds.maxX - bounds.minX) : 0
  const boundsHeight = bounds ? Math.abs(bounds.maxY - bounds.minY) : 0
  const renderWidth = Math.max(1, width)
  const renderHeight = Math.max(1, height)
  const local = element.localPathCoordinates
  const pathScaleX = local ? 1 : renderWidth / (boundsWidth > 0.000001 ? boundsWidth : (reference?.width || Math.max(1, width)))
  const pathScaleY = local ? 1 : renderHeight / (boundsHeight > 0.000001 ? boundsHeight : (reference?.height || Math.max(1, height)))
  return {
    renderWidth,
    renderHeight,
    pathScaleX,
    pathScaleY,
    pathTranslateX: local ? 0 : -(bounds?.minX || 0) * pathScaleX,
    pathTranslateY: local ? 0 : -(bounds?.minY || 0) * pathScaleY,
    isFilled: resolveShapeIsClosed(element.geometryType, path),
    resolvedFillRule: element.fillRule || inferFillRule(path) || 'nonzero'
  }
}

/** SVG 与栅格缓存共用坐标、填充和路径变换。 */
export function getShapeGeometry(element: ShapeElement) {
  let geometry = geometryCache.get(element)
  if (!geometry) {
    geometry = calculateGeometry(element)
    geometryCache.set(element, geometry)
  }
  return geometry
}
