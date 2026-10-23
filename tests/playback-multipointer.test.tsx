import assert from 'node:assert/strict'
import { test } from 'node:test'
import React, { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import { PlaybackSelectionOverlay } from '../src/components/selection/PlaybackSelectionOverlay'
import type { SlideData, SlideElement } from '../src/types'

const window = new Window()
Object.assign(globalThis, { window, document: window.document, HTMLElement: window.HTMLElement,
  SVGElement: window.SVGElement, Element: window.Element, ShadowRoot: window.ShadowRoot,
  getComputedStyle: window.getComputedStyle.bind(window), CSS: window.CSS, IS_REACT_ACT_ENVIRONMENT: true, React })
window.HTMLElement.prototype.setPointerCapture = function () {}
window.HTMLElement.prototype.hasPointerCapture = function () { return false }
window.HTMLElement.prototype.releasePointerCapture = function () {}

test('多指独立拖动不选中，单指结束/取消保留其他预览，轻点才选择', async () => {
  const initial: SlideElement[] = ['a', 'b', 'c'].map((id, index) => ({ type: 'shape', id,
    x: 40 + 200 * index, y: 50, width: 100, height: 60, backgroundColor: '#fff',
    foregroundColor: '#000', path: '', geometryType: 'Rectangle', canClone: id === 'c' }))
  let elements = initial
  let preview: SlideElement[] | null = null
  function Player() {
    const [current, setCurrent] = useState(initial)
    elements = current
    const slide = { id: 'page', width: 800, height: 600, elements: current } as SlideData
    return <PlaybackSelectionOverlay slide={slide} scale={1} elementDisplayStyles={{}}
      elementRenderStates={{}} resourceMap={{}} onPreview={value => { preview = value }}
      selection={{ enabled: true, onChange: changed => setCurrent(previous => previous.map(element =>
        changed.find(next => next.id === element.id) || element)),
      onDuplicate: added => setCurrent(previous => [...previous, ...added]), onCommand: () => {} }} />
  }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container as unknown as HTMLElement)
  await act(async () => root.render(<Player />))
  const surface = container.querySelector('[data-playback-selection]')!
  const pointer = async (type: string, pointerId: number, x: number, y = 70) => act(async () =>
    surface.dispatchEvent(new window.PointerEvent(type, { bubbles: true, pointerId,
      pointerType: 'touch', button: 0, clientX: x, clientY: y })))
  const selected = () => container.querySelector('[aria-label="旋转"]') !== null
  await pointer('pointerdown', 1, 60)
  await pointer('pointerdown', 2, 260)
  assert.equal(selected(), false)
  await pointer('pointermove', 1, 90)
  await pointer('pointermove', 2, 310, 90)
  assert.deepEqual(preview!.map(element => [element.id, element.x, element.y]), [['a', 70, 50], ['b', 290, 70]])
  // 第三个手指不能抢走已经在拖动的元素。
  await pointer('pointerdown', 3, 80)
  await pointer('pointermove', 3, 150)
  await pointer('pointerup', 3, 150)
  assert.equal(elements[0].x, 40)
  await pointer('pointerup', 1, 90)
  assert.equal(elements[0].x, 70)
  assert.deepEqual(preview!.map(element => element.id), ['b'])
  await pointer('pointermove', 2, 330, 100)
  await pointer('pointerup', 2, 330, 100)
  assert.deepEqual(elements.slice(0, 2).map(element => [element.x, element.y]), [[70, 50], [310, 80]])
  assert.equal(preview, null)
  assert.equal(selected(), false)
  await pointer('pointerdown', 4, 90)
  await pointer('pointerdown', 5, 330, 100)
  await pointer('pointermove', 4, 120)
  await pointer('pointermove', 5, 350, 100)
  await pointer('pointercancel', 4, 120)
  assert.equal(elements[0].x, 70)
  assert.deepEqual(preview!.map(element => element.id), ['b'])
  await pointer('pointerup', 5, 350, 100)
  assert.equal(elements[1].x, 330)
  // 未选中克隆源的直接拖动也不弹选框。
  await pointer('pointerdown', 6, 460)
  await pointer('pointermove', 6, 500)
  await pointer('pointerup', 6, 500)
  assert.equal(elements.length, 4)
  assert.equal(elements[2].x, 440)
  assert.equal(elements[3].x, 480)
  assert.equal(selected(), false)
  await pointer('pointerdown', 7, 90)
  assert.equal(selected(), false)
  await pointer('pointerup', 7, 90)
  assert.equal(selected(), true)
  await pointer('pointerdown', 8, 90)
  await pointer('pointermove', 8, 100)
  await pointer('pointerup', 8, 100)
  assert.equal(selected(), true)
  assert.equal(initial[0].x, 40)
  await act(async () => root.unmount())
})
