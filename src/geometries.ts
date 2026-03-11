import type { GeometryElement, GeometryPoint, GeometryPrimitive, GeometryAngle, GeometryMark } from './types'
import { getDirectChildElement, getDirectChildText, parseColor } from './xml-utils'

function parseNumber(value: string | null, fallback = 0): number {
  if (!value) return fallback
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parsePoint(value: string | null): GeometryPoint | null {
  if (!value) return null
  const [x, y] = value.split(',').map(item => parseFloat(item.trim()))
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  return { x, y }
}

function parseGeometryPrimitives(node: Element): GeometryPrimitive[] {
  const geometriesNode = getDirectChildElement(node, 'Geometries')
  if (!geometriesNode) return []

  const geometryNodes = Array.from(geometriesNode.children).filter(child => child.tagName === 'Geometry')
  return geometryNodes.map(geometryNode => {
    const pointsNode = getDirectChildElement(geometryNode, 'Points')
    const points = pointsNode
      ? Array.from(pointsNode.children)
          .filter(child => child.tagName === 'Point')
          .map(pointNode => parsePoint(pointNode.textContent))
          .filter((point): point is GeometryPoint => !!point)
      : []

    const strokeNode = getDirectChildElement(geometryNode, 'Stroke')
    const strokeBrush = strokeNode ? getDirectChildText(strokeNode, 'ColorBrush') : null
    const strokeColor = strokeBrush ? parseColor(strokeBrush, true) : '#000000'
    const strokeThickness = parseNumber(getDirectChildText(geometryNode, 'StrokeThickness'), 2)

    return {
      type: getDirectChildText(geometryNode, 'Type') || 'Unknown',
      points,
      strokeColor,
      strokeThickness,
      lineType: getDirectChildText(geometryNode, 'LineType') || undefined,
      segmentType: getDirectChildText(geometryNode, 'SegmentType') || undefined,
      angleOfEllipse: parseNumber(getDirectChildText(geometryNode, 'AngleOfEllipse'), 0)
    }
  })
}

function parseGeometryAngles(node: Element): GeometryAngle[] {
  const anglesNode = getDirectChildElement(node, 'Angles')
  if (!anglesNode) return []

  return Array.from(anglesNode.children)
    .filter(child => child.tagName === 'Angle')
    .map(angleNode => ({
      value: parseNumber(getDirectChildText(angleNode, 'Angle'), 0),
      curPoint: parsePoint(getDirectChildText(angleNode, 'CurPoint')),
      nextPoint: parsePoint(getDirectChildText(angleNode, 'NextPoint')),
      prePoint: parsePoint(getDirectChildText(angleNode, 'PrePoint'))
    }))
}

function parseGeometryMarks(node: Element): GeometryMark[] {
  const marksNode = getDirectChildElement(node, 'Marks')
  if (!marksNode) return []

  return Array.from(marksNode.children)
    .filter(child => child.tagName === 'Mark')
    .map(markNode => parsePoint(getDirectChildText(markNode, 'MarkPosition')))
    .filter((position): position is GeometryPoint => !!position)
    .map(position => ({ position }))
}

/**
 * 解析几何元素（GeometryElement）
 */
export function parseGeometryElement(node: Element): GeometryElement | null {
  try {
    const id = getDirectChildText(node, 'Id') || 'unknown'
    const x = parseNumber(getDirectChildText(node, 'X'))
    const y = parseNumber(getDirectChildText(node, 'Y'))
    const width = parseNumber(getDirectChildText(node, 'Width'), 100)
    const height = parseNumber(getDirectChildText(node, 'Height'), 100)
    const rotation = parseNumber(getDirectChildText(node, 'Rotation'))

    return {
      type: 'geometry',
      id,
      x,
      y,
      width,
      height,
      rotation,
      geometries: parseGeometryPrimitives(node),
      angles: parseGeometryAngles(node),
      marks: parseGeometryMarks(node)
    }
  } catch (error) {
    console.error('[Geometry] 解析失败:', error)
    return null
  }
}
