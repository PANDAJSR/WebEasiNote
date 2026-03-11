import type { CubeElement } from './types'
import { getDirectChildElement, getDirectChildText, parseColor } from './xml-utils'

function parseNumber(value: string | null, fallback: number): number {
  const parsed = parseFloat(value || '')
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseSurfaceFillColor(cubeNode: Element, surfaceIndex: number, fallback: string): string {
  const surfacesNode = getDirectChildElement(cubeNode, 'Surfaces')
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
 * 解析立方体元素
 */
export function parseCubeElement(cubeNode: Element): CubeElement | null {
  try {
    const id = getDirectChildText(cubeNode, 'Id') || 'unknown-cube'
    const x = parseNumber(getDirectChildText(cubeNode, 'X'), 0)
    const y = parseNumber(getDirectChildText(cubeNode, 'Y'), 0)
    const width = parseNumber(getDirectChildText(cubeNode, 'Width'), 160)
    const height = parseNumber(getDirectChildText(cubeNode, 'Height'), 160)
    const rotation = parseNumber(getDirectChildText(cubeNode, 'Rotation'), 0)
    const edgeThickness = Math.max(0.5, parseNumber(getDirectChildText(cubeNode, 'EdgeThickness'), 2))

    const edgeBrushNode = getDirectChildElement(cubeNode, 'EdgeBrush')
    const edgeBrushColor = edgeBrushNode ? getDirectChildElement(edgeBrushNode, 'ColorBrush')?.textContent?.trim() : null
    const edgeColor = edgeBrushColor ? parseColor(edgeBrushColor, true) : '#000000'

    return {
      type: 'cube',
      id,
      x,
      y,
      width,
      height,
      rotation,
      edgeThickness,
      edgeColor,
      topFillColor: parseSurfaceFillColor(cubeNode, 0, 'rgba(255, 255, 255, 0)'),
      frontFillColor: parseSurfaceFillColor(cubeNode, 1, 'rgba(255, 255, 255, 0)'),
      rightFillColor: parseSurfaceFillColor(cubeNode, 2, 'rgba(255, 255, 255, 0)')
    }
  } catch (error) {
    console.error('[Cube] 解析失败:', error)
    return null
  }
}
