import assert from 'node:assert/strict'
import { test } from 'node:test'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import { resizeSelection, rotatePoint, selectionBounds, selectionContains, snapSelectionRotation, transformSelection } from '../src/viewer/selection-geometry'
import { lassoContains, lassoSelection } from '../src/viewer/selection-lasso'
import { SlideRenderer } from '../src/components/SlideRenderer'
import { usePlaybackSelection } from '../src/viewer/usePlaybackSelection'
import type { SlideData, SlideElement } from '../src/types'
import { cloneSelection } from '../src/viewer/selection-clone'
import { cropSelectionPicture } from '../src/viewer/selection-picture'
import { applySelectionFlags } from '../src/enbx/element-selection-flags'
import { SelectionActionButton } from '../src/components/selection/SelectionActionButton'

const window = new Window()
const messages: unknown[] = []
const listeners = new Set<(event: any) => void>()
Object.assign(window, { chrome: { webview: { postMessage: (message: unknown) => messages.push(message),
  addEventListener: (_: string, listener: any) => listeners.add(listener),
  removeEventListener: (_: string, listener: any) => listeners.delete(listener) } } })
Object.assign(globalThis, { window, document: window.document, HTMLElement: window.HTMLElement,
  SVGElement: window.SVGElement, Element: window.Element, ShadowRoot: window.ShadowRoot,
  CSS: window.CSS, getComputedStyle: window.getComputedStyle.bind(window), IS_REACT_ACT_ENVIRONMENT: true, React })
window.HTMLElement.prototype.setPointerCapture = function () {}
window.HTMLElement.prototype.hasPointerCapture = function () { return false }
window.HTMLElement.prototype.releasePointerCapture = function () {}

test('官方菜单按钮使用原几何和标称尺寸，鼠标/笔及克隆选中状态正确', async () => {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container as unknown as HTMLElement)
  await act(async () => root.render(<SelectionActionButton icon='Clone' label='克隆' />))
  let button = container.querySelector('button')!
  assert.equal(button.style.width, '64px')
  assert.equal(button.style.height, '56px')
  assert.equal(button.style.fontSize, '12px')
  assert.equal(button.style.borderRadius, '0px')
  assert.equal(button.querySelector('svg')!.getAttribute('viewBox'), '0 -0.0022554397583007812 24 24')
  assert.equal(button.querySelector('path')!.getAttribute('fill-rule'), 'evenodd')
  const pointer = async (type: string, pointerType: string) => act(async () => button.dispatchEvent(
    new window.PointerEvent(type, { bubbles: true, button: 0, pointerType })))
  await pointer('pointerover', 'pen')
  assert.equal(button.style.background, 'transparent')
  await pointer('pointerout', 'pen')
  await pointer('pointerover', 'mouse')
  assert.notEqual(button.style.background, 'transparent')
  const hover = button.style.background
  await pointer('pointerdown', 'mouse')
  assert.notEqual(button.style.background, hover)
  await act(async () => root.render(<SelectionActionButton icon='Clone' label='克隆' checked />))
  button = container.querySelector('button')!
  assert.equal(button.getAttribute('aria-pressed'), 'true')
  assert.equal(button.style.background, '#00c881')
  assert.equal(button.style.color, '#ffffff')
  await pointer('pointerup', 'mouse')
  assert.equal(button.style.background, '#00c881')
  await act(async () => root.render(<SelectionActionButton icon='Clone' label='克隆' checked disabled />))
  assert.equal(button.style.opacity, '0.4')
  await act(async () => root.unmount())
})

test('旋转元素按局部坐标命中，缩放保持对角，跨零度吸附', () => {
  const original = { x: 100, y: 100, width: 160, height: 40, rotation: 90 }
  assert.equal(selectionContains(original, { x: 180, y: 50 }), true)
  assert.equal(selectionContains(original, { x: 105, y: 120 }), false)
  for (const rotation of [0, 45, 90, 270]) {
    const from = { ...original, rotation }
    const to = resizeSelection(from, 'se', { x: 26, y: 37 })
    const anchor = (bounds: typeof from) => {
      const offset = rotatePoint({ x: -bounds.width / 2, y: -bounds.height / 2 }, bounds.rotation)
      return { x: bounds.x + bounds.width / 2 + offset.x, y: bounds.y + bounds.height / 2 + offset.y }
    }
    const start = anchor(from)
    const end = anchor(to as typeof from)
    assert.ok(Math.hypot(start.x - end.x, start.y - end.y) < 1e-8)
  }
  assert.equal(snapSelectionRotation(359, 20, 200, false, false), 0)
  assert.equal(snapSelectionRotation(14, 0, 200, true, false), 15)
  assert.equal(snapSelectionRotation(14, 0, 200, true, true), 14)
})

