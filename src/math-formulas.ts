import type { MathFormulaElement } from './types'
import { getDirectChildElement, getDirectChildText, parseColor } from './xml-utils'

function parseNumber(value: string | null, fallback = 0): number {
  if (!value) return fallback
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function findMathElement(root: Element): Element | null {
  if (root.localName === 'math') return root
  const queue: Element[] = [root]
  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) break
    if (current.localName === 'math') return current
    queue.push(...Array.from(current.children))
  }
  return null
}

function normalizeMatomNodes(root: Element) {
  const matomNodes: Element[] = []
  const queue: Element[] = [root]

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) break
    if (current.localName === 'matom') {
      matomNodes.push(current)
      continue
    }
    queue.push(...Array.from(current.children))
  }

  matomNodes.forEach(node => {
    const parent = node.parentNode
    if (!parent) return
    const textNode = node.ownerDocument.createTextNode(node.textContent || '')
    parent.replaceChild(textNode, node)
  })
}

function parseMathML(rawMathML: string): { mathML: string; fallbackText: string } | null {
  const trimmed = rawMathML.trim()
  if (!trimmed) return null

  const normalizedInput = trimmed.replace(/^\uFEFF?\s*<\?xml[\s\S]*?\?>\s*/i, '').trim()
  if (!normalizedInput) return null

  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(normalizedInput, 'application/xml')
  if (xmlDoc.querySelector('parsererror')) return null

  const mathElement = findMathElement(xmlDoc.documentElement)
  if (!mathElement) return null

  normalizeMatomNodes(mathElement)

  const serializer = new XMLSerializer()
  const serialized = serializer.serializeToString(mathElement)
  const fallbackText = mathElement.textContent?.replace(/\s+/g, ' ').trim() || ''

  return {
    mathML: serialized,
    fallbackText
  }
}

/**
 * 解析数学公式元素
 */
export function parseMathFormulaElement(node: Element): MathFormulaElement | null {
  try {
    const id = getDirectChildText(node, 'Id') || 'unknown'
    const x = parseNumber(getDirectChildText(node, 'X'))
    const y = parseNumber(getDirectChildText(node, 'Y'))
    const width = parseNumber(getDirectChildText(node, 'Width'), 200)
    const height = parseNumber(getDirectChildText(node, 'Height'), 100)
    const rotation = parseNumber(getDirectChildText(node, 'Rotation'))

    const foregroundNode = getDirectChildElement(node, 'Foreground')
    const colorBrush = foregroundNode ? getDirectChildText(foregroundNode, 'ColorBrush') : null
    const color = colorBrush ? parseColor(colorBrush, true) : '#000000'

    const mathMLRaw = getDirectChildText(node, 'MathML') || ''
    const parsedMathML = parseMathML(mathMLRaw)

    return {
      type: 'mathFormula',
      id,
      x,
      y,
      width,
      height,
      rotation,
      color,
      mathML: parsedMathML?.mathML || '',
      fallbackText: parsedMathML?.fallbackText || ''
    }
  } catch (error) {
    console.warn('[MathFormula] 解析失败:', error)
    return null
  }
}
