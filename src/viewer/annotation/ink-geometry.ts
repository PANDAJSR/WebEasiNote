import type { InkBrush, InkElement, InkPoint } from '../../types/annotation'
import { rotatePoint, type SelectionPoint } from '../selection-geometry'

export function inkRadius(point: InkPoint, brush: InkBrush) {
  return Math.max(brush.width, brush.height ?? brush.width) * pressureScale(point, brush) / 2
}

function pressureScale(point: InkPoint, brush: InkBrush) {
  if (!brush.pressure) return 1
  // WPF Stroke.GetGeometry 实测：10 DIP 在 p=.1/.5/.9 时为 4/10/16 DIP。
  return brush.inkStyle === undefined ? 0.4 + 1.6 * point.pressure : 0.25 + 1.5 * point.pressure
}

/** 沿裁剪平面法向的笔尖支撑距离，矩形与椭圆不能共用外接圆。 */
export function inkSupport(point: InkPoint, brush: InkBrush, nx: number, ny: number) {
  const factor = pressureScale(point, brush) / 2
  const x = brush.width * factor * nx, y = (brush.height ?? brush.width) * factor * ny
  return brush.tip === 'rectangle' ? Math.abs(x) + Math.abs(y) : Math.hypot(x, y)
}

/** 保存原始采样点；变换只修改外框，避免多次缩放损失精度。 */
export function createInk(points: InkPoint[], brush: InkBrush, id = `ink-${crypto.randomUUID()}`): InkElement {
  if (!points.length) throw new Error('笔画至少需要一个采样点')
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity
  for (const point of points) {
    const factor = pressureScale(point, brush) / 2
    const rx = brush.width * factor, ry = (brush.height ?? brush.width) * factor
    left = Math.min(left, point.x - rx)
    top = Math.min(top, point.y - ry)
    right = Math.max(right, point.x + rx)
    bottom = Math.max(bottom, point.y + ry)
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
  if (ink.brush.kind === 'laser') return false
  const local = slideToInk(ink, point)
  const padding = tolerance / Math.max(0.001, Math.min(ink.width / ink.sourceWidth, ink.height / ink.sourceHeight))
  return ink.points.some((b, index) => {
    const a = ink.points[Math.max(0, index - 1)]
    const ratio = (ink.brush.height ?? ink.brush.width) / ink.brush.width
    const projected = segmentDistance({ x: local.x, y: local.y / ratio },
      { x: a.x, y: a.y / ratio }, { x: b.x, y: b.y / ratio })
    if (ink.brush.tip === 'rectangle') {
      // 矩形扫掠体用局部坐标两轴扩张的线段裁剪。
      let enter = 0, exit = 1
      for (const axis of ['x', 'y'] as const) {
        const dimension = axis === 'x' ? ink.brush.width : ink.brush.height ?? ink.brush.width
        const ra = dimension * pressureScale(a, ink.brush) / 2 + padding
        const rb = dimension * pressureScale(b, ink.brush) / 2 + padding
        for (const sign of [-1, 1]) {
          const start = ra + sign * (a[axis] - local[axis]), end = rb + sign * (b[axis] - local[axis])
          if (start < 0 && end < 0) return false
          if (start < 0) enter = Math.max(enter, start / (start - end))
          if (end < 0) exit = Math.min(exit, start / (start - end))
        }
      }
      return enter <= exit
    }
    return projected.distance <= ink.brush.width * pressureScale(interpolateInk(a, b, projected.t), ink.brush) / 2 + padding
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
  if (ink.brush.tip === 'rectangle') return rectanglePath(ink)
  const parts: string[] = []
  const ratio = (ink.brush.height ?? ink.brush.width) / ink.brush.width
  const radius = (point: InkPoint) => ink.brush.width * pressureScale(point, ink.brush) / 2
  const circle = (point: InkPoint) => {
    const r = radius(point)
    parts.push(`M${point.x - r},${point.y * ratio}a${r},${r * ratio} 0 1,0 ${2 * r},0a${r},${r * ratio} 0 1,0 ${-2 * r},0Z`)
  }
  const points = ink.points.map(point => ({ ...point, y: point.y / ratio }))
  points.forEach((b, index) => {
    circle(b)
    if (!index) return
    const a = points[index - 1]
    const length = Math.hypot(b.x - a.x, b.y - a.y)
    if (length < 0.001) return
    const nx = -(b.y - a.y) / length, ny = (b.x - a.x) / length
    const ra = radius(a), rb = radius(b)
    // 与圆形子路径保持同一绕向，避免非零填充产生孔洞。
    parts.push(`M${a.x + nx * ra},${(a.y + ny * ra) * ratio}L${b.x + nx * rb},${(b.y + ny * rb) * ratio}`
      + `L${b.x - nx * rb},${(b.y - ny * rb) * ratio}L${a.x - nx * ra},${(a.y - ny * ra) * ratio}Z`)
  })
  return parts.join('')
}

/** 矩形笔尖沿线扫掠；各段取两端笔尖凸包，保持固定笔尖朝向。 */
function rectanglePath(ink: InkElement) {
  const corners = (point: InkPoint) => {
    const factor = pressureScale(point, ink.brush) / 2
    return [-1, 1].flatMap(x => [-1, 1].map(y => ({ x: point.x + x * ink.brush.width * factor,
      y: point.y + y * (ink.brush.height ?? ink.brush.width) * factor })))
  }
  return ink.points.map((point, i) => {
    const points = [...corners(ink.points[Math.max(0, i - 1)]), ...corners(point)]
      .sort((a, b) => a.x - b.x || a.y - b.y)
    const cross = (a: SelectionPoint, b: SelectionPoint, c: SelectionPoint) =>
      (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
    const half = (list: SelectionPoint[]) => {
      const hull: SelectionPoint[] = []
      for (const p of list) {
        while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], p) <= 0) hull.pop()
        hull.push(p)
      }
      return hull.slice(0, -1)
    }
    const hull = [...half(points), ...half([...points].reverse())].reverse()
    return hull.map((p, j) => `${j ? 'L' : 'M'}${p.x},${p.y}`).join('') + 'Z'
  }).join('')
}
