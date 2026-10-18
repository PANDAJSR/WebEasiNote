import assert from 'node:assert/strict'
import { test } from 'node:test'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import { SlidePreview, staticPreview } from '../src/components/slide-viewer/SlidePreview'
import type { SlideData } from '../src/types'

test('100 页预览仅挂载可见项，滚出释放；静态投影缓存且排除全部媒体运行时', async () => {
  const window = new Window()
  const observers: { callback: (entries: { isIntersecting: boolean }[]) => void; disconnected?: boolean }[] = []
  class Observer {
    record: typeof observers[number]
    constructor(callback: typeof observers[number]['callback']) {
      this.record = { callback }
      observers.push(this.record)
    }
    observe() {}
    disconnect() { this.record.disconnected = true }
  }
  Object.assign(globalThis, { window, document: window.document, React,
    IS_REACT_ACT_ENVIRONMENT: true, IntersectionObserver: Observer })
  const page: SlideData = { id: 's', width: 1280, height: 720, backgroundColor: '#fff',
    animationOrders: [], animations: [], issues: [], elements: [{
      type: 'shape', id: 'shape', x: 0, y: 0, width: 10, height: 10,
      backgroundColor: '#fff', foregroundColor: '#000', path: 'M0 0 H10 V10Z', geometryType: 'test'
    }] }
  const mediaPage = { ...page, elements: [...page.elements,
    ...['audio', 'video', 'flash'].map(type => ({ type, id: type }))] } as SlideData
  assert.equal(staticPreview(mediaPage).elements.length, 1)
  assert.equal(staticPreview(mediaPage), staticPreview(mediaPage))
  assert.equal(mediaPage.elements.length, 4)
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container as unknown as HTMLElement)
  await act(async () => root.render(<div data-slide-list>{Array.from({ length: 100 }, (_, index) =>
    <SlidePreview key={index} slide={mediaPage} index={index} resourceMap={{}} />)}</div>))
  assert.equal(container.querySelectorAll('[data-slide-element]').length, 0)
  await act(async () => { observers[0].callback([{ isIntersecting: true }]); observers[1].callback([{ isIntersecting: true }]) })
  assert.equal(container.querySelectorAll('[data-slide-element]').length, 2)
  assert.equal(container.querySelectorAll('audio,video,iframe').length, 0)
  await act(async () => { observers[0].callback([{ isIntersecting: false }]) })
  assert.equal(container.querySelectorAll('[data-slide-element]').length, 1)
  await act(async () => root.unmount())
  assert.equal(observers.every(observer => observer.disconnected), true)
})
