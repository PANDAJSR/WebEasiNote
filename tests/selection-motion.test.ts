import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { SlideElement } from '../src/types'
import { interpolateSelectionBounds, SelectionPreviewMotion, selectionAngleDelta } from '../src/viewer/selection-motion'
import { moveSelectionGesture, pinchSelection, rebaseSelectionGesture, snapTouchRotation,
  type SelectionGesture } from '../src/viewer/selection-gesture'
import { selectionBounds, transformSelection } from '../src/viewer/selection-geometry'

const close = (value: number, expected: number) => assert.ok(Math.abs(value - expected) < 1e-8, `${value} != ${expected}`)
const shape = (id: string, x = 0, rotation = 0) => ({ type: 'shape', id, x, y: 0,
  width: 100, height: 100, rotation, path: '', geometryType: 'Rectangle' } as SlideElement)
const angle = (element: SlideElement) => (element as { rotation: number }).rotation

function clock() {
  let sequence = 0
  let time = 0
  const frames = new Map<number, (time: number) => void>()
  return {
    request: (callback: (time: number) => void) => { frames.set(++sequence, callback); return sequence },
    cancel: (id: number) => { frames.delete(id) },
    step: (elapsed = 1000 / 60) => {
      time += elapsed
      const callbacks = [...frames.values()]
      frames.clear()
      callbacks.forEach(callback => callback(time))
    },
    get pending() { return frames.size }
  }
}

test('平滑按耗时插值，跨 360° 走最短弧，60/120 Hz 收敛一致', () => {
  const from = { x: 0, y: 0, width: 100, height: 100, rotation: 359 }
  const to = { x: 100, y: 20, width: 200, height: 200, rotation: 1 }
  const first = interpolateSelectionBounds(from, to, 16)
  assert.ok(first.rotation! > 359 && first.rotation! < 361)
  assert.ok(first.x > 0 && first.x < 100)
  let sixty = from
  let oneTwenty = from
  for (let index = 0; index < 6; index++) sixty = interpolateSelectionBounds(sixty, to, 1000 / 60) as typeof from
  for (let index = 0; index < 12; index++) oneTwenty = interpolateSelectionBounds(oneTwenty, to, 1000 / 120) as typeof from
  close(sixty.x, oneTwenty.x)
  close(sixty.rotation, oneTwenty.rotation)
})

test('低频输入之间仍逐帧跟随，目标更新不重启动画，松手精确收敛并清理', () => {
  const frames = clock()
  let display: SlideElement[] = []
  const motion = new SelectionPreviewMotion(frames, elements => { display = elements })
  const origin = [shape('a')]
  let elements = [{ ...origin[0], rotation: 40 } as SlideElement]
  const update = () => motion.update([{ origin, elements, selected: true, smooth: true }], 1)
  update()
  close(angle(display[0]), 0)
  frames.step()
  const first = angle(display[0])
  frames.step()
  assert.ok(angle(display[0]) > first && angle(display[0]) < 40)
  elements = [{ ...origin[0], rotation: 90 } as SlideElement]
  const previous = angle(display[0])
  update()
  close(angle(display[0]), previous)
  assert.equal(frames.pending, 1)
  frames.step()
  assert.ok(angle(display[0]) > previous && angle(display[0]) < 90)
  motion.update([], 1, true)
  assert.equal(display.length, 1)
  for (let index = 0; index < 30; index++) frames.step()
  assert.equal(display.length, 0)
  assert.equal(frames.pending, 0)
})

test('组合旋转平滑保留成员间距、等比尺寸与相对角度，180° 中途不会挤在一起', () => {
  const frames = clock()
  let display: SlideElement[] = []
  const origin = [shape('a'), shape('b', 200, 30)]
  const from = selectionBounds(origin)
  const elements = transformSelection(origin, from, { ...from, width: from.width * 2, height: from.height * 2, rotation: 180 })
  const motion = new SelectionPreviewMotion(frames, value => { display = value })
  motion.update([{ origin, elements, smooth: true, selected: true }], 1)
  frames.step()
  const distance = Math.hypot(display[1].x - display[0].x, display[1].y - display[0].y)
  close(distance, 200 * display[0].width / 100)
  close(selectionAngleDelta(angle(display[0]), angle(display[1])), 30)
  for (let index = 0; index < 40; index++) frames.step()
  assert.deepEqual(display, elements)
  motion.dispose()
})

