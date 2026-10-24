import type { InkBrush, InkPoint } from '../../types/annotation'
import { smoothCePoints } from './ce-smoothing'

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const distance = (a: InkPoint, b: InkPoint) => Math.hypot(a.x - b.x, a.y - b.y)

/** 对应 CE GetPointSpeed / RateBasedPressureFactorFromPointSpeed；距离单位为 DIP。 */
export function ratePressure(speed: number) {
  if (speed >= 0.25) return 0.5 - 0.3 * (Math.min(speed, 1.5) - 0.3) / 1.2
  if (speed >= 0.05) return 0.5
  return 0.5 + 0.4 * (0.05 - speed) / 0.05
}

class OneEuroFilter {
  private previous: number | undefined
  constructor(private cutoff: number, private beta: number) {}
  filter(value: number, dt: number, speed: number) {
    if (this.previous === undefined) return this.previous = value
    const alpha = 1 / (1 + 1 / (2 * Math.PI * Math.max(0.001, this.cutoff + this.beta * speed) * dt))
    return this.previous += (value - this.previous) * alpha
  }
}

/** 每根指针独立持有 CE 的滤波和速度状态，预览与提交使用同一组采样。 */
export class CeBrushSampler {
  readonly points: InkPoint[] = []
  private last: InkPoint
  private smooth: InkPoint | undefined
  private rate = 120
  private sawPressure = false
  private fx = new OneEuroFilter(1.2, 0.015)
  private fy = new OneEuroFilter(1.2, 0.015)
  private fp = new OneEuroFilter(1, 0.02)
  private touchDirection: { x: number; y: number } | undefined
  constructor(private brush: InkBrush, start: InkPoint, private pointerType: string) {
    this.last = start
    this.append(start)
  }
  append(point: InkPoint) {
    if (this.pointerType !== 'touch' || this.brush.inkStyle !== 3 || !this.points.length
      || this.brush.kind === 'laser' || (this.brush.velocityMix ?? 0.45) <= 0) {
      this.sample(point)
      return
    }
    const from = this.last, dx = point.x - from.x, dy = point.y - from.y
    const scale = this.brush.inputScale ?? 1
    const length = Math.hypot(dx, dy)
    if (length * scale < 0.1) return
    const dt = Math.max(1, point.time - from.time) / 1000
    const speed = length * scale / dt
    const direction = { x: dx / length, y: dy / length }
    const incoming = this.touchDirection ?? direction
    const angle = Math.acos(clamp(incoming.x * direction.x + incoming.y * direction.y, -1, 1))
    const degrees = angle * 180 / Math.PI
    let spacing = speed < 300 ? 2 : speed < 900 ? 3.2 : 4.5
    if (degrees > 18) spacing += (1.6 - spacing) * Math.min(1, (degrees - 18) / 17)
    const steps = Math.max(1, Math.min(degrees > 18 ? 5 : 3, Math.ceil(length * scale / spacing)))
    this.rate = this.rate * 0.85 + 1 / dt * 0.15
    const tangent = Math.min(length * 0.45, 18 / scale)
    for (let i = 1; i <= steps; i++) {
      const t = i / steps, u = 1 - t
      const curved = this.touchDirection && angle < Math.PI * 0.72
      this.sample({ ...point, time: from.time + (point.time - from.time) * t,
        x: curved ? u ** 3 * from.x + 3 * u * u * t * (from.x + incoming.x * tangent)
          + 3 * u * t * t * (point.x - direction.x * tangent) + t ** 3 * point.x : from.x + dx * t,
        y: curved ? u ** 3 * from.y + 3 * u * u * t * (from.y + incoming.y * tangent)
          + 3 * u * t * t * (point.y - direction.y * tangent) + t ** 3 * point.y : from.y + dy * t }, speed, dt / steps)
    }
    this.touchDirection = direction
  }
  private sample(point: InkPoint, motionSpeed?: number, motionDt?: number) {
    const scale = this.brush.inputScale ?? 1
    const dist = distance(point, this.last) * scale
    if (this.points.length && dist < 0.01) return
    if (this.brush.inkStyle !== 3 || (this.brush.velocityMix ?? 0.45) <= 0 || this.brush.kind === 'laser') {
      this.points.push({ ...point })
      this.last = point
      return
    }
    const dt = motionDt ?? Math.max(1, point.time - this.last.time) / 1000
    if (motionDt === undefined) this.rate = this.rate * 0.85 + 1 / dt * 0.15
    const speed = motionSpeed ?? dist / dt
    if (Math.abs(point.pressure - 0.5) > 0.02) this.sawPressure = true
    const usePressure = this.sawPressure && point.pressure > 0
    const widthScale = (usePressure ? 0.25 + 0.75 * point.pressure : 1)
      * clamp(1.15 - speed / (1800 + this.rate * 3.5), 0.45, 1.25)
    const speedPressure = clamp((widthScale - 0.42) / 1.16, 0.08, 1)
    const mix = this.brush.velocityMix ?? 0.45
    const pressure = this.fp.filter(clamp(usePressure
      ? (1 - mix) * point.pressure + mix * speedPressure : speedPressure, 0.08, 1), dt, speed)
    const filtered = { ...point, x: this.fx.filter(point.x * scale, dt, speed) / scale,
      y: this.fy.filter(point.y * scale, dt, speed) / scale, pressure }
    const minDist = (this.rate > 160 ? 0.35 : this.rate > 90 ? 0.25 : 0.15) * (this.brush.minDistanceScale ?? 0.5)
    this.last = point
    if (this.smooth && this.pointerType !== 'touch' && dist < minDist) return
    this.points.push(this.smooth && this.pointerType !== 'touch' ? { ...filtered,
      x: (this.smooth.x + filtered.x) / 2, y: (this.smooth.y + filtered.y) / 2,
      pressure: (this.smooth.pressure + pressure) / 2 } : filtered)
    this.smooth = filtered
  }
  finish() {
    return smoothCePoints(finishCePoints(this.points, this.brush), this.brush)
  }
}

/** CE 点集/速率收笔仅用于普通笔且没有硬件压感的笔画。 */
export function finishCePoints(points: InkPoint[], brush: InkBrush) {
  if (brush.kind && brush.kind !== 'pen' || brush.inkStyle !== 0 && brush.inkStyle !== 1
    || points.some(point => point.pressure !== 0 && (point.pressure > 0.501 || point.pressure < 0.5))) return points
  const n = points.length - 1
  if (n <= 0) return points
  return points.map((point, i) => {
    let pressure = point.pressure
    if (brush.inkStyle === 1) {
      const speed = (distance(points[Math.max(0, i - 1)], point)
        + distance(points[Math.min(n, i + 1)], point)) * (brush.inputScale ?? 1) / 20
      pressure = ratePressure(speed)
    } else if (n >= 10 && i >= n - 10) pressure = 0.5 - 0.4 * (i - n + 10) / 10
    else if (n < 10) pressure = 0.5 - 0.4 * i / n
    return { ...point, pressure }
  })
}

export function laserTiming(duration: number, brush: InkBrush) {
  return { delay: brush.fadeDelay ?? 3000, duration: Math.max(20, Math.trunc((duration > 0 ? duration : 2000) / (brush.fadeSpeed ?? 1))) }
}
