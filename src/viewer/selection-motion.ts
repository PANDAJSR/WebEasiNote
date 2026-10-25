import type { SlideElement } from '../types'
import { rotatePoint, selectionBounds, transformSelection, type SelectionBounds } from './selection-geometry'

export interface SelectionPreviewItem {
  elements: SlideElement[]
  origin: SlideElement[]
  selected: boolean
  smooth: boolean
}
interface MotionItem extends SelectionPreviewItem {
  display: SlideElement[]
  bounds: SelectionBounds
  finishing: boolean
}
export interface SelectionFrameClock {
  request: (callback: (time: number) => void) => number
  cancel: (id: number) => void
}

export const selectionAngleDelta = (from: number, to: number) => ((to - from) % 360 + 540) % 360 - 180
const angleOf = (element: SlideElement) => (('rotation' in element && element.rotation) || 0)

/** 按耗时指数插值，刷新率不同也保持相同跟手速度，旋转始终走最短弧。 */
export function interpolateSelectionBounds(from: SelectionBounds, to: SelectionBounds, elapsed: number): SelectionBounds {
  const blend = 1 - Math.exp(-Math.max(0, elapsed) / 45)
  const mix = (start: number, end: number) => start + (end - start) * blend
  const width = mix(from.width, to.width)
  const height = mix(from.height, to.height)
  return { width, height, rotation: (from.rotation || 0) + selectionAngleDelta(from.rotation || 0, to.rotation || 0) * blend,
    x: mix(from.x + from.width / 2, to.x + to.width / 2) - width / 2,
    y: mix(from.y + from.height / 2, to.y + to.height / 2) - height / 2 }
}

/** 从首个成员还原整体变换，避免逐个插值导致组合旋转时挤在一起。 */
function boundsFor(elements: SlideElement[], origin: SlideElement[]): SelectionBounds {
  const from = selectionBounds(origin)
  if (origin.length === 1) return selectionBounds(elements)
  const first = origin[0]
  const target = elements[0]
  const ratio = target.width / Math.max(first.width, 1e-6)
  const angle = selectionAngleDelta(angleOf(first), angleOf(target))
  const offset = rotatePoint({ x: (from.x + from.width / 2 - first.x - first.width / 2) * ratio,
    y: (from.y + from.height / 2 - first.y - first.height / 2) * ratio }, angle)
  const width = from.width * ratio
  const height = from.height * ratio
  return { x: target.x + target.width / 2 + offset.x - width / 2,
    y: target.y + target.height / 2 + offset.y - height / 2, width, height, rotation: angle }
}

function arrived(from: SelectionBounds, to: SelectionBounds, scale: number) {
  return Math.max(Math.abs(from.x - to.x), Math.abs(from.y - to.y),
    Math.abs(from.width - to.width), Math.abs(from.height - to.height)) * scale < 0.15
    && Math.abs(selectionAngleDelta(from.rotation || 0, to.rotation || 0)) < 0.05
}

/** 逻辑坐标立即更新；只对双指操作的显示预览平滑，松手后完成尾帧再移除预览。 */
export class SelectionPreviewMotion {
  private items = new Map<string, MotionItem>()
  private frame: number | null = null
  private lastTime: number | null = null
  private scale = 1
  private published: SlideElement[] = []
  private publishedSelection: SlideElement[] = []

  constructor(private clock: SelectionFrameClock,
    private publish: (elements: SlideElement[], selected: SlideElement[]) => void) {}

  update(items: SelectionPreviewItem[], scale: number, settleRemoved = false) {
    this.scale = scale
    const next = new Map<string, MotionItem>()
    for (const item of items) {
      const previous = this.items.get(item.elements[0].id)
      const display = item.smooth ? previous?.display || item.origin : item.elements
      next.set(item.elements[0].id, { ...item, display, bounds: boundsFor(display, item.origin), finishing: false })
    }
    for (const [id, item] of this.items) {
      if (!next.has(id) && (item.finishing || (settleRemoved && item.smooth
        && !arrived(item.bounds, boundsFor(item.elements, item.origin), scale)))) {
        next.set(id, { ...item, finishing: true })
      }
    }
    for (const [id, item] of next) {
      const target = boundsFor(item.elements, item.origin)
      if (item.smooth && arrived(item.bounds, target, scale)) {
        item.bounds = target
        item.display = item.elements
        if (item.finishing) next.delete(id)
      }
    }
    this.items = next
    this.emit()
    if ([...next.values()].some(item => item.smooth && !arrived(item.bounds, boundsFor(item.elements, item.origin), scale))) this.schedule()
    else this.stopFrame()
  }

  /** 取消、切页和卸载必须立即停止，不能让迟到的帧恢复旧预览。 */
  clear(ids?: string[]) {
    if (ids) {
      for (const [id, item] of this.items) if (item.elements.some(element => ids.includes(element.id))) this.items.delete(id)
    } else this.items.clear()
    if (!this.items.size) this.stopFrame()
    this.emit()
  }

  dispose() {
    this.stopFrame()
    this.items.clear()
    this.published = []
    this.publishedSelection = []
  }

  private emit() {
    const items = [...this.items.values()]
    const elements = items.flatMap(item => item.display)
    const selected = items.filter(item => item.selected).flatMap(item => item.display)
    const same = (left: SlideElement[], right: SlideElement[]) => left.length === right.length
      && left.every((element, index) => element === right[index])
    if (same(elements, this.published) && same(selected, this.publishedSelection)) return
    this.published = elements
    this.publishedSelection = selected
    this.publish(elements, selected)
  }

  private schedule() {
    if (this.frame !== null) return
    this.frame = this.clock.request(time => {
      this.frame = null
      const elapsed = this.lastTime === null ? 1000 / 60 : Math.max(0, time - this.lastTime)
      this.lastTime = time
      let moving = false
      for (const [id, item] of this.items) {
        if (!item.smooth) continue
        const target = boundsFor(item.elements, item.origin)
        item.bounds = interpolateSelectionBounds(item.bounds, target, elapsed)
        if (arrived(item.bounds, target, this.scale)) {
          item.bounds = target
          item.display = item.elements
          if (item.finishing) this.items.delete(id)
        } else {
          item.display = transformSelection(item.origin, selectionBounds(item.origin), item.bounds)
          moving = true
        }
      }
      this.emit()
      if (moving) this.schedule()
      else this.lastTime = null
    })
  }

  private stopFrame() {
    if (this.frame !== null) this.clock.cancel(this.frame)
    this.frame = null
    this.lastTime = null
  }
}