test('取消及卸载清除尾帧；不同手势之间互不取消，鼠标直接跟随', () => {
  const frames = clock()
  let display: SlideElement[] = []
  const origin = [shape('a')]
  const other = [shape('b', 200)]
  const motion = new SelectionPreviewMotion(frames, value => { display = value })
  motion.update([{ origin, elements: [{ ...origin[0], rotation: 90 } as SlideElement], selected: true, smooth: true },
    { origin: other, elements: [{ ...other[0], x: 300 }], selected: false, smooth: false }], 1)
  close(display[1].x, 300)
  frames.step()
  motion.clear(['a'])
  frames.step()
  assert.deepEqual(display.map(element => element.id), ['b'])
  motion.clear()
  assert.equal(frames.pending, 0)
  frames.step()
  assert.deepEqual(display, [])
  motion.update([{ origin, elements: [{ ...origin[0], rotation: 90 } as SlideElement], selected: true, smooth: true }], 1)
  motion.dispose()
  assert.equal(frames.pending, 0)
})

test('绝对直角吸附包含跨零度，6° 进入、10° 脱离，不吸附任意起始角度', () => {
  for (const target of [0, 90, 180, 270, 360]) {
    const snapped = ((target % 360) + 360) % 360
    assert.equal(snapTouchRotation(target - 5).angle, snapped)
    assert.equal(snapTouchRotation(target + 5).angle, snapped)
    assert.equal(snapTouchRotation(target + 8, snapped).angle, snapped)
    assert.equal(snapTouchRotation(target + 11, snapped).snapped, null)
    assert.equal(snapTouchRotation(target + 7).snapped, null)
  }
  assert.equal(snapTouchRotation(31).angle, 31)
})

test('已旋转元素双指按页面绝对 90° 吸附；以触点中点为锚点', () => {
  const origin = [shape('a', 0, 30)]
  const bounds = selectionBounds(origin)
  const gesture: SelectionGesture = { kind: 'transform', touch: true, selected: true, original: origin, basis: origin,
    bounds, next: null, clones: null, cloneOnMove: false, pointers: new Map([
      [1, { start: { x: 20, y: 30 }, position: { x: 20, y: 30 } }],
      [2, { start: { x: 80, y: 30 }, position: { x: 80, y: 30 } }]
    ]) }
  const degrees = 57 * Math.PI / 180
  const position = { x: 20 + 60 * Math.cos(degrees), y: 30 + 60 * Math.sin(degrees) }
  moveSelectionGesture(gesture, 2, position, 1, { shiftKey: false, ctrlKey: false, altKey: false })
  close(angle(gesture.next![0]), 90)
  const expected = pinchSelection(bounds, [{ x: 20, y: 30 }, { x: 80, y: 30 }], [{ x: 20, y: 30 }, position], 90)
  close(gesture.next![0].x, expected.x)
  close(gesture.next![0].y, expected.y)
  rebaseSelectionGesture(gesture)
  assert.equal(gesture.rotationBase, 90)
})

test('组合抬起再接入双指后继续以页面方向吸附，而不是相对手势起点', () => {
  const origin = [shape('a'), shape('b', 200)]
  const gesture: SelectionGesture = { kind: 'transform', touch: true, selected: true, original: origin, basis: origin,
    bounds: selectionBounds(origin), next: null, clones: null, cloneOnMove: false,
    pointers: new Map([[1, { start: { x: 0, y: 0 }, position: { x: 0, y: 0 } }],
      [2, { start: { x: 100, y: 0 }, position: { x: 100, y: 0 } }]]) }
  const move = (degrees: number) => moveSelectionGesture(gesture, 2,
    { x: 100 * Math.cos(degrees * Math.PI / 180), y: 100 * Math.sin(degrees * Math.PI / 180) }, 1,
    { shiftKey: false, ctrlKey: false, altKey: false })
  move(30)
  rebaseSelectionGesture(gesture)
  move(87)
  close(angle(gesture.next![0]), 90)
  close(angle(gesture.next![1]), 90)
})
