import type { PictureElement } from '../types'

export function pictureShadowFilter(shadow: PictureElement['shadow'], scale: number) {
  if (!shadow) return undefined
  const angle = shadow.angle * Math.PI / 180
  const x = Math.cos(angle) * shadow.offset * scale
  const y = -Math.sin(angle) * shadow.offset * scale
  const rgb = /^#([\da-f]{6})$/i.exec(shadow.color)
  const rgba = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/i.exec(shadow.color)
  const channels = rgb ? [0, 2, 4].map(start => parseInt(rgb[1].slice(start, start + 2), 16))
    : rgba ? rgba.slice(1, 4).map(Number) : null
  const color = channels ? `rgba(${channels.join(', ')}, ${shadow.opacity * (rgba ? Number(rgba[4]) : 1)})` : shadow.color
  // CSS 接受标准差，WPF 保存的是模糊半径。
  return `drop-shadow(${x}px ${y}px ${shadow.blurRadius * scale / 2}px ${color})`
}
