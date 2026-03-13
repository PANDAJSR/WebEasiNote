import type { CSSProperties } from 'react'
import type { TextElement } from '../../parser'

export function toLatin(value: number, lower = false): string {
  let n = value
  let result = ''
  while (n > 0) {
    n -= 1
    result = String.fromCharCode(65 + (n % 26)) + result
    n = Math.floor(n / 26)
  }
  return lower ? result.toLowerCase() : result
}

export function toCircleNumber(value: number): string {
  const circleNumbers = ['⓪', '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳']
  return circleNumbers[value] || `${value}`
}

export function buildTextGradient(run: TextElement['textLines'][number]['textRuns'][number]): string | undefined {
  const gradient = run.gradient
  if (!gradient || gradient.stops.length === 0) return undefined

  const dx = gradient.endPoint.x - gradient.startPoint.x
  const dy = gradient.endPoint.y - gradient.startPoint.y
  const angle = Number.isFinite(dx) && Number.isFinite(dy) && (dx !== 0 || dy !== 0)
    ? (Math.atan2(dy, dx) * 180) / Math.PI + 90
    : 180
  const stops = gradient.stops
    .map(stop => `${stop.color} ${(stop.offset * 100).toFixed(2)}%`)
    .join(', ')

  return `linear-gradient(${angle.toFixed(2)}deg, ${stops})`
}

export function getShadowStyle(run: TextElement['textLines'][number]['textRuns'][number], scale: number): string | undefined {
  const shadow = run.textEffects?.shadow
  if (!shadow) return undefined

  const radians = (shadow.direction * Math.PI) / 180
  const offsetX = Math.cos(radians) * shadow.distance * scale
  const offsetY = -Math.sin(radians) * shadow.distance * scale
  let shadowColor = shadow.color
  if (shadow.color.startsWith('rgba(')) {
    shadowColor = shadow.color.replace(/,\s*([0-9.]+)\)$/, (_, alpha) => `, ${(parseFloat(alpha) * shadow.opacity).toFixed(2)})`)
  } else if (shadow.color.startsWith('rgb(')) {
    shadowColor = shadow.color.replace('rgb(', 'rgba(').replace(')', `, ${shadow.opacity.toFixed(2)})`)
  } else if (shadow.color.startsWith('#') && shadow.color.length === 7) {
    const r = parseInt(shadow.color.slice(1, 3), 16)
    const g = parseInt(shadow.color.slice(3, 5), 16)
    const b = parseInt(shadow.color.slice(5, 7), 16)
    shadowColor = `rgba(${r}, ${g}, ${b}, ${shadow.opacity.toFixed(2)})`
  }

  return `${offsetX.toFixed(2)}px ${offsetY.toFixed(2)}px ${(shadow.blur * scale).toFixed(2)}px ${shadowColor}`
}

export function mergeOpacityToColor(color: string, opacity: number): string {
  const normalizedOpacity = Math.min(1, Math.max(0, opacity))
  if (color.startsWith('rgba(')) {
    return color.replace(
      /,\s*([0-9.]+)\)$/,
      (_, alpha) => `, ${(parseFloat(alpha) * normalizedOpacity).toFixed(2)})`
    )
  }
  if (color.startsWith('rgb(')) {
    return color.replace('rgb(', 'rgba(').replace(')', `, ${normalizedOpacity.toFixed(2)})`)
  }
  if (color.startsWith('#') && color.length === 7) {
    const r = parseInt(color.slice(1, 3), 16)
    const g = parseInt(color.slice(3, 5), 16)
    const b = parseInt(color.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${normalizedOpacity.toFixed(2)})`
  }
  return color
}

export function getTextStrokeStyle(
  run: TextElement['textLines'][number]['textRuns'][number],
  scale: number
): Pick<CSSProperties, 'WebkitTextStrokeColor' | 'WebkitTextStrokeWidth'> {
  const frame = run.textEffects?.frame
  if (!frame || frame.thickness <= 0) {
    return {
      WebkitTextStrokeColor: undefined,
      WebkitTextStrokeWidth: undefined
    }
  }

  return {
    WebkitTextStrokeColor: mergeOpacityToColor(frame.color, frame.opacity),
    WebkitTextStrokeWidth: `${(frame.thickness * scale).toFixed(2)}px`
  }
}
