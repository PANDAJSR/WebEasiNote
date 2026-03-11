import type { TextElement } from './types'
import { getDirectChildElement, getDirectChildText, parseColor } from './xml-utils'
import { parseRichTextNode } from './text-parser'

function parseNumber(value: string | null, fallback = 0): number {
  if (!value) return fallback
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

/**
 * 解析四线三格元素（RuledPaper）
 */
export function parseRuledPaperElement(node: Element): TextElement | null {
  try {
    const id = getDirectChildText(node, 'Id') || 'unknown'
    const x = parseNumber(getDirectChildText(node, 'X'))
    const y = parseNumber(getDirectChildText(node, 'Y'))
    const width = parseNumber(getDirectChildText(node, 'Width'), 200)
    const height = parseNumber(getDirectChildText(node, 'Height'), 100)
    const rotation = parseNumber(getDirectChildText(node, 'Rotation'))
    const opacity = parseNumber(getDirectChildText(node, 'Opacity'), 1)

    const richTextNode = getDirectChildElement(node, 'RichText')
    if (!richTextNode) {
      console.warn('[RuledPaper] ✗ 未找到 RichText 节点')
      return null
    }

    const lineColorNode = getDirectChildElement(node, 'LineColor')
    const lineColorBrush = lineColorNode ? getDirectChildText(lineColorNode, 'ColorBrush') : null
    const lineColor = lineColorBrush ? parseColor(lineColorBrush, true) : '#3fc87d'

    const backgroundNode = getDirectChildElement(node, 'Background')
    const backgroundBrush = backgroundNode ? getDirectChildText(backgroundNode, 'ColorBrush') : null
    const backgroundColor = backgroundBrush ? parseColor(backgroundBrush) : '#ffffff'

    const parsedRichText = parseRichTextNode(richTextNode)
    return {
      type: 'text',
      id,
      x,
      y,
      width,
      height,
      rotation,
      arrangingType: parsedRichText.arrangingType,
      sizeToContent: parsedRichText.sizeToContent,
      verticalTextAlignment: parsedRichText.verticalTextAlignment,
      textLines: parsedRichText.textLines,
      ruledPaper: {
        lineColor,
        backgroundColor,
        opacity: Math.min(1, Math.max(0, opacity))
      }
    }
  } catch (error) {
    console.error('[RuledPaper] 解析失败:', error)
    return null
  }
}
