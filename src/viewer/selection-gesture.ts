import type { SlideElement } from '../types'
import { cloneSelection } from './selection-clone'
import { resizeSelection, rotatePoint, selectionBounds, snapSelectionRotation, transformSelection,
  type SelectionBounds, type SelectionHandle, type SelectionPoint } from './selection-geometry'
import { selectionAngleDelta } from './selection-motion'

interface GesturePointer { start: SelectionPoint; position: SelectionPoint }
export interface SelectionGesture {
  kind: 'transform'
  touch: boolean
  pointers: Map<number, GesturePointer>
  original: SlideElement[]
  basis: SlideElement[]
  bounds: SelectionBounds
  handle: SelectionHandle | 'move' | 'rotate'
  next: SlideElement[] | null
  clones: SlideElement[] | null
  cloneOnMove: boolean
  selected: boolean
  smooth?: boolean
  rotationBase?: number
  snappedRotation?: number | null
}

/** 触点增减时从当前预览重新起算，整次操作仍只提交一次。 */
export function rebaseSelectionGesture(gesture: SelectionGesture) {
  const angleOf = (element: SlideElement) => (('rotation' in element && element.rotation) || 0)
  gesture.rotationBase = (gesture.rotationBase ?? gesture.bounds.rotation ?? 0)
    + (gesture.next ? selectionAngleDelta(angleOf(gesture.basis[0]), angleOf(gesture.next[0])) : 0)
  gesture.basis = gesture.next || gesture.basis
  gesture.bounds = selectionBounds(gesture.basis)
  gesture.handle = 'move'
  gesture.cloneOnMove = false
  for (const pointer of gesture.pointers.values()) pointer.start = pointer.position
}

/** 以双指中点为基准做等比缩放和旋转，同时跟随中点平移。 */
export function pinchSelection(bounds: SelectionBounds, starts: SelectionPoint[], positions: SelectionPoint[], rotation?: number): SelectionBounds {
  const vector = (points: SelectionPoint[]) => ({ x: points[1].x - points[0].x, y: points[1].y - points[0].y })
  const middle = (points: SelectionPoint[]) => ({ x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 })
  const before = vector(starts)
  const after = vector(positions)
  const distance = Math.hypot(before.x, before.y)
  if (distance < 1e-6) return bounds
  const ratio = Math.max(Math.hypot(after.x, after.y) / distance,
    8 / Math.max(bounds.width, 1e-6), 8 / Math.max(bounds.height, 1e-6))
  const angle = rotation === undefined
    ? (Math.atan2(after.y, after.x) - Math.atan2(before.y, before.x)) * 180 / Math.PI
    : rotation - (bounds.rotation || 0)
  const start = middle(starts)
  const end = middle(positions)
  const offset = rotatePoint({ x: (bounds.x + bounds.width / 2 - start.x) * ratio,
    y: (bounds.y + bounds.height / 2 - start.y) * ratio }, angle)
  const width = bounds.width * ratio
  const height = bounds.height * ratio
  return { x: end.x + offset.x - width / 2, y: end.y + offset.y - height / 2, width, height,
    rotation: (((bounds.rotation || 0) + angle) % 360 + 360) % 360 }
}

/** 页面绝对直角：6° 内吸附，偏离 10° 才脱离，抵消触摸噪声。 */
export function snapTouchRotation(angle: number, previous: number | null = null) {
  const nearest = ((Math.round(angle / 90) * 90) % 360 + 360) % 360
  const snapped = previous !== null && Math.abs(selectionAngleDelta(previous, angle)) <= 10 ? previous
    : Math.abs(selectionAngleDelta(nearest, angle)) <= 6 ? nearest : null
  return { angle: snapped ?? angle, snapped }
}

export function moveSelectionGesture(gesture: SelectionGesture, pointerId: number, position: SelectionPoint,
  scale: number, modifiers: { shiftKey: boolean; altKey: boolean; ctrlKey: boolean }) {
  const pointer = gesture.pointers.get(pointerId)!
  pointer.position = position
  const pointers = [...gesture.pointers.values()]
  const from = gesture.bounds
  let next = { ...from }
  if (pointers.length === 2) {
    if (Math.hypot(pointers[1].start.x - pointers[0].start.x, pointers[1].start.y - pointers[0].start.y) * scale < 4) {
      rebaseSelectionGesture(gesture)
      return
    }
    if (!gesture.next && pointers.every(item => Math.hypot(item.position.x - item.start.x, item.position.y - item.start.y) * scale < 3)) return
    next = pinchSelection(from, pointers.map(item => item.start), pointers.map(item => item.position))
    const base = gesture.rotationBase ?? from.rotation ?? 0
    const absolute = base + selectionAngleDelta(from.rotation || 0, next.rotation || 0)
    const snap = snapTouchRotation(absolute, gesture.snappedRotation)
    gesture.snappedRotation = snap.snapped
    next = pinchSelection(from, pointers.map(item => item.start), pointers.map(item => item.position),
      (from.rotation || 0) + snap.angle - base)
  } else {
    const delta = { x: position.x - pointer.start.x, y: position.y - pointer.start.y }
    if (Math.hypot(delta.x, delta.y) * scale < 3 && !gesture.next) return
    if (gesture.handle === 'move') {
      next.x += delta.x
      next.y += delta.y
    } else if (gesture.handle === 'rotate') {
      const center = { x: from.x + from.width / 2, y: from.y + from.height / 2 }
      const startAngle = Math.atan2(pointer.start.y - center.y, pointer.start.x - center.x)
      const angle = Math.atan2(position.y - center.y, position.x - center.x)
      next.rotation = snapSelectionRotation((from.rotation || 0) + (angle - startAngle) * 180 / Math.PI,
        from.rotation || 0, Math.hypot(position.x - center.x, position.y - center.y) * scale, modifiers.shiftKey, modifiers.altKey)
    } else {
      next = resizeSelection(from, gesture.handle, delta, true, modifiers.ctrlKey)
    }
    if (gesture.handle === 'move' && gesture.cloneOnMove && !gesture.clones) {
      gesture.clones = cloneSelection(gesture.basis)
      gesture.basis = gesture.clones
    }
  }
  gesture.next = transformSelection(gesture.basis, from, next)
}