test('组合克隆隔离 ID 与原始 XML；旋转图片连续裁剪保持原像素位置', () => {
  const originals = ['a', 'b'].map(id => ({ type: 'shape', id, groupId: 'inner', groupAncestorIds: ['outer', 'inner'],
    x: 0, y: 0, width: 40, height: 40, canClone: true, rawXml: '<Shape/>',
    backgroundColor: '#fff', foregroundColor: '#000', path: '', geometryType: 'Rectangle' } as SlideElement))
  const clones = cloneSelection(originals)
  assert.notEqual(clones[0].id, originals[0].id)
  assert.notEqual(clones[0].groupId, 'inner')
  assert.equal(clones[0].groupId, clones[1].groupId)
  assert.equal(clones[0].groupAncestorIds?.[1], clones[0].groupId)
  assert.equal(clones[0].canClone, false)
  assert.equal(clones[0].rawXml, undefined)
  assert.equal(originals[0].canClone, true)
  const lockedGroup = new window.DOMParser().parseFromString('<Group><IsLocked>True</IsLocked><CanClone>True</CanClone></Group>', 'text/xml').documentElement
  const flagged = [...originals]
  applySelectionFlags(lockedGroup as unknown as Element, flagged, 0)
  assert.equal(flagged[1].isLocked, true)
  assert.equal(flagged[1].canClone, true)
  const picture: any = { type: 'picture', id: 'p', x: 100, y: 100, width: 200, height: 100, rotation: 90,
    displayRegion: { x: 20, y: 40, width: 400, height: 200 } }
  const cropped = cropSelectionPicture(picture, { left: 50, top: 0, right: 100, bottom: 100 }, { width: 800, height: 600 })
  assert.deepEqual(cropped.displayRegion, { x: 220, y: 40, width: 200, height: 200 })
  assert.equal(cropped.x, 150)
  assert.equal(cropped.y, 150)
  assert.equal(cropped.rotation, 90)
})

test('套索完整包围旋转边界，过滤锁定/隐藏元素并保持组合原子性', () => {
  const shape = (id: string, x: number, extra: object = {}): SlideElement => ({ type: 'shape', id,
    x, y: 30, width: 20, height: 20, backgroundColor: '#fff', foregroundColor: '#000',
    path: '', geometryType: 'Rectangle', ...extra })
  const polygon = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 0, y: 100 }]
  const elements = [shape('a', 20), shape('b', 60, { rotation: 45 }), shape('locked', 80, { isLocked: true }),
    shape('hidden', 100), shape('g1', 140, { groupId: 'g' }), shape('g2', 220, { groupId: 'g' }),
    shape('edge', 195), shape('locked-g1', 120, { groupId: 'locked-g' }),
    shape('locked-g2', 150, { groupId: 'locked-g', isLocked: true })]
  assert.equal(lassoContains(polygon, { x: 0, y: 50 }), true)
  assert.equal(lassoContains(polygon, { x: 201, y: 50 }), false)
  assert.deepEqual(lassoSelection(elements, polygon, element => !element.isLocked && element.id !== 'hidden')
    .map(element => element.id), ['a', 'b'])
  assert.deepEqual(lassoSelection(elements, polygon.slice(0, 2)), [])
  const concave = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 },
    { x: 55, y: 100 }, { x: 55, y: 25 }, { x: 45, y: 25 }, { x: 45, y: 100 }, { x: 0, y: 100 }]
  assert.deepEqual(lassoSelection([shape('cut', 30, { width: 40, height: 40 })], concave), [])
  const selected = elements.slice(0, 2)
  const from = selectionBounds(selected)
  const next = transformSelection(selected, from, { ...from, x: from.x + 25, y: from.y + 10 })
  assert.deepEqual(next.map(element => [element.id, element.x, element.y]), [['a', 45, 40], ['b', 85, 40]])
  const rotated = transformSelection(selected, from, { ...from, rotation: 90 })
  assert.deepEqual(rotated.map(element => 'rotation' in element && element.rotation), [90, 135])
  const resized = transformSelection(selected, from, { ...from, width: from.width * 2, height: from.height * 2 })
  assert.deepEqual(resized.map(element => element.width), [40, 40])
})

