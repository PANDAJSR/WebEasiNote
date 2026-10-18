import assert from 'node:assert/strict'
import { test } from 'node:test'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import { SlideViewerLayer } from '../src/components/slide-viewer/SlideViewerLayer'
import type { SlideData } from '../src/types'
import { StaticRunLayer } from '../src/components/slide-renderer/StaticRunLayer'
import { getStaticPlan, isStaticRun } from '../src/rendering/staticPlan'
import { clearRasterCache } from '../src/rendering/rasterCache'

const window = new Window()
Object.assign(globalThis, { window, document: window.document,
  IS_REACT_ACT_ENVIRONMENT: true, React })

test('仅挂载当前/过渡页面，跨页播放只保留原 video 实例', async () => {
  const pages = Array.from({ length: 18 }, (_, i): SlideData => ({
    id: `slide-${i}`, width: 1280, height: 720, backgroundColor: '#fff',
    animationOrders: [], animations: [], issues: [], elements: [{
      type: 'shape', id: `shape-${i}`, x: 0, y: 0, width: 10, height: 10,
      backgroundColor: '#fff', foregroundColor: '#000', path: 'M0 0 H10 V10Z', geometryType: 'test'
    }]
  }))
  pages[0].elements.push({ type: 'video', id: 'v', x: 0, y: 0, width: 100, height: 100,
    sourceId: 'video', mediaName: '测试', rotation: 0, volume: 1, clipStart: 0,
    isLoopPlay: false, isAutoPlay: false, isCrossSlidePlay: true, stopPlayPageNumber: 3 })
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container as unknown as HTMLElement)
  const render = async (current: number, transitionState: any = null) => act(async () => root.render(
    <>{pages.map((page, index) => <SlideViewerLayer key={page.id} slideItem={page}
      index={index} currentIndex={current} slideScale={1} resourceMap={{ video: 'blob:test' }}
      transitionState={transitionState} lineRevealProgress={0} setLayerRef={() => {}}
      isEditMode={false} />)}</>
  ))
  await render(0)
  assert.equal(container.querySelectorAll('[data-slide-element]').length, 2)
  const video = container.querySelector('video')
  assert.ok(video)
  await render(1)
  assert.equal(container.querySelectorAll('[data-slide-element]').length, 2)
  assert.equal(container.querySelector('video'), video)
  await render(2)
  assert.equal(container.querySelectorAll('video').length, 0)
  assert.equal(container.querySelectorAll('[data-slide-element]').length, 1)
  await render(3, { enteringIndex: 3, leavingIndex: 2, phase: 'running', key: 'Fade' })
  assert.equal(container.querySelectorAll('[data-slide-element]').length, 2)
  await render(17)
  assert.equal(container.querySelectorAll('[data-slide-element]').length, 1)
  await act(async () => root.unmount())
})

test('冷缓存绘制完成后卸载 SVG；热缓存不再挂载 SVG；不支持时保留矢量', async () => {
  const jobs: { worker: any; id: number }[] = []
  class Worker {
    onmessage: ((event: any) => void) | null = null
    postMessage(message: any) { jobs.push({ worker: this, id: message.id }) }
    terminate() {}
  }
  Object.assign(globalThis, { Worker, OffscreenCanvas: class {} })
  window.HTMLCanvasElement.prototype.getContext = (() => ({ drawImage() {} })) as any
  const page = { id: 's', width: 1280, height: 720, animations: [], elements: Array.from({ length: 32 }, (_, index) => ({
    type: 'shape', id: `s${index}`, x: 0, y: 0, width: 10, height: 10,
    backgroundColor: '#fff', foregroundColor: '#000', path: 'M0 0 H10 V10Z', geometryType: 'test', staticCacheSafe: true
  })) } as unknown as SlideData
  const run = getStaticPlan(page)[0]
  assert.ok(isStaticRun(run))
  const container = document.createElement('div')
  document.body.append(container)
  let root = createRoot(container as unknown as HTMLElement)
  const layer = <StaticRunLayer run={run} width={1280} height={720} scale={1} />
  await act(async () => { root.render(layer); await new Promise(resolve => setTimeout(resolve, 20)) })
  assert.equal(container.querySelectorAll('svg').length, 32)
  assert.equal(jobs.length, 1)
  const job = jobs.shift()!
  await act(async () => job.worker.onmessage({ data: { id: job.id,
    bitmap: { width: 1280, height: 720, close() {} } } }))
  assert.equal(container.querySelectorAll('svg').length, 0)
  assert.equal(container.querySelectorAll('canvas').length, 1)
  await act(async () => root.unmount())
  root = createRoot(container as unknown as HTMLElement)
  await act(async () => root.render(layer))
  assert.equal(container.querySelectorAll('svg').length, 0)
  assert.equal(jobs.length, 0)
  await act(async () => root.unmount())
  clearRasterCache()
  Object.assign(globalThis, { Worker: undefined })
  root = createRoot(container as unknown as HTMLElement)
  const warn = console.warn
  console.warn = () => {}
  try {
    await act(async () => root.render(layer))
    assert.equal(container.querySelectorAll('svg').length, 32)
    await act(async () => root.unmount())
  } finally {
    console.warn = warn
  }
})
