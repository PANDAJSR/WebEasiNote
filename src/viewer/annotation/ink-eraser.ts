import type { InkElement, InkPoint } from '../../types/annotation'
import type { SelectionPoint } from '../selection-geometry'
import { inkFragment, inkSupport, interpolateInk, slideToInk } from './ink-geometry'

const cross = (a: SelectionPoint, b: SelectionPoint, c: SelectionPoint) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)

function convexHull(points: SelectionPoint[]) {
  const sorted = points.sort((a, b) => a.x - b.x || a.y - b.y)
  const half = (items: SelectionPoint[]) => {
    const result: SelectionPoint[] = []
    for (const point of items) {
      while (result.length > 1 && cross(result[result.length - 2], result[result.length - 1], point) <= 0) result.pop()
      result.push(point)
    }
    return result.slice(0, -1)
  }
  return [...half(sorted), ...half([...sorted].reverse())]
}

/** 圆形使用外接 32 边形；扫掠体覆盖相邻事件之间的整段移动。 */
function eraserPolygon(from: SelectionPoint, to: SelectionPoint, width: number, shape: 'circle' | 'rectangle') {
  const radius = width / 2
  const footprint = shape === 'rectangle'
    ? [{ x: -radius, y: -radius * 56 / 38 }, { x: radius, y: -radius * 56 / 38 },
      { x: radius, y: radius * 56 / 38 }, { x: -radius, y: radius * 56 / 38 }]
    : Array.from({ length: 32 }, (_, index) => ({
      x: Math.cos(index * Math.PI / 16) * radius / Math.cos(Math.PI / 32),
      y: Math.sin(index * Math.PI / 16) * radius / Math.cos(Math.PI / 32)
    }))
  return convexHull([from, to].flatMap(center => footprint.map(point => ({ x: center.x + point.x, y: center.y + point.y }))))
}

/** 裁剪线性压感中心线；轮廓半径扩张裁剪平面，保留插值后的切点。 */
function cutInterval(a: InkPoint, b: InkPoint, ink: InkElement, polygon: SelectionPoint[]) {
  let enter = 0, exit = 1
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i], q = polygon[(i + 1) % polygon.length]
    const nx = p.y - q.y, ny = q.x - p.x
    const start = cross(p, q, a) + inkSupport(a, ink.brush, nx, ny)
    const end = cross(p, q, b) + inkSupport(b, ink.brush, nx, ny)
    if (start < 0 && end < 0) return null
    if (start < 0) enter = Math.max(enter, start / (start - end))
    if (end < 0) exit = Math.min(exit, start / (start - end))
    if (enter > exit) return null
  }
  return [enter, exit] as const
}

/** 返回同一引用代表未命中；新片段保留原层序位置，由调用方一次性提交历史。 */
export function eraseInk(ink: InkElement, from: SelectionPoint, to: SelectionPoint,
  width: number, shape: 'circle' | 'rectangle', wholeStroke = false): InkElement[] {
  if (ink.brush.kind === 'laser') return [ink]
  const polygon = eraserPolygon(from, to, width, shape).map(point => slideToInk(ink, point))
  let current: InkPoint[] = [], changed = false
  const fragments: InkPoint[][] = []
  const flush = () => { if (current.length) fragments.push(current); current = [] }
  if (ink.points.length === 1) {
    return cutInterval(ink.points[0], ink.points[0], ink, polygon) ? [] : [ink]
  }
  for (let i = 1; i < ink.points.length; i++) {
    const a = ink.points[i - 1], b = ink.points[i]
    const interval = cutInterval(a, b, ink, polygon)
    if (!interval) {
      if (!current.length) current.push(a)
      current.push(b)
      continue
    }
    changed = true
    if (wholeStroke) return []
    const [enter, exit] = interval
    if (enter > 1e-7) {
      if (!current.length) current.push(a)
      current.push(interpolateInk(a, b, enter))
    }
    flush()
    if (exit < 1 - 1e-7) current = [interpolateInk(a, b, exit), b]
  }
  flush()
  return changed ? fragments.map(points => inkFragment(ink, points)) : [ink]
}
