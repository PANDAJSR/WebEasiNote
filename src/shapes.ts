import type { TextLine } from './types'
import { getElementText, getDirectChildElement, getDirectChildText, parseColor } from './xml-utils'
import { parseTextLineForShape } from './shape-inline-text'
import { parseBrush, brushToCss } from './brushes'
import type { Brush } from './brushes'
import { generatePresetGeometryPath } from './preset-geometries'

interface NormalizedPathResult {
  path: string
  fillRule?: 'nonzero' | 'evenodd'
}

function normalizeSeewoPath(rawPath: string): NormalizedPathResult {
  if (!rawPath) return { path: '' }

  let normalizedPath = rawPath.trim()
  let fillRule: 'nonzero' | 'evenodd' | undefined

  // 兼容希沃导出的 F0/F1 前缀：F0=evenodd, F1=nonzero
  const fillRuleMatch = normalizedPath.match(/^F([01])\s*/i)
  if (fillRuleMatch) {
    fillRule = fillRuleMatch[1] === '0' ? 'evenodd' : 'nonzero'
    normalizedPath = normalizedPath.slice(fillRuleMatch[0].length).trim()
  }

  // 兜底：若开头不是 SVG 合法路径命令，尝试从首个 M/m 处恢复
  if (normalizedPath && !/^[MmLlHhVvCcSsQqTtAaZz]/.test(normalizedPath)) {
    const moveToIndex = normalizedPath.search(/[Mm]/)
    if (moveToIndex > 0) {
      normalizedPath = normalizedPath.slice(moveToIndex)
    }
  }

  return { path: normalizedPath, fillRule }
}

export function resolveStrokeDashArray(
  dashStyle?: string | number | null,
  strokeWidth = 1
): string | undefined {
  if (!dashStyle) return undefined
  const norm = String(dashStyle).trim().toLowerCase()
  const sw = Math.max(1, strokeWidth)
  switch (norm) {
    case '1':
    case 'dash':
      return `${sw * 4} ${sw * 2}`
    case '2':
    case 'dot':
      return `${sw} ${sw * 2}`
    case '3':
    case 'dashdot':
      return `${sw * 4} ${sw * 2} ${sw} ${sw * 2}`
    case '4':
    case 'dashdotdot':
      return `${sw * 4} ${sw * 2} ${sw} ${sw * 2} ${sw} ${sw * 2}`
    case '0':
    case 'solid':
    case 'none':
      return undefined
    default:
      if (norm.includes(' ') || norm.includes(',')) {
        return norm.replace(/,/g, ' ')
      }
      return undefined
  }
}

export interface ShapePathItem {
  path: string
  isFilled: boolean
  isStroke: boolean
  fillRule?: 'nonzero' | 'evenodd'
  width?: number
  height?: number
}

export interface ShapeElement {
  type: 'shape'
  id: string
  x: number
  y: number
  width: number
  height: number
  rotation?: number
  opacity?: number
  backgroundColor: string
  backgroundBrush?: Brush
  foregroundColor: string
  foregroundBrush?: Brush
  path: string
  fillRule?: 'nonzero' | 'evenodd'
  shapePaths?: ShapePathItem[]
  geometryType: string
  adjusts?: number[]
  inlineText?: TextLine[]
  borderWidth?: number
  borderColor?: string
  lineType?: string
  dashStyle?: string
  strokeDashArray?: string
  arrowType?: string
  flipHorizontal?: boolean
  flipVertical?: boolean
  shadow?: {
    offset: number
    opacity: number
    blurRadius: number
    angle: number
    color: string
  }
  reflection?: {
    offsetY: number
    opacity: number
    gradientStart: number
    gradientEnd: number
  }
}

/**
 * 解析形状元素
 */
