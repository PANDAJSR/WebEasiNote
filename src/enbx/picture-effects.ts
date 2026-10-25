import type { PictureElement } from '../types'
import { getDirectChildElement as child, getDirectChildText as text, parseColor } from './xml-utils'

function number(node: Element, name: string, fallback: number) {
  const value = Number.parseFloat(text(node, name) || '')
  return Number.isFinite(value) ? value : fallback
}

const clamp = (value: number) => Math.max(0, Math.min(1, value))

function tuple(value: string | null, length: number) {
  if (!value?.trim()) return undefined
  const values = value.split(',').map(Number)
  return values.length === length && values.every(Number.isFinite) ? values : undefined
}

function shadowProperties(node: Element) {
  const brush = child(node, 'ShadowBrush')
  return {
    opacity: clamp(number(node, 'Opacity', 1)),
    blurRadius: Math.max(0, number(node, 'BlurRadius', 5)),
    color: parseColor(brush ? text(brush, 'ColorBrush') || '#FF000000' : '#FF000000', true)
  }
}

/** 只读 Style/Effects，不能从 ElementEffects 的菜单预设名称推断实际特效。 */
export function parsePictureEffects(node: Element) {
  const result: Pick<PictureElement, 'shadow' | 'perspectiveShadow' | 'reflection' | 'glow'> = {}
  const style = child(node, 'Style')
  const effects = style && child(style, 'Effects')
  if (!effects) return result
  const glow = child(effects, 'Glow')
  if (glow) result.glow = {
    color: parseColor(text(glow, 'Color') || '#00000000', true),
    opacity: clamp(number(glow, 'Opacity', 0)), blurRadius: Math.max(0, number(glow, 'BlurRadius', 0))
  }
  const drop = child(effects, 'DropShadow')
  if (drop) result.shadow = { ...shadowProperties(drop), offset: number(drop, 'Offset', 0), angle: number(drop, 'Angle', 315) }
  const perspective = child(effects, 'PerspectiveShadow')
  const matrix = perspective && tuple(text(perspective, 'ShadowMatrix'), 6)
  if (perspective && matrix) result.perspectiveShadow = {
    ...shadowProperties(perspective), offsetY: number(perspective, 'OffsetY', 0),
    matrix: matrix as [number, number, number, number, number, number]
  }
  const reflection = child(effects, 'Reflection')
  if (reflection) {
    const mask = child(reflection, 'OpacityMask')
    const gradient = mask && child(mask, 'LinearGradientBrush')
    const stops = (gradient && text(gradient, 'GradientStops') || '').trim().split(/\s+/).flatMap(stop => {
      const match = /^#([\da-f]{8}),([\d.e+-]+)$/i.exec(stop)
      if (!match || !Number.isFinite(Number(match[2]))) return []
      return [{ offset: clamp(Number(match[2])), opacity: parseInt(match[1].slice(0, 2), 16) / 255 }]
    }).sort((a, b) => a.offset - b.offset)
    result.reflection = {
      offsetY: number(reflection, 'OffsetY', 0), opacity: clamp(number(reflection, 'Opacity', 0.35)),
      startPoint: (gradient && tuple(text(gradient, 'StartPoint'), 2) || [0, 0]) as [number, number],
      endPoint: (gradient && tuple(text(gradient, 'EndPoint'), 2) || [0, 1]) as [number, number],
      stops: stops.length ? stops : [{ offset: 0.8, opacity: 0 }, { offset: 1, opacity: 1 }],
      maskOpacity: gradient ? clamp(number(gradient, 'Opacity', 1)) : 1
    }
  }
  return result
}

/** 现代嵌套相框优先；旧平铺字段仅在缺失现代节点时兼容。 */
export function parsePictureFrame(node: Element) {
  const style = child(node, 'Style')
  const frame = style && child(style, 'PictureRahmenStyle')
  const preset = style && text(style, 'PicturePresetStyle')
  const presetFrames: Record<string, string> = { FrameShadowAround: 'RectFrame',
    FrameShadowBottom: 'FrameShadowBottom', FrameInnerShadowAround: 'FrameInnerShadowAround',
    RoundRectFrame: 'RoundRectFrame', CurveRhombusFrame: 'CurveRhombusFrame', EllipseFrame: 'EllipseFrame' }
  const brush = frame && child(frame, 'LineRahmenBrush')
  return {
    pictureRahmenType: frame ? text(frame, 'RahmenStyle') || undefined
      : text(node, 'PictureRahmenType') || text(node, 'RahmenType') || presetFrames[preset || ''],
    rahmenThickness: Math.max(0, number(frame || node, frame ? 'LineRahmenThickness' : 'RahmenThickness', 0)),
    rahmenColor: brush ? parseColor(text(brush, 'ColorBrush') || '#FF000000', true) : '#000000',
    imageRahmenWidthIndex: frame ? Math.max(0, number(frame, 'ImageRahmenWidthIndex', 0)) : presetFrames[preset || ''] ? 1 : undefined
  }
}
