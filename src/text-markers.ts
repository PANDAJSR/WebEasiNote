import { buildFontFamily, resolveFontCandidates } from './font-utils'
import type { TextLine } from './types'

export interface ResolvedTextMarker {
  text: string
  fontFamily: string | undefined
}

function toLatin(value: number, lower = false): string {
  let text = ''
  while (value > 0) {
    value -= 1
    text = String.fromCharCode(65 + value % 26) + text
    value = Math.floor(value / 26)
  }
  return lower ? text.toLowerCase() : text
}

function getDefaultMarker(type: string, value: number): string {
  switch (type) {
    case 'Circle': return '●'
    case 'Rect': case 'Box': case 'Square': return '■'
    case 'Tick': return '✓'
    case 'Decimal': return `${value}.`
    case 'Decimal1': return `(${value})`
    case 'Decimal2': return value >= 1 && value <= 20 ? String.fromCodePoint(0x2460 + value - 1) : `${value}`
    case 'UpperLatin': return `${toLatin(value)}.`
    case 'LowerLatin': return `${toLatin(value, true)}.`
    default: return '•'
  }
}

/** 每段只计算一次符号和编号，避免多次渲染及倒影导致编号递增。 */
export function resolveTextMarkers(lines: TextLine[]): Array<ResolvedTextMarker | null> {
  const counters = new Map<string, number>()
  return lines.map(line => {
    const style = line.textMarkerStyle
    // 导入的自定义项目符号可能标记为 None，显式 Char 仍然优先显示。
    if (style?.char) {
      const isWingdings = resolveFontCandidates(style.fontFamily)
        .some(name => name.toLowerCase() === 'wingdings')
      if (isWingdings && style.char.length === 1) {
        // Wingdings 使用字体专用编码；不能将整个字体的字符统统替换成箭头。
        const code = style.char.charCodeAt(0)
        const symbolCode = code >= 0xf000 && code <= 0xf0ff ? code - 0xf000 : code
        const text = symbolCode === 0x6c ? '●' : symbolCode === 0xd8 ? '➢' : undefined
        if (text) {
          // 转成 Unicode 后使用普通字体，防止再次经过符号字体映射。
          return { text, fontFamily: buildFontFamily('Arial') }
        }
      }
      return { text: style.char, fontFamily: buildFontFamily(style.fontFamily) }
    }
    if (!line.textMarker || line.textMarker === 'None') return null
    const key = `${line.textMarker}-${style?.autoNumberType || ''}-${style?.startAt || 1}`
    const value = (counters.get(key) ?? ((style?.startAt || 1) - 1)) + 1
    counters.set(key, value)
    return { text: getDefaultMarker(line.textMarker, value), fontFamily: buildFontFamily('Arial') }
  })
}