export function parseShapeElement(shapeNode: Element): ShapeElement | null {
  try {
    const id = getDirectChildText(shapeNode, 'Id') || getElementText(shapeNode, 'Id') || 'unknown'
    const x = parseFloat(getDirectChildText(shapeNode, 'X') || getElementText(shapeNode, 'X') || '0')
    const y = parseFloat(getDirectChildText(shapeNode, 'Y') || getElementText(shapeNode, 'Y') || '0')
    const width = parseFloat(getDirectChildText(shapeNode, 'Width') || getElementText(shapeNode, 'Width') || '100')
    const height = parseFloat(getDirectChildText(shapeNode, 'Height') || getElementText(shapeNode, 'Height') || '50')
    const rotation = parseFloat(getDirectChildText(shapeNode, 'Rotation') || getElementText(shapeNode, 'Rotation') || '0')

    // 解析形状整体透明度
    const parsedOpacity = parseFloat(getDirectChildText(shapeNode, 'Opacity') || getElementText(shapeNode, 'Opacity') || '1')
    const opacity = Number.isFinite(parsedOpacity)
      ? Math.max(0, Math.min(1, parsedOpacity))
      : 1

    // 解析背景色与画刷体系（保留透明背景）
    const backgroundNode = shapeNode.querySelector('Background')
    const backgroundBrush = parseBrush(backgroundNode)
    let backgroundColor = brushToCss(backgroundBrush, undefined, 'transparent')

    // 解析前景色与画刷体系
    const foregroundNode = shapeNode.querySelector('Foreground')
    const foregroundBrush = parseBrush(foregroundNode)
    let foregroundColor = brushToCss(foregroundBrush, undefined, '#000000')

    // 解析几何类型与调节参数
    let geometryType = 'Rectangle'
    const adjusts: number[] = []
    const geometryNode = shapeNode.querySelector('Geometry')
    if (geometryNode) {
      const presetNode = geometryNode.querySelector('PresetGeometry')
      if (presetNode) {
        const typeNode = presetNode.querySelector('GeometryType')
        if (typeNode?.textContent) {
          geometryType = typeNode.textContent.trim()
        }
        const adjustsNode = presetNode.querySelector('Adjusts') || presetNode.querySelector('AdjustValues')
        if (adjustsNode) {
          Array.from(adjustsNode.children).forEach(child => {
            // 官方 Adjust 项包含 Id/ScaleX/ScaleY；只把 ScaleX 交给
            // 当前仅支持单一数值的近似预设几何生成器。
            const scaleX = getDirectChildText(child, 'ScaleX')
            const val = parseFloat(scaleX || (child.querySelector('Id') ? '' : child.textContent) || '')
            if (Number.isFinite(val)) {
              adjusts.push(val)
            }
          })
        }
      }
    }

    // 解析路径：若 XML 中未显式序列化 Path，使用 35 种预设形状动态计算 SVG 路径
    const pathElement = getDirectChildElement(shapeNode, 'Path')
    const rawPath = pathElement?.textContent || getDirectChildText(shapeNode, 'Path') || getElementText(shapeNode, 'Path') || ''
    const normalizedPathResult = normalizeSeewoPath(rawPath)
    let path = normalizedPathResult.path

    if (!path) {
      path = generatePresetGeometryPath(geometryType, width, height, adjusts)
    }

    const normalizeFillRule = (value?: string | null): 'nonzero' | 'evenodd' | undefined => {
      if (!value) return undefined
      const raw = value.trim().toLowerCase()
      if (!raw) return undefined
      if (raw === 'evenodd' || raw === 'evenoddrule' || raw === 'alternate' || raw === 'odd') {
        return 'evenodd'
      }
      if (raw === 'nonzero' || raw === 'winding' || raw === 'default') {
        return 'nonzero'
      }
      return undefined
    }

    let fillRule: 'nonzero' | 'evenodd' | undefined
    fillRule = normalizeFillRule(pathElement?.getAttribute('FillRule') || pathElement?.getAttribute('fill-rule'))
      || normalizeFillRule(getDirectChildText(shapeNode, 'FillRule'))
      || normalizeFillRule(getDirectChildText(shapeNode, 'PathFillRule'))

    if (!fillRule) {
      const pathGeometryNode = shapeNode.querySelector('PathGeometry')
      fillRule = normalizeFillRule(pathGeometryNode?.getAttribute('FillRule') || pathGeometryNode?.getAttribute('fill-rule'))
        || normalizeFillRule(getElementText(pathGeometryNode || shapeNode, 'FillRule'))
    }
    if (!fillRule) {
      fillRule = normalizedPathResult.fillRule
    }

    // 解析多路径描述 ShapePaths（如果存在，用于高精度线框与分层填充/描边）
    const shapePaths: ShapePathItem[] = []
    const shapePathsNode = shapeNode.querySelector('ShapePaths')
    if (shapePathsNode) {
      Array.from(shapePathsNode.children).forEach(spNode => {
        if (spNode.tagName !== 'ShapePath') return
        const spPathRaw = getDirectChildText(spNode, 'Path') || ''
        const { path: normSpPath, fillRule: spFillRule } = normalizeSeewoPath(spPathRaw)
        if (!normSpPath) return
        const isFilled = (getDirectChildText(spNode, 'IsFilled') || '').toLowerCase() === 'true'
        const isStroke = (getDirectChildText(spNode, 'IsStroke') || '').toLowerCase() === 'true'
        const fillModeRaw = getDirectChildText(spNode, 'FillMode')
        const widthVal = parseFloat(getDirectChildText(spNode, 'Width') || '')
        const heightVal = parseFloat(getDirectChildText(spNode, 'Height') || '')
        shapePaths.push({
          path: normSpPath,
          isFilled,
          isStroke,
          fillRule: normalizeFillRule(fillModeRaw) || spFillRule,
          width: Number.isFinite(widthVal) && widthVal > 0 ? widthVal : undefined,
          height: Number.isFinite(heightVal) && heightVal > 0 ? heightVal : undefined
        })
      })
    }

    // 解析边框粗细、线型、箭头
    const thickness = parseFloat(getDirectChildText(shapeNode, 'Thickness') || getElementText(shapeNode, 'Thickness') || '0')
    const lineType = getDirectChildText(shapeNode, 'LineType') || getElementText(shapeNode, 'LineType') || 'None'
    const dashStyle = getDirectChildText(shapeNode, 'DashStyle') || getElementText(shapeNode, 'DashStyleType') || (lineType !== 'None' ? lineType : undefined)
    const strokeDashArray = resolveStrokeDashArray(dashStyle, thickness)
    const arrowType = getDirectChildText(shapeNode, 'ArrowType') || getElementText(shapeNode, 'ArrowType') || undefined

    // 翻转支持
    const flipHorizontal = (getDirectChildText(shapeNode, 'FlipHorizontal') || '').toLowerCase() === 'true'
    const flipVertical = (getDirectChildText(shapeNode, 'FlipVertical') || '').toLowerCase() === 'true'

    // 解析内联文本（可选）
    let inlineText: TextLine[] | undefined
    const inlineTextNode = shapeNode.querySelector('InlineText')
    if (inlineTextNode) {
      const richTextNode = inlineTextNode.querySelector('RichText')
      if (richTextNode) {
        const textLinesNode = richTextNode.querySelector('TextLines')
        if (textLinesNode) {
          inlineText = []
          const textLineNodes = textLinesNode.querySelectorAll('TextLine')
          textLineNodes.forEach(lineNode => {
            const textLine = parseTextLineForShape(lineNode)
            if (textLine) {
              inlineText!.push(textLine)
            }
          })
        }
      }
    }

    // 解析阴影效果（可选）
    let shadow: ShapeElement['shadow'] | undefined
    let reflection: ShapeElement['reflection'] | undefined

    const effectsNode = shapeNode.querySelector('Effects')
    if (effectsNode) {
      const dropShadowNode = effectsNode.querySelector('DropShadow')
      if (dropShadowNode) {
        const offset = parseFloat(getElementText(dropShadowNode, 'Offset') || '4')
        const shadowOpacity = parseFloat(getElementText(dropShadowNode, 'Opacity') || '0.5')
        const blurRadius = parseFloat(getElementText(dropShadowNode, 'BlurRadius') || '8')
        const angle = parseFloat(getElementText(dropShadowNode, 'Angle') || '135')

        let shadowColor = '#000000'
        const shadowBrushNode = dropShadowNode.querySelector('ShadowBrush')
        if (shadowBrushNode) {
          const colorBrush = shadowBrushNode.querySelector('ColorBrush')
          if (colorBrush?.textContent) {
            shadowColor = parseColor(colorBrush.textContent, true)
          }
        }

        shadow = {
          offset,
          opacity: shadowOpacity,
          blurRadius,
          angle,
          color: shadowColor
        }
      }

      const reflectionNode = effectsNode.querySelector('Reflection')
      if (reflectionNode) {
        const offsetY = parseFloat(getElementText(reflectionNode, 'OffsetY') || '0')
        const refOpacity = parseFloat(getElementText(reflectionNode, 'Opacity') || '0.5')
        let gradientStart = 0.5
        let gradientEnd = 1.0

        const opacityMaskNode = reflectionNode.querySelector('OpacityMask')
        if (opacityMaskNode) {
          const linearGradientNode = opacityMaskNode.querySelector('LinearGradientBrush')
          if (linearGradientNode) {
            const gradientStopsNode = linearGradientNode.querySelector('GradientStops')
            if (gradientStopsNode?.textContent) {
              const stopsText = gradientStopsNode.textContent.trim()
              const stops = stopsText.split(' ').map(s => s.trim()).filter(Boolean)
              if (stops.length >= 2) {
                const firstStop = stops[0].split(',')
                const secondStop = stops[1].split(',')
                if (firstStop.length >= 2) {
                  gradientStart = parseFloat(firstStop[1]) || 0.5
                }
                if (secondStop.length >= 2) {
                  gradientEnd = parseFloat(secondStop[1]) || 1.0
                }
              }
            }
          }
        }

        reflection = {
          offsetY,
          opacity: refOpacity,
          gradientStart,
          gradientEnd
        }
      }
    }

    return {
      type: 'shape',
      id,
      x,
      y,
      width,
      height,
      rotation: Number.isFinite(rotation) ? rotation : 0,
      opacity,
      backgroundColor,
      backgroundBrush: backgroundBrush || undefined,
      foregroundColor,
      foregroundBrush: foregroundBrush || undefined,
      path,
      fillRule,
      shapePaths: shapePaths.length > 0 ? shapePaths : undefined,
      geometryType,
      adjusts,
      inlineText,
      borderWidth: thickness > 0 ? thickness : undefined,
      borderColor: thickness > 0 ? foregroundColor : undefined,
      lineType: lineType !== 'None' ? lineType : undefined,
      dashStyle,
      strokeDashArray,
      arrowType,
      flipHorizontal,
      flipVertical,
      shadow,
      reflection
    }
  } catch (error) {
    console.error(`  [Shape] ✗ 解析异常:`, error)
    return null
  }
}
