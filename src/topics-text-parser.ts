import type { TextLine, TextRun } from './types'
import { convertSeewoFontSizeToCssPx } from './font-utils'
import { getDirectChildElement, getDirectChildText, parseColor } from './xml-utils'

function parseNumber(value: string | null, fallback = 0): number {
  if (!value) return fallback
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function parsePoint(value: string | null): { x: number; y: number } {
  if (!value) {
    return { x: 0, y: 0 }
  }

  const parts = value.split(',').map(part => parseFloat(part.trim()))
  if (parts.length !== 2 || parts.some(part => !Number.isFinite(part))) {
    return { x: 0, y: 0 }
  }

  return {
    x: parts[0],
    y: parts[1]
  }
}

export function parseTextAlignment(value: string | null | undefined): 'Left' | 'Center' | 'Right' {
  if (!value) return 'Center'
  const normalized = value.trim().toLowerCase()
  if (normalized === 'left') return 'Left'
  if (normalized === 'right') return 'Right'
  return 'Center'
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

function parseTextRun(runNode: Element): TextRun | null {
  try {
    const text = getDirectChildText(runNode, 'Text') || ''
    const fontFamily = getDirectChildText(getDirectChildElement(runNode, 'FontFamily') || runNode, 'Source') || 'Arial'
    const fontSizeRaw = parseNumber(getDirectChildText(runNode, 'FontSize'), 16)
    const fontSize = convertSeewoFontSizeToCssPx(fontSizeRaw)
    const fontStyle = (getDirectChildText(runNode, 'FontStyle') || 'Normal').toLowerCase() as 'normal' | 'italic'
    const fontWeight = (getDirectChildText(runNode, 'FontWeight') || 'Normal').toLowerCase() === 'bold' ? 'bold' : 'normal'

    const foregroundNode = getDirectChildElement(runNode, 'Foreground')
    let color = '#000000'
    let gradient: TextRun['gradient']
    if (foregroundNode) {
      const colorBrush = getDirectChildElement(foregroundNode, 'ColorBrush')
      if (colorBrush?.textContent) {
        color = parseColor(colorBrush.textContent, true)
      }

      const linearGradientBrush = getDirectChildElement(foregroundNode, 'LinearGradientBrush')
      if (linearGradientBrush) {
        const startPoint = parsePoint(getDirectChildText(linearGradientBrush, 'StartPoint')) || { x: 0, y: 0 }
        const endPoint = parsePoint(getDirectChildText(linearGradientBrush, 'EndPoint')) || { x: 0, y: 1 }
        const stops = parseGradientStops(getDirectChildText(linearGradientBrush, 'GradientStops'))
        if (stops.length > 0) {
          gradient = {
            startPoint,
            endPoint,
            stops,
            opacity: parseNumber(getDirectChildText(linearGradientBrush, 'Opacity'), 1)
          }
          color = stops[stops.length - 1]?.color || color
        }
      }
    }

    const decorationRaw = getDirectChildText(runNode, 'Decoration')
    const decoration: TextRun['decoration'] = decorationRaw === 'Underline' ? 'Underline' : 'None'
    const opacity = parseNumber(getDirectChildText(runNode, 'Opacity'), 1)

    const textEffectsNode = getDirectChildElement(runNode, 'TextEffects')
    let textEffects: TextRun['textEffects']
    if (textEffectsNode) {
      const frameNode = getDirectChildElement(textEffectsNode, 'TextFrame')
      if (frameNode) {
        const thickness = parseNumber(
          getDirectChildText(frameNode, 'FrameThinkness') || getDirectChildText(frameNode, 'FrameThickness'),
          0
        )
        const frameOpacity = parseNumber(getDirectChildText(frameNode, 'FrameOpacity'), 1)
        let frameColor = '#000000'
        const brushNode = getDirectChildElement(frameNode, 'FrameBrush')
        const colorBrush = brushNode ? getDirectChildElement(brushNode, 'ColorBrush') : null
        if (colorBrush?.textContent) {
          frameColor = parseColor(colorBrush.textContent, true)
        }
        textEffects = {
          ...textEffects,
          frame: {
            thickness,
            opacity: frameOpacity,
            color: frameColor
          }
        }
      }

      const shadowNode = getDirectChildElement(textEffectsNode, 'TextShadow')
      if (shadowNode) {
        let shadowColor = '#000000'
        const brushNode = getDirectChildElement(shadowNode, 'Brush')
        const colorBrush = brushNode ? getDirectChildElement(brushNode, 'ColorBrush') : null
        if (colorBrush?.textContent) {
          shadowColor = parseColor(colorBrush.textContent, true)
        }
        textEffects = {
          ...textEffects,
          shadow: {
            blur: parseNumber(getDirectChildText(shadowNode, 'Blur'), 0),
            direction: parseNumber(getDirectChildText(shadowNode, 'Direction'), 0),
            distance: parseNumber(getDirectChildText(shadowNode, 'Distance'), 0),
            opacity: parseNumber(getDirectChildText(shadowNode, 'Opacity'), 1),
            color: shadowColor
          }
        }
      }

      const reflectionNode = getDirectChildElement(textEffectsNode, 'TextReflection')
      if (reflectionNode) {
        textEffects = {
          ...textEffects,
          reflection: {
            depth: parseNumber(getDirectChildText(reflectionNode, 'Depth'), 0.2),
            distance: parseNumber(getDirectChildText(reflectionNode, 'Distance'), 0),
            opacity: parseNumber(getDirectChildText(reflectionNode, 'Opacity'), 0.4)
          }
        }
      }
    }

    return {
      text,
      fontFamily,
      fontSize,
      fontStyle,
      fontWeight,
      color,
      gradient,
      opacity,
      decoration,
      textEffects
    }
  } catch {
    return null
  }
}

function parseTextLine(lineNode: Element, defaultAlignment: 'Left' | 'Center' | 'Right'): TextLine | null {
  try {
    const textAlignment = parseTextAlignment(getDirectChildText(lineNode, 'TextAlignment')) || defaultAlignment
    const textMarker = getDirectChildText(lineNode, 'TextMarker') || 'None'
    const indent = parseNumber(getDirectChildText(lineNode, 'Indent'), 0)
    const indentLevel = parseInt(getDirectChildText(lineNode, 'IndentLevel') || '0', 10)
    const indentType = getDirectChildText(lineNode, 'IndentType') || 'FirstLine'
    const marginLeft = parseNumber(getDirectChildText(lineNode, 'MarginLeft'), 0)
    const direction = (getDirectChildText(lineNode, 'Direction') || 'LeftToRight') as 'LeftToRight' | 'RightToLeft'
    const lineSpacing = parseNumber(getDirectChildText(lineNode, 'LineSpacing'), 1)
    const fixedLineSpacing = parseNumber(getDirectChildText(lineNode, 'FixedLineSpacing'), Number.NaN)
    const spaceBefore = parseNumber(getDirectChildText(lineNode, 'SpaceBefore'), 0)
    const spaceAfter = parseNumber(getDirectChildText(lineNode, 'SpaceAfter'), 0)

    const textMarkerStyleNode = getDirectChildElement(lineNode, 'TextMarkerStyle')
    const textMarkerStyle = textMarkerStyleNode
      ? {
          char: getDirectChildText(textMarkerStyleNode, 'Char') || undefined,
          fontFamily: getDirectChildText(textMarkerStyleNode, 'Source') || undefined,
          autoNumberType: getDirectChildText(textMarkerStyleNode, 'AutoNumberType') || undefined,
          startAt: parseInt(getDirectChildText(textMarkerStyleNode, 'StartAt') || '1', 10)
        }
      : undefined

    const textRuns: TextRun[] = []
    const textRunsNode = getDirectChildElement(lineNode, 'TextRuns')
    if (textRunsNode) {
      Array.from(textRunsNode.children)
        .filter(child => child.tagName === 'TextRun')
        .forEach(runNode => {
          const textRun = parseTextRun(runNode)
          if (!textRun) return
          if (textRun.text) {
            const hasNonBreakChar = /[^\r\n]/.test(textRun.text)
            textRun.text = hasNonBreakChar
              ? textRun.text.replace(/[\r\n]+$/g, '')
              : '\n'
          }
          textRuns.push(textRun)
        })
    }

    return {
      textRuns,
      textAlignment: textAlignment || defaultAlignment,
      textMarker,
      textMarkerStyle,
      indent,
      indentLevel: Number.isFinite(indentLevel) ? indentLevel : 0,
      indentType,
      marginLeft,
      direction,
      lineSpacing,
      fixedLineSpacing: Number.isFinite(fixedLineSpacing) ? fixedLineSpacing : undefined,
      spaceBefore,
      spaceAfter
    }
  } catch {
    return null
  }
}

interface ParsedTitleStyle {
  text: string
  textLines: TextLine[]
  fontFamily: string
  fontSize: number
  textColor: string
  textAlignment: 'Left' | 'Center' | 'Right'
}

export function parseTitleStyle(titleNode: Element | null): ParsedTitleStyle {
  if (!titleNode) {
    return {
      text: '',
      textLines: [],
      fontFamily: 'Arial',
      fontSize: 24,
      textColor: '#000000',
      textAlignment: 'Center'
    }
  }

  const text =
    getDirectChildText(titleNode, 'Text')
    || titleNode.querySelector('TextRuns > TextRun > Text')?.textContent
    || ''

  const fontFamily =
    titleNode.querySelector('TextRuns > TextRun > FontFamily > Source')?.textContent
    || titleNode.querySelector('DefaultRunProperty > TextRun > FontFamily > Source')?.textContent
    || 'Arial'

  const fontSizeRaw = parseNumber(
    titleNode.querySelector('TextRuns > TextRun > FontSize')?.textContent
    || titleNode.querySelector('DefaultRunProperty > TextRun > FontSize')?.textContent
    || null,
    24
  )

  const colorRaw =
    titleNode.querySelector('TextRuns > TextRun > Foreground > ColorBrush')?.textContent
    || titleNode.querySelector('DefaultRunProperty > TextRun > Foreground > ColorBrush')?.textContent
    || '#ff000000'

  const textAlignmentRaw =
    getDirectChildText(titleNode, 'TextAlignment')
    || titleNode.querySelector('TextLines > TextLine > TextAlignment')?.textContent

  const normalizedTextAlignment = parseTextAlignment(textAlignmentRaw)
  const textLines: TextLine[] = []
  const textLinesNode = titleNode.querySelector('TextLines')
  if (textLinesNode) {
    Array.from(textLinesNode.children)
      .filter(child => child.tagName === 'TextLine')
      .forEach(lineNode => {
        const parsed = parseTextLine(lineNode, normalizedTextAlignment)
        if (parsed) {
          textLines.push(parsed)
        }
      })
  }

  const legacyRun: TextRun = {
    text,
    fontFamily: fontFamily.trim() || 'Arial',
    fontSize: convertSeewoFontSizeToCssPx(fontSizeRaw),
    fontStyle: 'normal',
    fontWeight: 'normal',
    color: parseColor(colorRaw, true),
    opacity: 1,
    decoration: 'None'
  }

  const hasAnyTextRun = textLines.some(line => line.textRuns.length > 0)
  if (!hasAnyTextRun && text) {
    textLines.push({
      textRuns: [legacyRun],
      textAlignment: normalizedTextAlignment,
      textMarker: 'None',
      indent: 0,
      indentLevel: 0,
      indentType: 'FirstLine',
      marginLeft: 0,
      direction: 'LeftToRight',
      lineSpacing: 1,
      spaceBefore: 0,
      spaceAfter: 0
    })
  }

  const primaryRun =
    textLines.flatMap(line => line.textRuns).find(run => run.text.replace(/[\r\n]/g, '').length > 0)
    || textLines[0]?.textRuns[0]
    || legacyRun

  const plainText = textLines
    .map(line => line.textRuns.map(run => run.text).join(''))
    .join('\n')
    .trim()

  return {
    text: plainText || text.trim(),
    textLines,
    fontFamily: primaryRun.fontFamily,
    fontSize: primaryRun.fontSize,
    textColor: primaryRun.color,
    textAlignment: normalizedTextAlignment
  }
}
