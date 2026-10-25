interface NormalizedPathResult {
  path: string
  fillRule?: 'nonzero' | 'evenodd'
}

/** WPF 的多个几何字符串可以直接拼接；SVG 不接受其中的 F0/F1 指令。 */
export function normalizeSeewoPath(rawPath: string): NormalizedPathResult {
  const text = rawPath.trim()
  const prefix = text.match(/^F([01])\s*/i)
  const path = text.replace(/F[01]\s*/gi, '').trim()
  const start = path.search(/[Mm]/)
  return {
    path: !/^[MmLlHhVvCcSsQqTtAaZz]/.test(path) && start > 0 ? path.slice(start) : path,
    fillRule: prefix ? (prefix[1] === '0' ? 'evenodd' : 'nonzero') : undefined
  }
}

export function isTransparentPaint(paint: string): boolean {
  return paint === 'transparent' || paint === 'none' || /,\s*0(?:\.0+)?\s*\)$/.test(paint)
}
