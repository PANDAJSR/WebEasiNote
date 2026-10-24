import type { InkBrush, InkElement, InkPoint } from '../../types/annotation'
import { rotatePoint, type SelectionPoint } from '../selection-geometry'

export function inkRadius(point: InkPoint, brush: InkBrush) {
  return brush.width * (brush.pressure ? 0.2 + 0.8 * point.pressure : 0.5)
}

/** 保存原始采样点；变换只修改外框，避免多次缩放损失精度。 */
export function createInk(points: InkPoint[], brush: InkBrush, id = `ink-${crypto.randomUUID()}`): InkElement {
  if (!points.length) throw new Error('笔画至少需要一个采样点')
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity
  for (const point of points) {
    const radius = inkRadius(point, brush)
    left = Math.min(left, point.x - radius)
    top = Math.min(top, point.y - radius)
    right = Math.max(right, point.x + radius)
    bottom = Math.max(bottom, point.y + radius)
  }
  const width = Math.max(0.01, right - left), height = Math.max(0.01, bottom - top)
  return { type: 'ink', id, x: left, y: top, width, height, rotation: 0,
    sourceWidth: width, sourceHeight: height, brush: { ...brush },
    points: points.map(point => ({ ...point, x: point.x - left, y: point.y - top })) }
}

export function inkToSlide(ink: InkElement, point: SelectionPoint): SelectionPoint {
  const local = rotatePoint({ x: (point.x / ink.sourceWidth - 0.5) * ink.width,
    y: (point.y / ink.sourceHeight - 0.5) * ink.height }, ink.rotation)
  return { x: ink.x + ink.width / 2 + local.x, y: ink.y + ink.height / 2 + local.y }
}

export function slideToInk(ink: InkElement, point: SelectionPoint): SelectionPoint {
  const local = rotatePoint({ x: point.x - ink.x - ink.width / 2,
    y: point.y - ink.y - ink.height / 2 }, -ink.rotation)
  return { x: (local.x / ink.width + 0.5) * ink.sourceWidth,
    y: (local.y / ink.height + 0.5) * ink.sourceHeight }
}

export function interpolateInk(a: InkPoint, b: InkPoint, t: number): InkPoint {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t,
    pressure: a.pressure + (b.pressure - a.pressure) * t, time: a.time + (b.time - a.time) * t }
}

function segmentDistance(point: SelectionPoint, a: SelectionPoint, b: SelectionPoint) {
  const dx = b.x - a.x, dy = b.y - a.y
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1)))
  return { distance: Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy), t }
}

/** 以真实笔画命中，透明包围盒不会挡住课件。 */
export function hitInk(ink: InkElement, point: SelectionPoint, tolerance = 0) {
  const local = slideToInk(ink, point)
  const padding = tolerance / Math.max(0.001, Math.min(ink.width / ink.sourceWidth, ink.height / ink.sourceHeight))
  return ink.points.some((b, index) => {
    const a = ink.points[Math.max(0, index - 1)]
    const hit = segmentDistance(local, a, b)
    return hit.distance <= inkRadius(interpolateInk(a, b, hit.t), ink.brush) + padding
  })
}

/** 面积擦后的片段收紧外框，同时保留原旋转与非等比缩放。 */
export function inkFragment(source: InkElement, points: InkPoint[]): InkElement {
  const fragment = createInk(points, source.brush)
  const sx = source.width / source.sourceWidth, sy = source.height / source.sourceHeight
  const center = inkToSlide(source, { x: fragment.x + fragment.width / 2, y: fragment.y + fragment.height / 2 })
  return { ...fragment, rotation: source.rotation,
    x: center.x - fragment.width * sx / 2, y: center.y - fragment.height * sy / 2,
    width: fragment.width * sx, height: fragment.height * sy }
}

/** 每段生成圆头轮廓，使用同一个 SVG path 填充，荧光笔自身交叠不叠加透明度。 */
export function inkPath(ink: InkElement) {
  const parts: string[] = []
  const circle = (point: InkPoint) => {
    const r = inkRadius(point, ink.brush)
    parts.push(`M${point.x - r},${point.y}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0Z`)
  }
  ink.points.forEach((b, index) => {
    circle(b)
    if (!index) return
    const a = ink.points[index - 1]
    const length = Math.hypot(b.x - a.x, b.y - a.y)
    if (length < 0.001) return
    const nx = -(b.y - a.y) / length, ny = (b.x - a.x) / length
    const ra = inkRadius(a, ink.brush), rb = inkRadius(b, ink.brush)
    // 与圆形子路径保持同一绕向，避免非零填充产生孔洞。
    parts.push(`M${a.x + nx * ra},${a.y + ny * ra}L${b.x + nx * rb},${b.y + ny * rb}`
      + `L${b.x - nx * rb},${b.y - ny * rb}L${a.x - nx * ra},${a.y - ny * ra}Z`)
  })
  return parts.join('')
}
