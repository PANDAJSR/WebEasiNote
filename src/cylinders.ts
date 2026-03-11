import type { CylinderElement } from './types'
import { getDirectChildElement, getDirectChildText, parseColor } from './xml-utils'

function parseNumber(value: string | null, fallback: number): number {
  const parsed = parseFloat(value || '')
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseSurfaceFillColor(cylinderNode: Element, surfaceIndex: number, fallback: string): string {
  const surfacesNode = getDirectChildElement(cylinderNode, 'Surfaces')
  if (!surfacesNode) return fallback

  const surfaceNodes = Array.from(surfacesNode.children).filter(node => node.tagName === 'Surface')
  const surfaceNode = surfaceNodes[surfaceIndex]
  if (!surfaceNode) return fallback

  const fillNode = getDirectChildElement(surfaceNode, 'Fill')
  const colorBrushNode = fillNode ? getDirectChildElement(fillNode, 'ColorBrush') : null
  const rawColor = colorBrushNode?.textContent?.trim()
  if (!rawColor) return fallback
  return parseColor(rawColor, true)
}

/**
 * 解析圆柱元素
 */
export function parseCylinderElement(cylinderNode: Element): CylinderElement | null {
  try {
    const id = getDirectChildText(cylinderNode, 'Id') || 'unknown-cylinder'
    const x = parseNumber(getDirectChildText(cylinderNode, 'X'), 0)
    const y = parseNumber(getDirectChildText(cylinderNode, 'Y'), 0)
    const width = parseNumber(getDirectChildText(cylinderNode, 'Width'), 120)
    const height = parseNumber(getDirectChildText(cylinderNode, 'Height'), 160)
    const rotation = parseNumber(getDirectChildText(cylinderNode, 'Rotation'), 0)
    const edgeThickness = Math.max(0.5, parseNumber(getDirectChildText(cylinderNode, 'EdgeThickness'), 2))

    const edgeBrushNode = getDirectChildElement(cylinderNode, 'EdgeBrush')
    const edgeBrushColor = edgeBrushNode ? getDirectChildElement(edgeBrushNode, 'ColorBrush')?.textContent?.trim() : null
    const edgeColor = edgeBrushColor ? parseColor(edgeBrushColor, true) : '#000000'

    const topFillColor = parseSurfaceFillColor(cylinderNode, 0, 'rgba(255, 255, 255, 0)')
    const sideFillColor = parseSurfaceFillColor(cylinderNode, 1, 'rgba(255, 255, 255, 0)')
    const bottomFillColor = parseSurfaceFillColor(cylinderNode, 2, 'rgba(255, 255, 255, 0)')

    return {
      type: 'cylinder',
      id,
      x,
      y,
      width,
      height,
      rotation,
      edgeThickness,
      edgeColor,
      topFillColor,
      sideFillColor,
      bottomFillColor
    }
  } catch (error) {
    console.error('[Cylinder] 解析失败:', error)
    return null
  }
}
