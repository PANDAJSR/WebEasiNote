import assert from 'node:assert/strict'
import { test } from 'node:test'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import { resizeSelection, rotatePoint, selectionContains, snapSelectionRotation } from '../src/viewer/selection-geometry'
import { SlideRenderer } from '../src/components/SlideRenderer'
import { usePlaybackSelection } from '../src/viewer/usePlaybackSelection'
import type { SlideData, SlideElement } from '../src/types'
import { cloneSelection } from '../src/viewer/selection-clone'
import { cropSelectionPicture } from '../src/viewer/selection-picture'
import { applySelectionFlags } from '../src/enbx/element-selection-flags'

const window = new Window()
const messages: unknown[] = []
const listeners = new Set<(event: any) => void>()
Object.assign(window, { chrome: { webview: { postMessage: (message: unknown) => messages.push(message),
  addEventListener: (_: string, listener: any) => listeners.add(listener),
  removeEventListener: (_: string, listener: any) => listeners.delete(listener) } } })
Object.assign(globalThis, { window, document: window.document, HTMLElement: window.HTMLElement,
  CSS: window.CSS, getComputedStyle: window.getComputedStyle.bind(window), IS_REACT_ACT_ENVIRONMENT: true, React })
window.HTMLElement.prototype.setPointerCapture = function () {}
window.HTMLElement.prototype.hasPointerCapture = function () { return false }
window.HTMLElement.prototype.releasePointerCapture = function () {}

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
  assert.deepEqual(buttons.map(button => button.textContent), ['置顶', '克隆', '删除'])
  assert.ok(!container.textContent?.includes('撤销'))
  await act(async () => buttons[0].click())
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
