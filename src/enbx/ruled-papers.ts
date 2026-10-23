import type { TextElement, TextLine } from '../types'
import { getDirectChildElement, getDirectChildText, parseColor } from './xml-utils'
import { parseRichTextNode } from './text-parser'

const HANDWRITING_FONT = 'SeewoEnglishHandwriting'

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

    const lineColorNode = getDirectChildElement(node, 'LineColor')
    const lineColorBrush = lineColorNode ? getDirectChildText(lineColorNode, 'ColorBrush') : null
    const lineColor = lineColorBrush ? parseColor(lineColorBrush, true) : '#3fc87d'

    const backgroundNode = getDirectChildElement(node, 'Background')
    const backgroundBrush = backgroundNode ? getDirectChildText(backgroundNode, 'ColorBrush') : null
    const backgroundColor = backgroundBrush ? parseColor(backgroundBrush) : '#ffffff'

    // 旧版仅保存 Words；空白练习纸也应保留格线。
    const words = getDirectChildText(node, 'Words') || ''
    const wordLines = words.split(/\r\n|\r|\n/)
    const fallbackLines: TextLine[] = wordLines.map(text => ({
      textAlignment: 'Left',
      textRuns: [{ text, fontFamily: HANDWRITING_FONT,
        fontSize: 96,
        fontStyle: 'normal', fontWeight: 'normal', color: '#000000' }]
    }))
    const parsedRichText = richTextNode ? parseRichTextNode(richTextNode) : {
      arrangingType: 'Horizontal' as const, sizeToContent: 'Manual' as const,
      verticalTextAlignment: 'Center' as const, textLines: fallbackLines
    }
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
      // 官方 SetSaveInfo 在应用 RichText 后再次设置 EnglishHandwriteFontFamily。
      textLines: parsedRichText.textLines.map(line => ({ ...line,
        textRuns: line.textRuns.map(run => ({ ...run, fontFamily: HANDWRITING_FONT })) })),
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
