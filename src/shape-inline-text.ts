import type { TextLine } from './types'
import { convertSeewoFontSizeToCssPx } from './font-utils'
import { getElementText, parseColor } from './xml-utils'

function parsePoint(value: string | null): { x: number; y: number } | null {
  if (!value) return null
  const parts = value.split(',').map(item => parseFloat(item.trim()))
  if (parts.length !== 2 || parts.some(item => !Number.isFinite(item))) return null
  return { x: parts[0], y: parts[1] }
}

function parseGradientStops(value: string | null): Array<{ color: string; offset: number }> {
  if (!value) return []
  return value
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
    .filter((item): item is { color: string; offset: number } => !!item)
    .sort((a, b) => a.offset - b.offset)
}

/**
 * 解析形状中的文本行
 */
export function parseTextLineForShape(lineNode: Element): TextLine | null {
  try {
    const textAlignment = (getElementText(lineNode, 'TextAlignment') || 'Left') as 'Left' | 'Center' | 'Right'
    const textMarker = getElementText(lineNode, 'TextMarker') || 'None'
    const indent = parseFloat(getElementText(lineNode, 'Indent') || '0')
    const indentLevel = parseInt(getElementText(lineNode, 'IndentLevel') || '0', 10)
    const indentType = getElementText(lineNode, 'IndentType') || 'FirstLine'
    const marginLeft = parseFloat(getElementText(lineNode, 'MarginLeft') || '0')
    const direction = (getElementText(lineNode, 'Direction') || 'LeftToRight') as 'LeftToRight' | 'RightToLeft'
    const lineSpacing = parseFloat(getElementText(lineNode, 'LineSpacing') || '1')
    const fixedLineSpacing = parseFloat(getElementText(lineNode, 'FixedLineSpacing') || 'NaN')
    const spaceBefore = parseFloat(getElementText(lineNode, 'SpaceBefore') || '0')
    const spaceAfter = parseFloat(getElementText(lineNode, 'SpaceAfter') || '0')

    const textMarkerStyleNode = lineNode.querySelector('TextMarkerStyle')
    const textMarkerStyle = textMarkerStyleNode
      ? {
          char: getElementText(textMarkerStyleNode, 'Char') || undefined,
          fontFamily: getElementText(textMarkerStyleNode, 'Source') || undefined,
          autoNumberType: getElementText(textMarkerStyleNode, 'AutoNumberType') || undefined,
          startAt: parseInt(getElementText(textMarkerStyleNode, 'StartAt') || '1', 10)
        }
      : undefined

    const textRuns: TextLine['textRuns'] = []

    const textRunsNode = lineNode.querySelector('TextRuns')
    if (textRunsNode) {
      const textRunNodes = textRunsNode.querySelectorAll('TextRun')
      textRunNodes.forEach(runNode => {
        let text = getElementText(runNode, 'Text') || ''
        text = text.replace(/[\r\n]+$/g, '')
        const fontFamilyNode = runNode.querySelector('FontFamily')
        const fontFamily = getElementText(fontFamilyNode || runNode, 'Source') || 'Arial'
        const fontSizeRaw = parseFloat(getElementText(runNode, 'FontSize') || '16')
        const fontSize = convertSeewoFontSizeToCssPx(fontSizeRaw)
        const fontStyle = (getElementText(runNode, 'FontStyle') || 'Normal').toLowerCase() as 'normal' | 'italic'
        const fontWeight = (getElementText(runNode, 'FontWeight') || 'Normal').toLowerCase() === 'bold' ? 'bold' : 'normal'
        const opacity = parseFloat(getElementText(runNode, 'Opacity') || '1')
        const decoration = (getElementText(runNode, 'Decoration') || 'None') as 'None' | 'Underline'

        let color = '#000000'
        let gradient: TextLine['textRuns'][number]['gradient']
        const foregroundNode = runNode.querySelector('Foreground')
        if (foregroundNode) {
          const colorBrush = foregroundNode.querySelector('ColorBrush')
          if (colorBrush?.textContent) {
            color = parseColor(colorBrush.textContent, true)
          }

          const linearGradientBrush = foregroundNode.querySelector('LinearGradientBrush')
          if (linearGradientBrush) {
            const startPoint = parsePoint(getElementText(linearGradientBrush, 'StartPoint')) || { x: 0, y: 0 }
            const endPoint = parsePoint(getElementText(linearGradientBrush, 'EndPoint')) || { x: 0, y: 1 }
            const stops = parseGradientStops(getElementText(linearGradientBrush, 'GradientStops'))
            if (stops.length > 0) {
              gradient = {
                startPoint,
                endPoint,
                stops,
                opacity: parseFloat(getElementText(linearGradientBrush, 'Opacity') || '1')
              }
              color = stops[stops.length - 1]?.color || color
            }
          }
        }

        textRuns.push({
          text,
          fontFamily,
          fontSize,
          fontStyle,
          fontWeight,
          color,
          gradient,
          opacity,
          decoration
        })
      })
    }

    return {
      textRuns,
      textAlignment,
      textMarker,
      textMarkerStyle,
      indent,
      indentLevel,
      indentType,
      marginLeft,
      direction,
      lineSpacing,
      fixedLineSpacing: Number.isFinite(fixedLineSpacing) ? fixedLineSpacing : undefined,
      spaceBefore,
      spaceAfter
    }
  } catch (error) {
    console.error('    [ShapeText] 解析文本行失败:', error)
    return null
  }
}
