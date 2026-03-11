import type { ConeElement } from './types'
import { getDirectChildElement, getDirectChildText, parseColor } from './xml-utils'

function parseNumber(value: string | null, fallback: number): number {
  const parsed = parseFloat(value || '')
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseSurfaceFillColor(coneNode: Element, surfaceIndex: number, fallback: string): string {
  const surfacesNode = getDirectChildElement(coneNode, 'Surfaces')
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
 * 解析圆锥元素
 */
export function parseConeElement(coneNode: Element): ConeElement | null {
  try {
    const id = getDirectChildText(coneNode, 'Id') || 'unknown-cone'
    const x = parseNumber(getDirectChildText(coneNode, 'X'), 0)
    const y = parseNumber(getDirectChildText(coneNode, 'Y'), 0)
    const width = parseNumber(getDirectChildText(coneNode, 'Width'), 120)
    const height = parseNumber(getDirectChildText(coneNode, 'Height'), 180)
    const rotation = parseNumber(getDirectChildText(coneNode, 'Rotation'), 0)
    const edgeThickness = Math.max(0.5, parseNumber(getDirectChildText(coneNode, 'EdgeThickness'), 2))

    const edgeBrushNode = getDirectChildElement(coneNode, 'EdgeBrush')
    const edgeBrushColor = edgeBrushNode ? getDirectChildElement(edgeBrushNode, 'ColorBrush')?.textContent?.trim() : null
    const edgeColor = edgeBrushColor ? parseColor(edgeBrushColor, true) : '#000000'

    const sideFillColor = parseSurfaceFillColor(coneNode, 0, 'rgba(255, 255, 255, 0)')
    const baseFillColor = parseSurfaceFillColor(coneNode, 1, 'rgba(255, 255, 255, 0)')

    return {
      type: 'cone',
      id,
      x,
      y,
      width,
      height,
      rotation,
      edgeThickness,
      edgeColor,
      sideFillColor,
      baseFillColor
    }
  } catch (error) {
    console.error('[Cone] 解析失败:', error)
    return null
  }
}
