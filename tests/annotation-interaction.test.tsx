import assert from 'node:assert/strict'
import { test } from 'node:test'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import type { InkElement, SlideData, SlideElement } from '../src/types'
import { createInk } from '../src/viewer/annotation/ink-geometry'

const window = new Window()
const messages: any[] = []
const listeners = new Set<(event: any) => void>()
Object.assign(window, { chrome: { webview: { postMessage: (message: unknown) => messages.push(message),
  addEventListener: (_: string, listener: any) => listeners.add(listener),
  removeEventListener: (_: string, listener: any) => listeners.delete(listener) } } })
Object.assign(globalThis, { window, document: window.document, HTMLElement: window.HTMLElement,
  SVGElement: window.SVGElement, Element: window.Element, ShadowRoot: window.ShadowRoot,
  CSS: window.CSS, getComputedStyle: window.getComputedStyle.bind(window), IS_REACT_ACT_ENVIRONMENT: true, React,
  requestAnimationFrame: window.requestAnimationFrame.bind(window), cancelAnimationFrame: window.cancelAnimationFrame.bind(window) })
window.HTMLElement.prototype.setPointerCapture = function () {}
window.HTMLElement.prototype.hasPointerCapture = function () { return false }
window.HTMLElement.prototype.releasePointerCapture = function () {}

test('Web 输入、混合选择、分页历史、冻结、宿主去重及过期会话防护', async () => {
  const { usePlaybackSelection } = await import('../src/viewer/usePlaybackSelection')
  const { SlideRenderer } = await import('../src/components/SlideRenderer')
  const shape: SlideElement = { type: 'shape', id: 'shape', x: 60, y: 60, width: 80, height: 40,
    backgroundColor: '#ffffff', foregroundColor: '#000000', path: 'M0 0H80V40H0Z', geometryType: 'Rectangle' }
  const pages: SlideData[] = ['a', 'b'].map(id => ({ id, width: 800, height: 600, backgroundColor: '#ffffff',
    elements: id === 'a' ? [shape] : [], animationOrders: [], animations: [], issues: [] }))
  let index = 0
  let metadata: any = { name: 'fixture' }
  let playback!: ReturnType<typeof usePlaybackSelection>
  let animationClicks = 0
  function Player() {
    playback = usePlaybackSelection(pages, index, metadata)
    return <SlideRenderer slide={playback.slides[index]} scale={0.5} playbackSelection={playback.selection}
      onElementClick={() => { animationClicks++; return true }} />
  }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container as unknown as HTMLElement)
  const render = () => act(async () => root.render(<Player />))
  await render()
  const sessionId = messages.findLast(message => message.type === 'enbx:annotation-ready').sessionId
  const send = (message: object) => act(async () => listeners.forEach(listener => listener({ data: { sessionId, ...message } })))
  const pointer = async (type: string, x: number, y: number, pointerId = 1) => act(async () => {
    const surface = container.querySelector('[data-annotation-surface], [data-playback-selection]')!
    surface.dispatchEvent(new window.PointerEvent(type, { bubbles: true, button: 0,
      pointerType: 'pen', pressure: 0.7, pointerId, clientX: x, clientY: y }))
  })
  await send({ type: 'enbx:annotation-state', tool: 'pen', brush: { width: 4, pressure: true } })
  await pointer('pointerdown', 20, 20)
  await pointer('pointermove', 70, 20)
  await pointer('pointerup', 110, 20)
  const ink = playback.slides[0].elements[1] as InkElement
  assert.equal(ink.type, 'ink')
  assert.equal(ink.brush.width, 8)
  assert.equal(ink.points[0].pressure, 0.7)
  assert.equal(ink.points.length, 3)
  assert.equal(container.querySelectorAll('[data-ink-id]').length, 1)
  const clickSurface = container.querySelector('[data-annotation-surface]')!
  await act(async () => clickSurface.dispatchEvent(new window.MouseEvent('click', { bubbles: true })))
  assert.equal(animationClicks, 0)
  await send({ type: 'enbx:annotation-state', tool: 'select' })
  // 套索同时选择课件和笔画，再拖动共同外框。
  await pointer('pointerdown', 5, 5)
  await pointer('pointermove', 130, 5)
  await pointer('pointermove', 130, 65)
  await pointer('pointermove', 5, 65)
  await pointer('pointerup', 5, 5)
  assert.ok(container.querySelector('[aria-label="旋转"]'))
  await pointer('pointerdown', 45, 40)
  await pointer('pointermove', 65, 50)
  await pointer('pointerup', 65, 50)
  assert.equal(playback.slides[0].elements[0].x, shape.x + 40)
  assert.ok(Math.abs(playback.slides[0].elements[1].x - ink.x - 40) < 1e-7)
  await send({ type: 'enbx:annotation-command', commandId: 'move-undo', command: 'undo' })
  assert.equal(playback.slides[0].elements[0].x, shape.x)
  assert.equal(playback.slides[0].elements[1].x, ink.x)
  await send({ type: 'enbx:annotation-command', commandId: 'move-undo', command: 'undo' })
  assert.equal(playback.slides[0].elements.length, 2)
  await act(async () => playback.selection.onCommand('bring-front', ['shape']))
  await send({ type: 'enbx:annotation-state', tool: 'eraser', eraser: { shape: 'circle', width: 10 } })
  await pointer('pointerdown', 60, 0)
  await pointer('pointermove', 60, 40)
  await pointer('pointerup', 60, 40)
  assert.equal(playback.slides[0].elements.length, 3)
  assert.equal(playback.slides[0].elements.at(-1)!.id, 'shape')
  await act(async () => playback.selection.annotation!.command('undo'))
  assert.deepEqual(playback.slides[0].elements.map(element => element.id), [ink.id, 'shape'])
  await send({ type: 'enbx:annotation-state', tool: 'pen' })
  await pointer('pointerdown', 20, 100)
  await pointer('pointercancel', 40, 100)
  assert.equal(playback.slides[0].elements.length, 2)
  await pointer('pointerdown', 20, 100)
  await send({ type: 'enbx:annotation-state', tool: 'select' })
  assert.equal(container.querySelector('[data-annotation-surface]'), null)
  assert.equal(playback.slides[0].elements.length, 2)
  index = 1
  await render()
  assert.equal(playback.selection.annotation!.canUndo, false)
  await act(async () => playback.selection.annotation!.command('clear'))
  index = 0
  await render()
  assert.equal(playback.slides[0].elements.length, 2)
  await send({ type: 'enbx:annotation-state', frozen: true })
  await send({ type: 'enbx:annotation-command', commandId: 'frozen-clear', command: 'clear' })
  assert.equal(playback.slides[0].elements.length, 2)
  assert.equal(messages.findLast(message => message.commandId === 'frozen-clear').success, false)
  await send({ type: 'enbx:annotation-state', frozen: false })
  await send({ type: 'enbx:annotation-command', commandId: 'clear', command: 'clear', slideId: 'b' })
  assert.equal(playback.slides[0].elements.length, 2)
  await send({ type: 'enbx:annotation-command', commandId: 'clear', command: 'clear', slideId: 'a' })
  assert.deepEqual(playback.slides[0].elements, [shape])
  await send({ type: 'enbx:annotation-command', commandId: 'clear-undo', command: 'undo' })
  assert.equal(playback.slides[0].elements.length, 2)
  // 更换文档后旧会话的工具和命令均失效。
  metadata = { name: 'new' }
  await render()
  await send({ type: 'enbx:annotation-state', tool: 'pen' })
  assert.equal(playback.selection.annotation!.state.tool, 'play')
  assert.equal(playback.slides[0].elements.length, 1)
  assert.equal(pages[0].elements[0], shape)
  await act(async () => root.unmount())
  assert.equal(listeners.size, 0)
})

