import { getDirectChildElement, getDirectChildText, parseColor } from './xml-utils'

export interface GradientStop {
  color: string
  offset: number
}

export type Brush =
  | {
      type: 'color'
      color: string
      opacity?: number
    }
  | {
      type: 'linear'
      startPoint: { x: number; y: number }
      endPoint: { x: number; y: number }
      stops: GradientStop[]
      opacity?: number
    }
  | {
      type: 'radial'
      center: { x: number; y: number }
      gradientOrigin: { x: number; y: number }
      radiusX: number
      radiusY: number
      stops: GradientStop[]
      opacity?: number
    }
  | {
      type: 'image'
      sourceId: string
      stretch?: string
      tileMode?: string
      opacity?: number
    }

function parsePoint(value: string | null | undefined, fallback: { x: number; y: number }): { x: number; y: number } {
  if (!value) return fallback
  const parts = value.split(',').map(item => parseFloat(item.trim()))
  if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
    return { x: parts[0], y: parts[1] }
  }
  return fallback
}

function parseNumber(value: string | null | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseGradientStopsFromNode(stopsContainer: Element | null): GradientStop[] {
  if (!stopsContainer) return []

  // Case 1: Child <GradientStop> tags
  const stopNodes = Array.from(stopsContainer.children).filter(
    node => node.tagName === 'GradientStop' || node.tagName === 'Item'
  )
  if (stopNodes.length > 0) {
    const result: GradientStop[] = []
    stopNodes.forEach(node => {
      const colorRaw =
        node.getAttribute('Color') ||
        getDirectChildText(node, 'Color') ||
        node.textContent?.trim() ||
        '#ffffffff'
      const offsetRaw =
        node.getAttribute('Offset') ||
        getDirectChildText(node, 'Offset') ||
        '0'
      const offset = Math.max(0, Math.min(1, parseNumber(offsetRaw, 0)))
      const color = parseColor(colorRaw, true)
      result.push({ color, offset })
    })
    return result.sort((a, b) => a.offset - b.offset)
  }

  // Case 2: String list like "#FFFF0000,0 #FF0000FF,1"
  const rawText = stopsContainer.textContent?.trim() || ''
  if (!rawText) return []

  return rawText
    .split(/\s+/)
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => {
      const parts = item.split(',')
      if (parts.length !== 2) return null
      const color = parseColor(parts[0].trim(), true)
      const offset = parseFloat(parts[1].trim())
      if (!Number.isFinite(offset)) return null
      return { color, offset: Math.min(1, Math.max(0, offset)) }
    })
    .filter((item): item is GradientStop => !!item)
    .sort((a, b) => a.offset - b.offset)
}

/**
 * 从 XML 容器节点中解析出标准 Brush 对象
 */
