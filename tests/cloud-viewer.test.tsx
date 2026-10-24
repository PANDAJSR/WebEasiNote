import assert from 'node:assert/strict'
import { test } from 'node:test'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'

test('云 Viewer 延迟页保留旧正文，提交后才向宿主确认，关闭会话后拒绝迟到页', async () => {
  const dom = new Window({ url: 'https://enbx.local/' })
  const messages: any[] = []
  const listeners = new Set<(event: any) => void>()
  Object.assign(dom, { chrome: { webview: {
    postMessage: (message: any) => messages.push(message),
    addEventListener: (_: string, listener: (event: any) => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: (event: any) => void) => listeners.delete(listener)
  } } })
  Object.assign(globalThis, { window: dom, document: dom.document,
    DOMParser: dom.DOMParser, XMLSerializer: dom.XMLSerializer, Node: dom.Node, HTMLElement: dom.HTMLElement,
    ShadowRoot: dom.ShadowRoot, SVGElement: dom.SVGElement,
    ResizeObserver: dom.ResizeObserver, getComputedStyle: dom.getComputedStyle.bind(dom),
    requestAnimationFrame: dom.requestAnimationFrame.bind(dom), cancelAnimationFrame: dom.cancelAnimationFrame.bind(dom),
    localStorage: dom.localStorage, IS_REACT_ACT_ENVIRONMENT: true, React })
  const { CloudViewer } = await import('../src/components/CloudViewer')
  const originalFetch = globalThis.fetch
  let release!: (response: Response) => void
  const delayed = new Promise<Response>(resolve => { release = resolve })
  let releaseThird!: (response: Response) => void
  const third = new Promise<Response>(resolve => { releaseThird = resolve })
  const files = ['Board.xml', 'Slides/Slide_0.xml', 'Slides/Slide_1.xml', 'Slides/Slide_2.xml']
  const slide = (id: string) => `<Slide><Id>${id}</Id><Elements/></Slide>`
  globalThis.fetch = async input => {
    const url = String(input)
    if (url.endsWith('manifest.json')) return Response.json({ protocolVersion: 1, sessionId: 's', name: '测试',
      files: files.map(path => ({ path })) })
    if (url.endsWith('Board.xml')) return new Response('<Board><Slides><Item>a</Item><Item>b</Item><Item>c</Item></Slides></Board>')
    if (url.endsWith('Slide_0.xml')) return new Response(slide('a'))
    return url.includes('Slide_1.xml') ? delayed : third
  }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const render = (command: any = null) => <CloudViewer manifestUrl='https://enbx.local/courseware/s/manifest.json'
    onClear={() => {}} clickToNextEnabled={true} pagerPosition='both' showAnimationProgress={false}
    hideToolbar={true} navigationCommand={command} />
  try {
    await act(async () => { root.render(render()); await new Promise(resolve => setTimeout(resolve, 30)) })
    assert.equal(messages.filter(m => m.type === 'enbx:document-loaded').length, 1)
    assert.deepEqual(messages.find(m => m.type === 'enbx:document-loaded').slideIds, ['a', 'b', 'c'])
    const command = { id: 1, direction: 'next', requestId: 'n' }
    await act(async () => root.render(render(command)))
    assert.equal(messages.filter(m => m.type === 'enbx:navigation-complete').length, 0)
    assert.match(container.textContent!, /正在加载页面/)
    await act(async () => { release(new Response(slide('b'))); await new Promise(resolve => setTimeout(resolve, 10)) })
    const completion = messages.find(m => m.type === 'enbx:navigation-complete')
    assert.equal(completion.page, 2)
    const changed = messages.find(m => m.type === 'enbx:page-changed')
    assert.equal(changed.page, 2)
    assert.equal(changed.sessionId, 's')
    await act(async () => root.render(render({ id: 2, direction: 'next', requestId: 'late' })))
    await act(async () => {
      for (const listener of listeners) listener({ data: { type: 'enbx:close-cloud', sessionId: 's' } })
    })
    assert.equal(container.textContent, '')
    await act(async () => { releaseThird(new Response(slide('c'))); await Promise.resolve() })
    assert.equal(messages.filter(m => m.type === 'enbx:page-changed').length, 1)
    assert.equal(messages.find(m => m.requestId === 'late')?.page, 0)
  } finally {
    await act(async () => root.unmount())
    globalThis.fetch = originalFetch
    dom.happyDOM.abort()
  }
})
