import type { SlideElement } from '../types'

export interface SelectionBounds {
  x: number
  y: number
  width: number
  height: number
  rotation?: number
}
export interface SelectionPoint { x: number; y: number }
export type SelectionHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
export const selectionHandles: SelectionHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

export function rotatePoint(point: SelectionPoint, angle: number): SelectionPoint {
  const radians = angle * Math.PI / 180
  return { x: point.x * Math.cos(radians) - point.y * Math.sin(radians),
    y: point.x * Math.sin(radians) + point.y * Math.cos(radians) }
}

export function selectionContains(bounds: SelectionBounds, point: SelectionPoint) {
  const local = rotatePoint({ x: point.x - bounds.x - bounds.width / 2,
    y: point.y - bounds.y - bounds.height / 2 }, -(bounds.rotation || 0))
  return Math.abs(local.x) <= Math.max(4, bounds.width / 2)
    && Math.abs(local.y) <= Math.max(4, bounds.height / 2)
}

export function handlePosition(handle: SelectionHandle) {
  return { x: handle.includes('w') ? 0 : handle.includes('e') ? 1 : 0.5,
    y: handle.includes('n') ? 0 : handle.includes('s') ? 1 : 0.5 }
}

/** 在旋转后的局部坐标缩放，保持对边/对角不动。Ctrl 以中心缩放。 */
export function resizeSelection(bounds: SelectionBounds, handle: SelectionHandle,
  delta: SelectionPoint, proportional = false, centered = false): SelectionBounds {
  const local = rotatePoint(delta, -(bounds.rotation || 0))
  const direction = handlePosition(handle)
  const sx = direction.x * 2 - 1
  const sy = direction.y * 2 - 1
  const multiplier = centered ? 2 : 1
  let width = Math.max(8, bounds.width + sx * local.x * multiplier)
  let height = Math.max(8, bounds.height + sy * local.y * multiplier)
  if (proportional) {
    const ratio = sx === 0 ? height / bounds.height : sy === 0 ? width / bounds.width
      : Math.abs(width / bounds.width - 1) >= Math.abs(height / bounds.height - 1)
        ? width / bounds.width : height / bounds.height
    const limited = Math.max(ratio, 8 / bounds.width, 8 / bounds.height)
    width = bounds.width * limited
    height = bounds.height * limited
  }
  const shift = rotatePoint({ x: centered ? 0 : sx * (width - bounds.width) / 2,
    y: centered ? 0 : sy * (height - bounds.height) / 2 }, bounds.rotation || 0)
  return { ...bounds, x: bounds.x + bounds.width / 2 + shift.x - width / 2,
    y: bounds.y + bounds.height / 2 + shift.y - height / 2, width, height }
}

export function snapSelectionRotation(angle: number, original: number, radius: number, shift: boolean, alt: boolean) {
  const normalize = (value: number) => ((value % 360) + 360) % 360
  let result = normalize(angle)
  if (!alt) {
    const candidates = shift ? Array.from({ length: 24 }, (_, index) => index * 15) : [0, 90, 180, 270]
    candidates.push(normalize(original))
    const tolerance = Math.max(3, Math.min(15, Math.asin(Math.min(1, 10 / Math.max(1, radius))) * 180 / Math.PI))
    const distance = (candidate: number) => Math.abs(((result - candidate + 540) % 360) - 180)
    const nearest = candidates.sort((a, b) => distance(a) - distance(b))[0]
    if (distance(nearest) <= tolerance) result = nearest
  }
  return Math.round(result * 10) / 10 % 360
}

export function selectionMembers(elements: SlideElement[], element: SlideElement) {
  const group = element.groupAncestorIds?.[0] || element.groupId
  return group ? elements.filter(item => item.groupId === group || item.groupAncestorIds?.includes(group)) : [element]
}

export function selectionBounds(elements: SlideElement[]): SelectionBounds {
  if (elements.length === 1) {
    const element = elements[0]
    return { x: element.x, y: element.y, width: element.width, height: element.height,
      rotation: ('rotation' in element && element.rotation) || 0 }
  }
  const points = elements.flatMap(element => {
    const center = { x: element.x + element.width / 2, y: element.y + element.height / 2 }
    return [[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([x, y]) => {
      const offset = rotatePoint({ x: x * element.width / 2, y: y * element.height / 2 }, ('rotation' in element && element.rotation) || 0)
      return { x: center.x + offset.x, y: center.y + offset.y }
    })
  })
  const x = Math.min(...points.map(point => point.x))
  const y = Math.min(...points.map(point => point.y))
  return { x, y, width: Math.max(1, Math.max(...points.map(point => point.x)) - x),
    height: Math.max(1, Math.max(...points.map(point => point.y)) - y), rotation: 0 }
}

export function transformSelection(elements: SlideElement[], from: SelectionBounds, to: SelectionBounds): SlideElement[] {
  const scaleContent = (element: SlideElement): SlideElement => element.type === 'text'
    ? { ...element, playbackContentScale: (element.playbackContentScale || 1) * to.width / from.width }
    : element
  if (elements.length === 1) return [scaleContent({ ...elements[0], ...to })]
  const angle = (to.rotation || 0) - (from.rotation || 0)
  return elements.map(element => {
    const offset = rotatePoint({ x: (element.x + element.width / 2 - from.x - from.width / 2) * to.width / from.width,
      y: (element.y + element.height / 2 - from.y - from.height / 2) * to.height / from.height }, angle)
    const width = element.width * to.width / from.width
    const height = element.height * to.height / from.height
    const transformed = { ...element, x: to.x + to.width / 2 + offset.x - width / 2,
      y: to.y + to.height / 2 + offset.y - height / 2, width, height,
      rotation: ((('rotation' in element && element.rotation) || 0) + angle + 360) % 360 }
    return scaleContent(transformed)
  })
}