export function parseBrush(node: Element | null | undefined): Brush | null {
  if (!node) return null

  // 1. 检查是否有 LinearGradientBrush
  const linearNode =
    node.tagName === 'LinearGradientBrush'
      ? node
      : node.querySelector('LinearGradientBrush')
  if (linearNode) {
    const startPoint = parsePoint(
      linearNode.getAttribute('StartPoint') || getDirectChildText(linearNode, 'StartPoint'),
      { x: 0, y: 0 }
    )
    const endPoint = parsePoint(
      linearNode.getAttribute('EndPoint') || getDirectChildText(linearNode, 'EndPoint'),
      { x: 0, y: 1 }
    )
    const opacity = parseNumber(
      linearNode.getAttribute('Opacity') || getDirectChildText(linearNode, 'Opacity'),
      1
    )
    const stopsContainer =
      getDirectChildElement(linearNode, 'GradientStops') ||
      linearNode.querySelector('GradientStops')
    const stops = parseGradientStopsFromNode(stopsContainer)

    if (stops.length > 0) {
      return {
        type: 'linear',
        startPoint,
        endPoint,
        stops,
        opacity
      }
    }
  }

  // 2. 检查是否有 RadialGradientBrush
  const radialNode =
    node.tagName === 'RadialGradientBrush'
      ? node
      : node.querySelector('RadialGradientBrush')
  if (radialNode) {
    const center = parsePoint(
      radialNode.getAttribute('Center') || getDirectChildText(radialNode, 'Center'),
      { x: 0.5, y: 0.5 }
    )
    const gradientOrigin = parsePoint(
      radialNode.getAttribute('GradientOrigin') || getDirectChildText(radialNode, 'GradientOrigin'),
      center
    )
    const radiusX = parseNumber(
      radialNode.getAttribute('RadiusX') || getDirectChildText(radialNode, 'RadiusX'),
      0.5
    )
    const radiusY = parseNumber(
      radialNode.getAttribute('RadiusY') || getDirectChildText(radialNode, 'RadiusY'),
      0.5
    )
    const opacity = parseNumber(
      radialNode.getAttribute('Opacity') || getDirectChildText(radialNode, 'Opacity'),
      1
    )
    const stopsContainer =
      getDirectChildElement(radialNode, 'GradientStops') ||
      radialNode.querySelector('GradientStops')
    const stops = parseGradientStopsFromNode(stopsContainer)

    if (stops.length > 0) {
      return {
        type: 'radial',
        center,
        gradientOrigin,
        radiusX,
        radiusY,
        stops,
        opacity
      }
    }
  }

  // 3. 检查是否有 ImageBrush
  const imageNode =
    node.tagName === 'ImageBrush' ? node : node.querySelector('ImageBrush')
  if (imageNode) {
    const rawUri =
      imageNode.getAttribute('ImageUri') ||
      imageNode.getAttribute('ImageSource') ||
      getDirectChildText(imageNode, 'ImageUri') ||
      getDirectChildText(imageNode, 'ImageSource') ||
      getDirectChildText(imageNode, 'Source') ||
      imageNode.textContent?.trim() ||
      ''
    const sourceId = rawUri.replace(/^id:\/\//i, '').replace(/\\/g, '/')
    if (sourceId) {
      const stretch =
        imageNode.getAttribute('Stretch') ||
        getDirectChildText(imageNode, 'Stretch') ||
        'Fill'
      const tileMode =
        imageNode.getAttribute('TileMode') ||
        getDirectChildText(imageNode, 'TileMode') ||
        'None'
      const opacity = parseNumber(
        imageNode.getAttribute('Opacity') || getDirectChildText(imageNode, 'Opacity'),
        1
      )
      return {
        type: 'image',
        sourceId,
        stretch,
        tileMode,
        opacity
      }
    }
  }

  // 4. 检查是否有 ColorBrush 或直接颜色文本
  const colorBrushNode =
    node.tagName === 'ColorBrush' ? node : node.querySelector('ColorBrush')
  if (colorBrushNode) {
    const rawColor =
      colorBrushNode.getAttribute('Color') ||
      getDirectChildText(colorBrushNode, 'Color') ||
      colorBrushNode.textContent?.trim() ||
      '#ffffffff'
    const opacity = parseNumber(
      colorBrushNode.getAttribute('Opacity') || getDirectChildText(colorBrushNode, 'Opacity'),
      1
    )
    return {
      type: 'color',
      color: parseColor(rawColor, true),
      opacity
    }
  }

  const directColorText = getDirectChildText(node, 'Color') || node.textContent?.trim()
  if (directColorText && /^#[0-9A-Fa-f]{3,8}$/.test(directColorText)) {
    return {
      type: 'color',
      color: parseColor(directColorText, true),
      opacity: 1
    }
  }

  return null
}

/**
 * 将 Brush 转换为 CSS background 字符串
 */
export function brushToCss(
  brush: Brush | string | null | undefined,
  resourceMap?: Record<string, string>,
  fallback = 'transparent'
): string {
  if (!brush) return fallback
  if (typeof brush === 'string') return brush

  switch (brush.type) {
    case 'color': {
      return brush.color
    }
    case 'linear': {
      const dx = brush.endPoint.x - brush.startPoint.x
      const dy = brush.endPoint.y - brush.startPoint.y
      const angle =
        dx !== 0 || dy !== 0
          ? ((Math.atan2(dy, dx) * 180) / Math.PI + 90 + 360) % 360
          : 180
      const stops = brush.stops
        .map(s => `${s.color} ${(s.offset * 100).toFixed(1)}%`)
        .join(', ')
      return `linear-gradient(${angle.toFixed(1)}deg, ${stops})`
    }
    case 'radial': {
      const cx = (brush.center.x * 100).toFixed(1)
      const cy = (brush.center.y * 100).toFixed(1)
      const stops = brush.stops
        .map(s => `${s.color} ${(s.offset * 100).toFixed(1)}%`)
        .join(', ')
      return `radial-gradient(circle at ${cx}% ${cy}%, ${stops})`
    }
    case 'image': {
      const url = resourceMap?.[brush.sourceId]
      if (url) {
        return `url("${url}")`
      }
      return fallback
    }
    default:
      return fallback
  }
}
