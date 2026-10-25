import assert from 'node:assert/strict'
import { test } from 'node:test'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import { SlideRenderer } from '../src/components/SlideRenderer'
import { usePlaybackSelection } from '../src/viewer/usePlaybackSelection'
import { pinchSelection } from '../src/viewer/selection-gesture'
import { rotatePoint, selectionBounds, transformSelection } from '../src/viewer/selection-geometry'
import type { SlideData, SlideElement } from '../src/types'

const window = new Window()
let frameId = 0
let frameTime = 0
const frames = new Map<number, FrameRequestCallback>()
window.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId }
window.cancelAnimationFrame = id => { frames.delete(id) }
const tick = async (count = 1) => {
  for (let index = 0; index < count; index++) await act(async () => {
    frameTime += 1000 / 60
    const callbacks = [...frames.values()]
    frames.clear()
    callbacks.forEach(callback => callback(frameTime))
  })
}
Object.assign(globalThis, { window, document: window.document, HTMLElement: window.HTMLElement,
  SVGElement: window.SVGElement, Element: window.Element, ShadowRoot: window.ShadowRoot,
  CSS: window.CSS, getComputedStyle: window.getComputedStyle.bind(window), IS_REACT_ACT_ENVIRONMENT: true, React })
// 模拟真实的捕获丢失事件，验证一指释放不会取消仍在进行的双指事务。
const captures = new WeakMap<object, Set<number>>()
window.HTMLElement.prototype.setPointerCapture = function (id: number) {
  if (!captures.has(this)) captures.set(this, new Set())
  captures.get(this)!.add(id)
}
window.HTMLElement.prototype.hasPointerCapture = function (id: number) { return captures.get(this)?.has(id) || false }
window.HTMLElement.prototype.releasePointerCapture = function (id: number) {
  captures.get(this)?.delete(id)
  this.dispatchEvent(new window.PointerEvent('lostpointercapture', { bubbles: true, pointerId: id }))
}

