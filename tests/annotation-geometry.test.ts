import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Resvg } from '@resvg/resvg-js'
import { createInk, hitInk, inkPath, inkToSlide } from '../src/viewer/annotation/ink-geometry'
import { eraseInk } from '../src/viewer/annotation/ink-eraser'
import { commitPage, emptyPage, replacePageInk, resolvePage, travelPage } from '../src/viewer/annotation/playback-page'
import { defaultAnnotationState, patchAnnotationState } from '../src/viewer/annotation/annotation-state'
import { lassoSelection } from '../src/viewer/selection-lasso'
import { selectionBounds, transformSelection } from '../src/viewer/selection-geometry'
import type { InkBrush, InkPoint, SlideElement } from '../src/types'

const brush: InkBrush = { color: '#ff0000', width: 4, opacity: 1, pressure: false }
const point = (x: number, y: number, pressure = 0.5): InkPoint => ({ x, y, pressure, time: x })
const line = () => createInk([point(10, 50), point(210, 50)], brush, 'ink')
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`)

test('墨迹精确命中，单点可画，变换不改采样数据；混合选择整体移动', () => {
  const ink = line()
  assert.equal(hitInk(ink, { x: 60, y: 50 }), true)
  assert.equal(hitInk(ink, { x: 60, y: 60 }), false)
  const dot = createInk([point(30, 40)], brush)
  assert.equal(hitInk(dot, { x: 31, y: 40 }), true)
  assert.equal(hitInk(dot, { x: 35, y: 40 }), false)
  const shape: SlideElement = { type: 'shape', id: 'shape', x: 20, y: 70, width: 20, height: 20,
    path: 'M0 0H20V20H0Z', backgroundColor: '#ffffff', foregroundColor: '#000000', geometryType: 'Rectangle' }
  const members = lassoSelection([shape, ink], [{ x: 0, y: 0 }, { x: 240, y: 0 }, { x: 240, y: 100 }, { x: 0, y: 100 }])
  assert.deepEqual(members.map(element => element.id), ['shape', 'ink'])
  const bounds = selectionBounds(members)
  const moved = transformSelection(members, bounds, { ...bounds, x: bounds.x + 70, y: bounds.y + 20 })
  near(moved[0].x, shape.x + 70)
  const movedInk = moved[1]
  assert.equal(movedInk.type, 'ink')
  if (movedInk.type !== 'ink') return
  assert.equal(movedInk.points, ink.points)
  assert.equal(hitInk(movedInk, { x: 130, y: 70 }), true)
})

test('笔画轮廓一次填充，不因自身重叠加深或留下连接孔洞', () => {
  const ink = createInk([point(10, 20), point(40, 20), point(10, 20)], { ...brush, opacity: 0.35 })
  const rendered = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${ink.width}" height="${ink.height}">
    <path d="${inkPath(ink)}" fill="red" fill-opacity="0.35" fill-rule="nonzero"/></svg>`).render()
  const pixels = rendered.pixels
  const alpha = (x: number, y: number) => pixels[(y * rendered.width + x) * 4 + 3]
  assert.ok(alpha(12, 2) >= 88 && alpha(12, 2) <= 90)
  assert.equal(alpha(22, 2), alpha(12, 2))
  assert.ok(alpha(2, 2) >= 88)
})

test('面积擦扫过整段稀疏输入，切成两段并保留压力插值；整笔擦只删命中笔画', () => {
  const ink = createInk([point(10, 50, 0.2), point(210, 50, 0.8)], { ...brush, pressure: true })
  const pieces = eraseInk(ink, { x: 110, y: 0 }, { x: 110, y: 100 }, 20, 'rectangle')
  assert.equal(pieces.length, 2)
  assert.ok(pieces[0].points.at(-1)!.pressure > 0.4)
  assert.ok(pieces[0].points.at(-1)!.pressure < 0.5)
  assert.equal(pieces.some(piece => hitInk(piece, { x: 110, y: 50 })), false)
  assert.equal(hitInk(pieces[0], { x: 30, y: 50 }), true)
  assert.equal(hitInk(pieces[1], { x: 190, y: 50 }), true)
  assert.deepEqual(eraseInk(ink, { x: 110, y: 0 }, { x: 110, y: 100 }, 20, 'circle', true), [])
  assert.equal(eraseInk(ink, { x: 400, y: 0 }, { x: 400, y: 100 }, 20, 'circle')[0], ink)
})

test('旋转、非等比缩放后的笔画按屏幕橡皮切割，剩余点位置保持不变', () => {
  const original = line()
  const ink = { ...original, x: 100, y: 80, width: original.width * 2, height: original.height * 3, rotation: 37 }
  const start = inkToSlide(ink, ink.points[0]), end = inkToSlide(ink, ink.points[1])
  const center = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
  const fragments = eraseInk(ink, center, center, 24, 'circle')
  assert.equal(fragments.length, 2)
  const first = inkToSlide(fragments[0], fragments[0].points[0])
  const last = inkToSlide(fragments[1], fragments[1].points.at(-1)!)
  near(first.x, start.x)
  near(first.y, start.y)
  near(last.x, end.x)
  near(last.y, end.y)
  assert.equal(fragments.some(fragment => hitInk(fragment, center)), false)
})

test('擦除片段保持课件层序，撤销恢复原笔画，重做恢复片段；新事务清除重做', () => {
  const ink = line()
  const foreground = { type: 'unknown', id: 'front', x: 0, y: 0, width: 20, height: 20, originalType: 'fixture' } as SlideElement
  const base = [ink, foreground]
  const fragments = eraseInk(ink, { x: 110, y: 50 }, { x: 110, y: 50 }, 20, 'circle')
  const changes = replacePageInk(emptyPage(), base, new Map([[ink.id, fragments]]))
  const history = commitPage(undefined, changes)
  assert.deepEqual(resolvePage(base, history.present).map(element => element.id), [...fragments.map(fragment => fragment.id), 'front'])
  const undone = travelPage(history)!
  assert.deepEqual(resolvePage(base, undone.present), base)
  assert.equal(travelPage(undone, true)!.present, changes)
  assert.equal(commitPage(undone, { ...emptyPage(), deleted: ['front'] }).future.length, 0)
  assert.equal(base[0], ink)
})

test('宿主工具参数校验并合并部分属性，拒绝 NaN 和无效颜色', () => {
  const initial = defaultAnnotationState()
  const next = patchAnnotationState(initial, { tool: 'pen', brush: { width: NaN, color: 'url(evil)', opacity: 0.35 },
    eraser: { width: 100000 }, frozen: true })
  assert.equal(next.brush.width, initial.brush.width)
  assert.equal(next.brush.color, initial.brush.color)
  assert.equal(next.brush.opacity, 0.35)
  assert.equal(next.eraser.width, 512)
  assert.equal(next.frozen, true)
  assert.equal(initial.tool, 'play')
})