test('多指书写独立提交，翻页取消未完成输入', async () => {
  const { AnnotationSurface } = await import('../src/components/annotation/AnnotationSurface')
  const { defaultAnnotationState } = await import('../src/viewer/annotation/annotation-state')
  const committed: InkElement[] = []
  const slide: SlideData = { id: 'a', width: 800, height: 600, backgroundColor: '#fff',
    elements: [], animations: [], animationOrders: [], issues: [] }
  const annotation: any = { state: { ...defaultAnnotationState(), tool: 'pen' },
    addInk: (ink: InkElement) => committed.push(ink) }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container as unknown as HTMLElement)
  await act(async () => root.render(<AnnotationSurface slide={slide} scale={1} annotation={annotation} onPreview={() => {}} />))
  const surface = container.firstElementChild!
  const pointer = (type: string, id: number, x: number) => act(async () => surface.dispatchEvent(
    new window.PointerEvent(type, { bubbles: true, button: 0, pointerId: id, clientX: x, clientY: id * 20 })))
  await pointer('pointerdown', 1, 10)
  await pointer('pointerdown', 2, 20)
  await pointer('pointerup', 2, 100)
  await pointer('pointerup', 1, 120)
  assert.equal(committed.length, 2)
  assert.notEqual(committed[0].id, committed[1].id)
  await pointer('pointerdown', 3, 10)
  await act(async () => root.unmount())
  assert.equal(committed.length, 2)
})