const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`)
const shape = (id: string, x: number, extra: object = {}): SlideElement => ({ type: 'shape', id,
  x, y: 100, width: 200, height: 100, backgroundColor: '#ffffff', foregroundColor: '#000000',
  path: 'M0 0H200V100H0Z', geometryType: 'Rectangle', ...extra })

async function player(elements = [shape('a', 100), shape('b', 500)], scale = 1) {
  // host-bridge 在导入时读取 window。
  const { usePlaybackSelection: useSelection } = await import('../src/viewer/usePlaybackSelection')
  const pages: SlideData[] = [{ id: 'touch', width: 1000, height: 700, backgroundColor: '#fff',
    elements, animationOrders: [], animations: [], issues: [] }]
  const metadata: any = { name: 'touch' }
  let state: ReturnType<typeof usePlaybackSelection>
  function Player() {
    state = useSelection(pages, 0, metadata)
    return <SlideRenderer slide={state.slides[0]} scale={scale} playbackSelection={state.selection} />
  }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container as unknown as HTMLElement)
  await act(async () => root.render(<Player />))
  await act(async () => state!.selection.annotation!.setState({ tool: 'select' }))
  const surface = () => container.querySelector('[data-playback-selection]')!
  const pointer = async (type: string, id: number, x: number, y: number, target = surface()) => act(async () =>
    target.dispatchEvent(new window.PointerEvent(type, { bubbles: true, pointerId: id, pointerType: 'touch',
      button: 0, clientX: x * scale, clientY: y * scale })))
  const select = async () => {
    await pointer('pointerdown', 1, 150, 150)
    await pointer('pointerup', 1, 150, 150)
  }
  return { container, get surface() { return surface() }, pointer, select, get state() { return state! },
    undo: async () => act(async () => state!.selection.annotation!.command('undo')),
    unmount: async () => { await act(async () => root.unmount()); container.remove() } }
}

test('双指变换绕触点中点保持内容位置，组合和已旋转元素等比缩放', () => {
  const elements = [shape('a', 100, { rotation: 30 }), shape('b', 400, { rotation: 90 })]
  const starts = [{ x: 130, y: 140 }, { x: 230, y: 140 }]
  const positions = [{ x: 250, y: 200 }, { x: 250, y: 400 }]
  for (const members of [[elements[0]], elements]) {
    const from = selectionBounds(members)
    const to = pinchSelection(from, starts, positions)
    const result = transformSelection(members, from, to)
    members.forEach((element, index) => {
      const offset = rotatePoint({ x: (element.x + element.width / 2 - 180) * 2,
        y: (element.y + element.height / 2 - 140) * 2 }, 90)
      close(result[index].x + result[index].width / 2, 250 + offset.x)
      close(result[index].y + result[index].height / 2, 300 + offset.y)
      close(result[index].width, element.width * 2)
      close(result[index].height, element.height * 2)
      close((result[index] as any).rotation, (element as any).rotation + 90)
    })
  }
  const from = selectionBounds([elements[0]])
  const collapsed = pinchSelection(from, starts, [starts[0], starts[0]])
  assert.ok(Number.isFinite(collapsed.rotation))
  close(collapsed.height, 8)
  close(collapsed.width / collapsed.height, 2)
  assert.deepEqual(pinchSelection(from, [starts[0], starts[0]], positions), from)
})

test('选中元素双指缩放旋转，一指抬起继续拖动，整次手势一次撤销；支持页面缩放', async () => {
  const view = await player(undefined, 0.5)
  try {
    await view.select()
    await view.pointer('pointerdown', 1, 150, 150)
    await view.pointer('pointerdown', 2, 250, 150)
    // 无移动的第三指和双指轻触不产生变更。
    await view.pointer('pointerdown', 3, 200, 150)
    await view.pointer('pointermove', 3, 210, 160)
    await view.pointer('pointerup', 3, 210, 160)
    await view.pointer('pointerup', 2, 250, 150)
    await view.pointer('pointerup', 1, 150, 150)
    assert.equal(view.state.selection.annotation!.canUndo, false)
    await view.pointer('pointerdown', 1, 150, 150)
    await view.pointer('pointerdown', 2, 250, 150)
    await view.pointer('pointermove', 1, 200, 50)
    await view.pointer('pointermove', 2, 200, 250)
    assert.equal(view.container.querySelector('[role="toolbar"]'), null)
    // 预览期间不提交页面历史。
    assert.equal(view.state.slides[0].elements[0].width, 200)
    await view.pointer('pointerup', 1, 200, 50)
    assert.equal(view.surface.hasPointerCapture(2), true)
    await view.pointer('pointermove', 2, 230, 270)
    await view.pointer('pointerup', 2, 230, 270)
    const result = view.state.slides[0].elements[0] as any
    close(result.width, 400)
    close(result.height, 200)
    close(result.rotation, 90)
    close(result.x, 30)
    close(result.y, 70)
    await view.undo()
    assert.deepEqual(view.state.slides[0].elements[0], shape('a', 100))
    assert.equal(view.state.selection.annotation!.canUndo, false)
  } finally { await view.unmount() }
})

test('单指移动后第二指命中预览位置，接入和退出双指均不跳动', async () => {
  const view = await player()
  try {
    await view.select()
    await view.pointer('pointerdown', 1, 150, 150)
    await view.pointer('pointermove', 1, 350, 150)
    await view.pointer('pointerdown', 2, 450, 150)
    await view.pointer('pointermove', 2, 450, 150)
    await view.pointer('pointermove', 1, 300, 150)
    await view.pointer('pointermove', 2, 500, 150)
    await view.pointer('pointerup', 2, 500, 150)
    await view.pointer('pointermove', 1, 310, 170)
    await view.pointer('pointerup', 1, 310, 170)
    const result = view.state.slides[0].elements[0]
    close(result.x, 210)
    close(result.y, 70)
    close(result.width, 400)
    await view.undo()
    close(view.state.slides[0].elements[0].x, 100)
    assert.equal(view.state.selection.annotation!.canUndo, false)
  } finally { await view.unmount() }
})

test('任一触点取消或丢失捕获时撤销整个双指预览，并释放两个触点', async () => {
  const view = await player()
  try {
    await view.select()
    for (const [type, id] of [['pointercancel', 1], ['lostpointercapture', 2]] as const) {
      await view.pointer('pointerdown', 1, 150, 150)
      await view.pointer('pointerdown', 2, 250, 150)
      await view.pointer('pointermove', 2, 290, 180)
      await view.pointer(type, id, 150, 150)
      assert.equal(view.surface.hasPointerCapture(1), false)
      assert.equal(view.surface.hasPointerCapture(2), false)
      await view.pointer('pointerup', 1, 150, 150)
      await view.pointer('pointerup', 2, 290, 180)
      assert.deepEqual(view.state.slides[0].elements[0], shape('a', 100))
      assert.equal(view.state.selection.annotation!.canUndo, false)
      assert.ok(view.container.querySelector('[role="toolbar"]'))
    }
  } finally { await view.unmount() }
})

test('不同元素保留独立触点拖动，组合可以双指整体变换', async () => {
  const view = await player()
  try {
    await view.pointer('pointerdown', 1, 150, 150)
    await view.pointer('pointerdown', 2, 550, 150)
    await view.pointer('pointermove', 1, 170, 160)
    await view.pointer('pointermove', 2, 580, 170)
    await view.pointer('pointerup', 1, 170, 160)
    await view.pointer('pointerup', 2, 580, 170)
    assert.deepEqual(view.state.slides[0].elements.map(element => [element.x, element.y]), [[120, 110], [530, 120]])
  } finally { await view.unmount() }
  const group = await player([shape('a', 100, { groupId: 'g' }), shape('b', 500, { groupId: 'g' })])
  try {
    await group.select()
    await group.pointer('pointerdown', 1, 200, 150)
    await group.pointer('pointerdown', 2, 600, 150)
    await group.pointer('pointermove', 1, 400, -250)
    await group.pointer('pointermove', 2, 400, 550)
    await group.pointer('pointerup', 2, 400, 550)
    await group.pointer('pointerup', 1, 400, -250)
    const elements = group.state.slides[0].elements as any[]
    close(elements[0].width, 400)
    close(elements[1].width, 400)
    close(elements[0].rotation, 90)
    close(elements[1].rotation, 90)
    close(elements[1].y - elements[0].y, 800)
    await group.undo()
    assert.equal(group.state.selection.annotation!.canUndo, false)
  } finally { await group.unmount() }
})

test('克隆拖动接入双指只生成一份副本，取消时不留下副本', async () => {
  const view = await player([shape('a', 100, { canClone: true })])
  try {
    await view.select()
    for (const cancel of [true, false]) {
      await view.pointer('pointerdown', 1, 150, 150)
      await view.pointer('pointermove', 1, 350, 150)
      await view.pointer('pointerdown', 2, 450, 150)
      await view.pointer('pointermove', 2, 500, 150)
      await view.pointer(cancel ? 'pointercancel' : 'pointerup', 2, 500, 150)
      await view.pointer('pointerup', 1, 350, 150)
      assert.equal(view.state.slides[0].elements.length, cancel ? 1 : 2)
      assert.deepEqual(view.state.slides[0].elements[0], shape('a', 100, { canClone: true }))
    }
    assert.equal(view.state.slides[0].elements[1].canClone, false)
    close(view.state.slides[0].elements[1].width, 300)
    await view.undo()
    assert.equal(view.state.slides[0].elements.length, 1)
    assert.equal(view.state.selection.annotation!.canUndo, false)
  } finally { await view.unmount() }
})

test('套索多选支持双指整体变换，鼠标和笔不接入触摸手势', async () => {
  const view = await player()
  try {
    await view.pointer('pointerdown', 1, 50, 50)
    await view.pointer('pointermove', 1, 750, 50)
    await view.pointer('pointermove', 1, 750, 250)
    await view.pointer('pointermove', 1, 50, 250)
    await view.pointer('pointerup', 1, 50, 50)
    await view.pointer('pointerdown', 1, 200, 150)
    for (const pointerType of ['mouse', 'pen']) {
      await act(async () => view.surface.dispatchEvent(new window.PointerEvent('pointerdown', {
        bubbles: true, pointerId: 10, pointerType, button: 0, clientX: 600, clientY: 150 })))
      assert.equal(view.surface.hasPointerCapture(10), false)
    }
    await view.pointer('pointerdown', 2, 600, 150)
    await view.pointer('pointermove', 2, 800, 150)
    await view.pointer('pointerup', 1, 200, 150)
    await view.pointer('pointerup', 2, 800, 150)
    const elements = view.state.slides[0].elements
    close(elements[0].width, 300)
    close(elements[1].width, 300)
    close(elements[1].x - elements[0].x, 600)
    await view.undo()
    assert.equal(view.state.selection.annotation!.canUndo, false)
  } finally { await view.unmount() }
})

test('克隆源直接双指缩放后继续单指拖动不会意外生成副本', async () => {
  const view = await player([shape('a', 100, { canClone: true })])
  try {
    await view.select()
    await view.pointer('pointerdown', 1, 150, 150)
    await view.pointer('pointerdown', 2, 250, 150)
    await view.pointer('pointermove', 2, 300, 150)
    await view.pointer('pointerup', 2, 300, 150)
    await view.pointer('pointermove', 1, 170, 170)
    await view.pointer('pointerup', 1, 170, 170)
    assert.equal(view.state.slides[0].elements.length, 1)
    close(view.state.slides[0].elements[0].width, 300)
    await view.undo()
    assert.deepEqual(view.state.slides[0].elements[0], shape('a', 100, { canClone: true }))
  } finally { await view.unmount() }
})

test('几乎重合的初始双指分开时不产生无限缩放，触摸控制点仍可加入双指', async () => {
  const view = await player()
  try {
    await view.select()
    await view.pointer('pointerdown', 1, 150, 150)
    await view.pointer('pointerdown', 2, 150, 150)
    await view.pointer('pointermove', 2, 250, 150)
    await view.pointer('pointermove', 2, 300, 150)
    await view.pointer('pointerup', 2, 300, 150)
    await view.pointer('pointerup', 1, 150, 150)
    close(view.state.slides[0].elements[0].width, 300)
    await view.undo()
    await view.select()
    const handle = view.container.querySelector('[aria-label="缩放 se"]')!
    await view.pointer('pointerdown', 1, 300, 200, handle)
    await view.pointer('pointerdown', 2, 150, 150)
    await view.pointer('pointermove', 1, 450, 250)
    await view.pointer('pointerup', 2, 150, 150)
    await view.pointer('pointerup', 1, 450, 250)
    close(view.state.slides[0].elements[0].width, 400)
    close(view.state.slides[0].elements[0].height, 200)
  } finally { await view.unmount() }
})

test('DOM 预览在稀疏输入之间连续插值，松手平滑吸附绝对 90°，撤销和卸载不留动画', async () => {
  const view = await player()
  const displayedAngle = () => {
    const box = view.container.querySelector('[aria-label="旋转"]')!.parentElement as HTMLElement
    return Number(box.style.transform.match(/rotate\(([^d]+)deg\)/)![1])
  }
  try {
    await view.select()
    await view.pointer('pointerdown', 1, 150, 150)
    await view.pointer('pointerdown', 2, 250, 150)
    const radians = 87 * Math.PI / 180
    const x = 150 + 100 * Math.cos(radians)
    const y = 150 + 100 * Math.sin(radians)
    await view.pointer('pointermove', 2, x, y)
    close(displayedAngle(), 0)
    await tick()
    const first = displayedAngle()
    assert.ok(first > 0 && first < 90)
    await tick()
    assert.ok(displayedAngle() > first && displayedAngle() < 90)
    await view.pointer('pointerup', 2, x, y)
    await view.pointer('pointerup', 1, 150, 150)
    close((view.state.slides[0].elements[0] as any).rotation, 90)
    assert.ok(displayedAngle() < 90)
    await tick(35)
    close(displayedAngle(), 90)
    assert.equal(frames.size, 0)
    assert.ok(view.container.querySelector('[role="toolbar"]'))
    await view.undo()
    assert.equal(view.state.selection.annotation!.canUndo, false)
    await view.select()
    await view.pointer('pointerdown', 1, 150, 150)
    await view.pointer('pointerdown', 2, 250, 150)
    await view.pointer('pointermove', 2, x, y)
    await tick()
    assert.ok(frames.size)
    await view.pointer('pointercancel', 1, 150, 150)
    assert.equal(frames.size, 0)
    close(displayedAngle(), 0)
    await view.pointer('pointerdown', 1, 150, 150)
    await view.pointer('pointerdown', 2, 250, 150)
    await view.pointer('pointermove', 2, x, y)
    assert.ok(frames.size)
  } finally { await view.unmount() }
  assert.equal(frames.size, 0)
})
