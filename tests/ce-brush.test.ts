import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Resvg } from '@resvg/resvg-js'
import { CeBrushSampler, finishCePoints, laserTiming, ratePressure } from '../src/viewer/annotation/ce-brush'
import { smoothCePoints } from '../src/viewer/annotation/ce-smoothing'
import { createInk, hitInk, inkPath } from '../src/viewer/annotation/ink-geometry'
import type { InkBrush, InkPoint } from '../src/types/annotation'

const brush: InkBrush = { color: '#ef4444', width: 6, height: 6, opacity: 1, pressure: true, kind: 'pen', inkStyle: 0 }
const point = (x: number, y = 0, time = x * 10, pressure = 0.5): InkPoint => ({ x, y, time, pressure })
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`)

test('CE 收笔压力保留硬件压力，点集只收尾十点，速率采用宿主分段公式', () => {
  for (const [pressure, width] of [[0.1, 4], [0.5, 10], [0.9, 16]]) {
    near(createInk([point(0, 0, 0, pressure)], { ...brush, width: 10, height: 10 }).width, width)
  }
  const points = Array.from({ length: 21 }, (_, i) => point(i))
  const tapered = finishCePoints(points, brush)
  near(tapered[9].pressure, 0.5)
  near(tapered[15].pressure, 0.3)
  near(tapered[20].pressure, 0.1)
  const hardware = [point(0, 0, 0, 0.7), point(3, 0, 20, 0.8)]
  assert.equal(finishCePoints(hardware, brush), hardware)
  near(ratePressure(0), 0.9)
  near(ratePressure(0.1), 0.5)
  near(ratePressure(1.5), 0.2)
  near(ratePressure(100), 0.2)
  const rate = finishCePoints([point(0), point(10), point(20)], { ...brush, inkStyle: 1 })
  near(rate[1].pressure, ratePressure(1))
})

test('CE 实时笔锋快写变细，坐标缩放不改变 DIP 速度，触摸插值有界', () => {
  const sample = (step: number, scale: number, pointer = 'mouse') => {
    const sampler = new CeBrushSampler({ ...brush, inkStyle: 3, inputScale: scale }, point(0, 0, 0), pointer)
    for (let i = 1; i < 20; i++) sampler.append(point(i * step / scale, 0, i * 16))
    return sampler.points
  }
  const slow = sample(1, 1), fast = sample(30, 1), scaled = sample(30, 0.5)
  assert.ok(fast.at(-1)!.pressure < slow.at(-1)!.pressure)
  fast.forEach((p, i) => { near(p.x, scaled[i].x * 0.5); near(p.pressure, scaled[i].pressure) })
  assert.ok(sample(30, 1, 'touch').length <= 1 + 19 * 3)
})

test('矩形荧光笔保持实际宽高、平头、连续扫掠和单笔透明度', () => {
  const ink = createInk([point(10, 20), point(50, 20), point(10, 20)],
    { ...brush, width: 10, height: 20, pressure: false, kind: 'highlighter', tip: 'rectangle', opacity: 0.5 })
  near(ink.width, 50)
  near(ink.height, 20)
  assert.equal(hitInk(ink, { x: 6, y: 11 }), true)
  assert.equal(hitInk(ink, { x: 3, y: 20 }), false)
  const rendered = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="50" height="20"><path d="${inkPath(ink)}" fill="red" opacity="0.5"/></svg>`).render()
  const alpha = (x: number, y: number) => rendered.pixels[(y * rendered.width + x) * 4 + 3]
  assert.equal(alpha(0, 0), 128)
  assert.equal(alpha(25, 10), 128)
})

test('CE 五次平滑保留端点、压力和最多三倍输出，质量设置生效', () => {
  const points = Array.from({ length: 30 }, (_, i) => point(i * 10, Math.sin(i / 3) * 20, i * 16))
  const low = smoothCePoints(points, { ...brush, smoothing: true, smoothingQuality: 0 })
  const high = smoothCePoints(points, { ...brush, smoothing: true, smoothingQuality: 2 })
  assert.deepEqual(high[0], points[0])
  assert.deepEqual(high.at(-1), points.at(-1))
  assert.ok(high.length <= 90)
  assert.notDeepEqual(low, high)
  assert.ok(high.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && p.pressure >= 0.1))
  assert.equal(smoothCePoints(points, brush), points)
})

test('激光使用抬笔后延迟与书写时长/倍率，最短动画 20ms', () => {
  assert.deepEqual(laserTiming(800, { ...brush, fadeDelay: 3000, fadeSpeed: 2 }), { delay: 3000, duration: 400 })
  assert.equal(laserTiming(0, brush).duration, 2000)
  assert.equal(laserTiming(1, brush).duration, 20)
})
