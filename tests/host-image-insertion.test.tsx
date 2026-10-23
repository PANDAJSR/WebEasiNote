import assert from 'node:assert/strict'
import { test } from 'node:test'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import type { CoursewareMetadata, SlideData } from '../src/types'

test('宿主传图提交当前页、回执、选择变换、跨页保留及失败路径', async () => {
  const window = new Window()
  const messages: any[] = []
  const listeners = new Set<(event: any) => void>()
  const decoders: Decoder[] = []
  class Decoder {
    naturalWidth = 1600
    naturalHeight = 400
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    src = ''
    constructor() { decoders.push(this) }
  }
  Object.assign(window, { Image: Decoder, chrome: { webview: {
    postMessage: (message: unknown) => messages.push(message),
    addEventListener: (_: string, listener: any) => listeners.add(listener),
    removeEventListener: (_: string, listener: any) => listeners.delete(listener)
  } } })
  Object.assign(globalThis, { window, document: window.document, React, IS_REACT_ACT_ENVIRONMENT: true })
  const { usePlaybackSelection } = await import('../src/viewer/usePlaybackSelection')
  const pages: SlideData[] = ['a', 'b'].map(id => ({ id, width: 800, height: 600,
    backgroundColor: '#fff', elements: [], animationOrders: [], animations: [], issues: [] }))
  let metadata = { name: 'test' } as CoursewareMetadata
  let index = 0
  let state: ReturnType<typeof usePlaybackSelection>
  function Player() {
    state = usePlaybackSelection(pages, index, metadata)
    return <div>{state.slides[index].elements.map(element => <img key={element.id}
      src={state.resources[(element as any).sourceId]} data-id={element.id} />)}</div>
  }
  const container = document.createElement('div')
  const root = createRoot(container as unknown as HTMLElement)
  await act(async () => root.render(<Player />))
  const send = async (requestId: string, dataUrl: unknown = 'data:image/png;base64,aGVsbG8=') => act(async () => {
    for (const listener of listeners) listener({ data: { type: 'insert-image', requestId, dataUrl, name: '手机.png' } })
  })
  const receipt = (id: string) => messages.filter(message => message.type === 'image-inserted' && message.requestId === id)
  await send('ok')
  assert.equal(receipt('ok').length, 0)
  await act(async () => decoders.at(-1)!.onload!())
  assert.deepEqual(receipt('ok'), [{ type: 'image-inserted', requestId: 'ok', success: true }])
  const picture = state!.slides[0].elements[0]
  assert.equal(picture.type, 'picture')
  assert.deepEqual([picture.x, picture.y, picture.width, picture.height], [80, 220, 640, 160])
  assert.equal(state!.selection.enabled, true)
  assert.equal(container.querySelector('img')!.getAttribute('src'), 'data:image/png;base64,aGVsbG8=')
  assert.equal(pages[0].elements.length, 0)
  await act(async () => state!.selection.onChange([{ ...picture, x: 120 }]))
  assert.equal(state!.slides[0].elements[0].x, 120)
  index = 1
  await act(async () => root.render(<Player />))
  assert.equal(state!.slides[1].elements.length, 0)
  index = 0
  await act(async () => root.render(<Player />))
  assert.equal(state!.slides[0].elements[0].id, picture.id)
  await act(async () => state!.selection.onCommand('delete', [picture.id]))
  assert.equal(state!.slides[0].elements.length, 0)
  await send('invalid', 'https://example.com/image.png')
  assert.equal(receipt('invalid')[0].success, false)
  await send('broken')
  await act(async () => decoders.at(-1)!.onerror!())
  assert.equal(receipt('broken')[0].success, false)
  await send('navigated')
  index = 1
  await act(async () => root.render(<Player />))
  await act(async () => decoders.at(-1)!.onload!())
  assert.equal(receipt('navigated')[0].success, false)
  assert.equal(state!.slides[1].elements.length, 0)
  await send('closed')
  metadata = { name: 'new' } as CoursewareMetadata
  await act(async () => root.render(<Player />))
  assert.equal(receipt('closed')[0].success, false)
  assert.deepEqual(state!.resources, {})
  assert.equal(state!.slides[0].elements.length, 0)
  await act(async () => root.unmount())
  assert.equal(listeners.size, 0)
})
