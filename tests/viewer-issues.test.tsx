import assert from 'node:assert/strict'
import { test } from 'node:test'
import React, { act } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { SlideData, SlideIssue } from '../src/types'

test('关闭的问题面板不遍历 31 万条问题，打开后仅挂载 100 条且可翻页', async () => {
  const { Window } = await import('happy-dom')
  const dom = new Window()
  Object.assign(globalThis, {
    window: dom, document: dom.document, HTMLElement: dom.HTMLElement,
    Element: dom.Element, SVGElement: dom.SVGElement, ShadowRoot: dom.ShadowRoot,
    getComputedStyle: dom.getComputedStyle.bind(dom),
    IS_REACT_ACT_ENVIRONMENT: true, React
  })
  const { createRoot } = await import('react-dom/client')
  const { ViewerIssuesModal } = await import('../src/components/ViewerIssuesModal')
  const issue: SlideIssue = { kind: 'unknown-parameter', slideId: 's', elementType: 'Shape',
    elementId: 'a', name: 'CustomGeometryInfoExtension', value: '参数预览' }
  let reads = 0
  const closedIssues = new Proxy(Array.from({ length: 311674 }, () => issue), {
    get(target, property, receiver) {
      if (property !== 'length') {
        reads++
        throw new Error('关闭状态不应读取或遍历问题内容')
      }
      return Reflect.get(target, property, receiver)
    }
  })
  const slides = [{ id: 's' }] as SlideData[]
  const started = performance.now()
  for (let i = 0; i < 20; i++) {
    const html = renderToStaticMarkup(<ViewerIssuesModal open={false} onClose={() => {}}
      issues={closedIssues} slides={slides} />)
    assert.equal(html, '')
  }
  console.log(`[ViewerIssues] 关闭状态 20 次渲染 ${((performance.now() - started)).toFixed(2)} ms，问题内容读取 ${reads} 次`)
  assert.equal(reads, 0)
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container as unknown as HTMLElement)
  const openIssues = Array.from({ length: 205 }, (_, index) => ({
    ...issue, elementId: index.toString().padStart(6, '0')
  }))
  const render = (open: boolean, issues: SlideIssue[]) => root.render(
    <ViewerIssuesModal open={open} onClose={() => render(false, closedIssues)} issues={issues} slides={slides} />
  )
  await act(async () => render(true, openIssues))
  assert.equal(document.querySelectorAll('[data-viewer-issue]').length, 100)
  assert.ok(document.querySelector('[data-viewer-issue]')?.textContent?.includes('000000'))
  const next = document.querySelector('.ant-pagination-next button')
  assert.ok(next)
  await act(async () => next.dispatchEvent(new dom.MouseEvent('click', { bubbles: true })))
  assert.equal(document.querySelectorAll('[data-viewer-issue]').length, 100)
  assert.ok(document.querySelector('[data-viewer-issue]')?.textContent?.includes('000100'))
  await act(async () => next.dispatchEvent(new dom.MouseEvent('click', { bubbles: true })))
  assert.equal(document.querySelectorAll('[data-viewer-issue]').length, 5)
  const chooseFilter = async (label: string) => {
    const option = Array.from(document.querySelectorAll('.ant-segmented-item'))
      .find(element => element.textContent?.startsWith(label))
    const input = option?.querySelector('input')
    assert.ok(input)
    await act(async () => input.click())
  }
  await chooseFilter('未识别元素')
  assert.equal(document.querySelectorAll('[data-viewer-issue]').length, 0)
  await chooseFilter('全部')
  assert.equal(document.querySelectorAll('[data-viewer-issue]').length, 100)
  assert.ok(document.querySelector('[data-viewer-issue]')?.textContent?.includes('000000'))
  await act(async () => render(false, closedIssues))
  assert.equal(document.querySelectorAll('[data-viewer-issue]').length, 0)
  assert.equal(reads, 0)
  await act(async () => root.unmount())
  await dom.happyDOM.abort()
})
