import type { InkBrush, InkPoint } from '../../types/annotation'
import { interpolateInk } from './ink-geometry'

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)

/** 移植 CE AsyncAdvancedBezierSmoothing 的五次滑窗、去重和有界等距重采样。 */
export function smoothCePoints(points: InkPoint[], brush: InkBrush) {
  if (!brush.smoothing || points.length < 3) return points
  const scale = brush.inputScale ?? 1
  const quality = brush.smoothingQuality ?? 2
  const config = [{ strength: 0.15, interval: 5, steps: 4, tension: 0.15 },
    { strength: 0.3, interval: 3, steps: 8, tension: 0.25 },
    { strength: 0.5, interval: 2, steps: 15, tension: 0.35 }][quality]
  let smoothed = points
  if (points.length >= 6) {
    smoothed = [points[0]]
    const factor = Math.max(0.05, Math.min(0.6, config.strength * (0.5 + config.tension)))
    for (let i = 0; i < points.length - 5; i++) {
      const p = points.slice(i, i + 6)
      const control = (index: number, from: number, to: number, length: number, sign: number) => {
        const dx = p[to].x - p[from].x, dy = p[to].y - p[from].y
        const norm = Math.hypot(dx, dy) || 1
        return { x: p[index].x + sign * dx / norm * length * factor,
          y: p[index].y + sign * dy / norm * length * factor }
      }
      const controls = [p[0], control(1, 0, 2, distance(p[1], p[0]), 1),
        control(2, 1, 3, distance(p[2], p[1]), 1), control(3, 2, 4, distance(p[4], p[3]), -1),
        control(4, 3, 5, distance(p[5], p[4]), -1), p[5]]
      const v1 = { x: p[2].x - p[1].x, y: p[2].y - p[1].y }
      const v2 = { x: p[4].x - p[3].x, y: p[4].y - p[3].y }
      const norm = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y)
      const angle = norm < 1e-12 ? 0 : Math.acos(Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / norm))) / Math.PI
      const steps = Math.min(24, config.steps + (quality ? Math.round(angle * config.steps) : 0))
      for (let j = i === 0 ? 1 : steps - 1; j < steps; j++) {
        const t = j / steps, u = 1 - t
        const weights = [u ** 5, 5 * u ** 4 * t, 10 * u ** 3 * t ** 2,
          10 * u ** 2 * t ** 3, 5 * u * t ** 4, t ** 5]
        smoothed.push({ ...interpolateInk(p[0], p[5], t),
          x: controls.reduce((sum, point, k) => sum + point.x * weights[k], 0),
          y: controls.reduce((sum, point, k) => sum + point.y * weights[k], 0),
          pressure: Math.max(0.1, p[0].pressure * u + p[5].pressure * t) })
      }
    }
    smoothed.push(points[points.length - 1])
    // CE 的宽松去重阈值为 0.1 DIP。
    const unique = [smoothed[0]]
    for (const point of smoothed.slice(1)) {
      if (distance(point, unique[unique.length - 1]) * scale >= 0.1) unique.push(point)
    }
    smoothed = unique
  }
  let interval = config.interval / scale
  const maxPoints = Math.max(points.length + 1, points.length * 3)
  for (let attempt = 0; attempt < 8; attempt++, interval *= 1.5) {
    const result = resample(smoothed, interval, maxPoints)
    if (result) return result
  }
  return Array.from({ length: maxPoints }, (_, i) => {
    const position = i * (smoothed.length - 1) / (maxPoints - 1)
    const index = Math.floor(position)
    return interpolateInk(smoothed[index], smoothed[Math.min(index + 1, smoothed.length - 1)], position - index)
  })
}

function resample(points: InkPoint[], interval: number, limit: number) {
  const result = [points[0]]
  let accumulated = 0
  for (let i = 1; i < points.length; i++) {
    let start = points[i - 1]
    const end = points[i]
    let remaining = distance(start, end)
    if (remaining < 1e-6) continue
    while (accumulated + remaining >= interval) {
      const point = interpolateInk(start, end, (interval - accumulated) / remaining)
      point.pressure = Math.max(0.1, point.pressure)
      result.push(point)
      if (result.length > limit) return null
      start = point
      remaining = distance(start, end)
      accumulated = 0
      if (remaining < 1e-6) break
    }
    accumulated += remaining
  }
  const last = points[points.length - 1]
  if (distance(result[result.length - 1], last) > 1e-6) result.push(last)
  return result.length <= limit ? result : null
}