test('套索多选可整体拖动、取消、追加、删除；跨页清空选择状态', async () => {
  const { usePlaybackSelection: useSelection } = await import('../src/viewer/usePlaybackSelection')
  const shape = (id: string, x: number): SlideElement => ({ type: 'shape', id, x, y: 50, width: 60, height: 60,
    backgroundColor: '#ffffff', foregroundColor: '#000000', path: 'M0 0H60V60H0Z', geometryType: 'Rectangle' })
  const pages: SlideData[] = ['a', 'b'].map(id => ({ id, width: 800, height: 600, backgroundColor: '#fff',
    elements: [shape(`${id}1`, 40), shape(`${id}2`, 200), shape(`${id}3`, 400)],
    animationOrders: [], animations: [], issues: [] }))
  let selection: ReturnType<typeof usePlaybackSelection> | null = null
  let index = 0
  const metadata: any = { name: 'lasso' }
  function Player() {
    const state = useSelection(pages, index, metadata)
    selection = state
    return <SlideRenderer slide={state.slides[index]} scale={1} playbackSelection={state.selection} />
  }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container as unknown as HTMLElement)
  await act(async () => root.render(<Player />))
  await act(async () => listeners.forEach(listener => listener({ data: { type: 'enbx:set-interaction-mode', mode: 'select' } })))
  const pointer = async (type: string, x: number, y: number, shiftKey = false) => act(async () =>
    container.querySelector('[data-playback-selection]')!.dispatchEvent(new window.PointerEvent(type,
      { bubbles: true, pointerId: 1, button: 0, clientX: x, clientY: y, shiftKey })))
  const enclose = async (cancel = false, shift = false, left = 20, right = 280) => {
    await pointer('pointerdown', left, 20, shift)
    await pointer('pointermove', right, 20)
    await pointer('pointermove', right, 130)
    await pointer('pointermove', left, 130)
    assert.ok(container.querySelector('[data-selection-lasso]'))
    await pointer(cancel ? 'pointercancel' : 'pointerup', left, 20)
  }
  await enclose(true)
  assert.equal(container.querySelector('[role="toolbar"]'), null)
  assert.equal(container.querySelector('[aria-label="旋转"]'), null)
  await enclose()
  assert.ok(container.querySelector('[aria-label="旋转"]'))
  assert.equal(container.querySelector('[data-selection-lasso]'), null)
  // Blank space inside the shared bounds moves the whole selection.
  await pointer('pointerdown', 150, 80)
  await pointer('pointermove', 180, 100)
  await pointer('pointerup', 180, 100)
  assert.deepEqual(selection!.slides[0].elements.map(element => [element.x, element.y]), [[70, 70], [230, 70], [400, 50]])
  assert.deepEqual(pages[0].elements.map(element => element.x), [40, 200, 400])
  const handle = async (label: string, x: number, y: number) => act(async () =>
    container.querySelector(`[aria-label="${label}"]`)!.dispatchEvent(new window.PointerEvent('pointerdown',
      { bubbles: true, pointerId: 1, button: 0, clientX: x, clientY: y })))
  await handle('缩放 se', 290, 130)
  await pointer('pointermove', 400, 160)
  await pointer('pointerup', 400, 160)
  assert.equal(selection!.slides[0].elements[0].width, 90)
  assert.equal(selection!.slides[0].elements[0].x, 70)
  await handle('旋转', 235, 42)
  await pointer('pointermove', 335, 115)
  await pointer('pointerup', 335, 115)
  assert.deepEqual(selection!.slides[0].elements.slice(0, 2).map(element => 'rotation' in element && element.rotation), [90, 90])
  // Cancel a lasso without losing the existing multi-selection.
  await enclose(true, false, 500, 600)
  await enclose(false, true, 380, 480)
  await act(async () => Array.from(container.querySelectorAll('button')).find(button => button.textContent === '克隆')!.click())
  assert.ok(selection!.slides[0].elements.every(element => element.canClone))
  await pointer('pointerdown', 420, 80)
  await pointer('pointermove', 450, 110)
  await pointer('pointerup', 450, 110)
  assert.equal(selection!.slides[0].elements.length, 6)
  assert.ok(selection!.slides[0].elements.slice(3).every(element => !element.canClone))
  // Dragged copies become the current selection; delete does not remove sources.
  await act(async () => Array.from(container.querySelectorAll('button')).find(button => button.textContent === '删除')!.click())
  assert.deepEqual(selection!.slides[0].elements.map(element => element.id), ['a1', 'a2', 'a3'])
  index = 1
  await act(async () => root.render(<Player />))
  assert.equal(container.querySelector('[aria-label="旋转"]'), null)
  await act(async () => root.unmount())
})

