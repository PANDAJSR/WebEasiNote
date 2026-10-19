import assert from 'node:assert/strict'
import { test } from 'node:test'
import React, { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import { usePageNavigation } from '../src/components/slide-viewer/usePageNavigation'
import { ProgressiveImage } from '../src/components/ProgressiveImage'

const window = new Window()
Object.assign(globalThis, { window, document: window.document, HTMLElement: window.HTMLElement,
  getComputedStyle: window.getComputedStyle.bind(window), IS_REACT_ACT_ENVIRONMENT: true, React })

test('本地同步翻页也在 React 正文提交后确认；同页动画不翻页', async () => {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container as unknown as HTMLElement)
  const confirmations: number[] = []
  let command: any = null
  let animation = false
  function Page() {
    const [index, setIndex] = useState(0)
    usePageNavigation({ currentIndex: index, pageCount: 3, isEditMode: false,
      clearStepDirection() {}, stepForwardElementAnimation: () => animation,
      stepBackwardElementAnimation: () => false, onSlideChange: setIndex, navigationCommand: command,
      onNavigationResult: (_, page) => {
        assert.equal(container.textContent, String(page - 1))
        confirmations.push(page)
      } })
    return <span>{index}</span>
  }
  await act(async () => root.render(<Page />))
  command = { id: 1, direction: 'next', requestId: 'a' }
  await act(async () => root.render(<Page />))
  assert.deepEqual(confirmations, [2])
  animation = true
  command = { id: 2, direction: 'next', requestId: 'b' }
  await act(async () => root.render(<Page />))
  assert.deepEqual(confirmations, [2, 2])
  await act(async () => root.unmount())
})

test('图片晚到或失败重试保持原 img 实例和布局', async () => {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container as unknown as HTMLElement)
  await act(async () => root.render(<ProgressiveImage src='https://enbx.local/courseware/s/files/a.png'
    style={{ width: 100, height: 50 }} />))
  const img = container.querySelector('img')!
  assert.equal(container.textContent, '', '快速加载时不闪烁占位层')
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 280)) })
  assert.match(container.textContent!, /加载中/)
  await act(async () => img.dispatchEvent(new window.Event('error')))
  const retry = container.querySelector('button')!
  assert.ok(retry)
  await act(async () => retry.click())
  assert.equal(container.querySelector('img'), img)
  assert.match(img.src, /retry=1/)
  await act(async () => img.dispatchEvent(new window.Event('load')))
  assert.equal(container.textContent, '')
  assert.equal(img.style.width, '100px')
  assert.equal(img.style.height, '50px')
  await act(async () => root.render(<ProgressiveImage key='revisit' src={img.src}
    style={{ width: 100, height: 50 }} />))
  const revisited = container.querySelector('img')!
  assert.equal(container.textContent, '')
  await act(async () => revisited.dispatchEvent(new window.Event('load')))
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 280)) })
  assert.equal(container.textContent, '', '重新挂载后快速 load 不显示加载提示')
  await act(async () => root.unmount())
})
