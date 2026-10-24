import type { PictureElement } from '../types'
import { getDirectChildElement, getDirectChildText, parseColor } from './xml-utils'

/** 图片 Style/Effects/DropShadow 与 WPF DropShadowEffect 对应。 */
export function parsePictureShadow(node: Element): PictureElement['shadow'] {
  const style = getDirectChildElement(node, 'Style')
  const effects = style && getDirectChildElement(style, 'Effects')
  const shadow = effects && getDirectChildElement(effects, 'DropShadow')
  if (!shadow) return undefined
  const number = (name: string, fallback: number) => {
    const value = Number.parseFloat(getDirectChildText(shadow, name) || '')
    return Number.isFinite(value) ? value : fallback
  }
  const brush = getDirectChildElement(shadow, 'ShadowBrush')
  return { offset: number('Offset', 0), angle: number('Angle', 315),
    opacity: Math.max(0, Math.min(1, number('Opacity', 1))), blurRadius: Math.max(0, number('BlurRadius', 5)),
    color: parseColor(brush ? getDirectChildText(brush, 'ColorBrush') || '#FF000000' : '#FF000000', true) }
}