test('播放选择消费点击、取消预览；提交、置顶、删除跨页保留且不修改原始页面', async () => {
  // host-bridge 在导入时绑定 window，故在建立浏览器环境后导入会话 hook。
  const { usePlaybackSelection: useSelection } = await import('../src/viewer/usePlaybackSelection')
  const shape = (id: string, x: number): SlideElement => ({ type: 'shape', id, x, y: 50, width: 100, height: 60,
    backgroundColor: '#ffffff', foregroundColor: '#000000', path: 'M0 0H100V60H0Z', geometryType: 'Rectangle' })
  const pages: SlideData[] = ['a', 'b'].map(id => ({ id, width: 800, height: 600, backgroundColor: '#fff',
    elements: [shape(`${id}1`, 40), shape(`${id}2`, 300)], animationOrders: [], animations: [], issues: [] }))
  const metadata: any = { name: 'test' }
  let index = 0
  let selection: ReturnType<typeof usePlaybackSelection> | null = null
  let animationClicks = 0
  function Player() {
    const state = useSelection(pages, index, metadata)
    selection = state
    return <SlideRenderer slide={state.slides[index]} scale={1} playbackSelection={state.selection}
      onElementClick={() => { animationClicks += 1; return true }} />
  }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container as unknown as HTMLElement)
  await act(async () => root.render(<Player />))
  await act(async () => listeners.forEach(listener => listener({ data: { type: 'enbx:set-interaction-mode', mode: 'select' } })))
  const surface = container.querySelector('[data-playback-selection]')!
  assert.ok(surface)
  const pointer = async (type: string, x: number, y: number) => act(async () => surface.dispatchEvent(
    new window.PointerEvent(type, { bubbles: true, pointerId: 1, button: 0, clientX: x, clientY: y })
  ))
  await pointer('pointerdown', 60, 60)
  await pointer('pointermove', 100, 80)
  await pointer('pointercancel', 100, 80)
  assert.equal(selection!.slides[0].elements[0].x, 40)
  await pointer('pointerdown', 60, 60)
  await pointer('pointermove', 100, 80)
  await pointer('pointerup', 100, 80)
  assert.equal(selection!.slides[0].elements[0].x, 80)
  assert.equal(pages[0].elements[0].x, 40)
  await act(async () => surface.dispatchEvent(new window.MouseEvent('click', { bubbles: true, clientX: 100, clientY: 80 })))
  assert.equal(animationClicks, 0)
  const buttons = Array.from(container.querySelectorAll('button'))
  assert.deepEqual(buttons.map(button => button.textContent), ['描边', '填充', '置顶', '克隆', '删除'])
  assert.ok(!container.textContent?.includes('撤销'))
  await act(async () => buttons.find(button => button.textContent === '置顶')!.click())
  assert.deepEqual(selection!.slides[0].elements.map(element => element.id), ['a2', 'a1'])
  await act(async () => Array.from(container.querySelectorAll('button')).find(button => button.textContent === '克隆')!.click())
  assert.equal(selection!.slides[0].elements.find(element => element.id === 'a1')!.canClone, true)
  await pointer('pointerdown', 100, 80)
  await pointer('pointermove', 150, 90)
  assert.equal(container.querySelectorAll('[data-element-id]').length, 3)
  await pointer('pointercancel', 150, 90)
  assert.equal(selection!.slides[0].elements.length, 2)
  await pointer('pointerdown', 100, 80)
  await pointer('pointermove', 150, 90)
  await pointer('pointerup', 150, 90)
  const clone = selection!.slides[0].elements[2]
  assert.equal(clone.x, 130)
  assert.equal(clone.canClone, false)
  assert.equal(selection!.slides[0].elements.find(element => element.id === 'a1')!.x, 80)
  await act(async () => selection!.selection.onCommand('delete', [clone.id]))
  index = 1
  await act(async () => root.render(<Player />))
  index = 0
  await act(async () => root.render(<Player />))
  assert.equal(selection!.slides[0].elements.find(element => element.id === 'a1')!.x, 80)
  await act(async () => selection!.selection.onCommand('delete', ['a1']))
  assert.deepEqual(selection!.slides[0].elements.map(element => element.id), ['a2'])
  await act(async () => listeners.forEach(listener => listener({ data: { type: 'enbx:set-interaction-mode', mode: 'play' } })))
  assert.equal(container.querySelector('[data-playback-selection]'), null)
  await act(async () => root.unmount())
})
