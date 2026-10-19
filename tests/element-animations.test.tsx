import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import { parseSlideAnimations } from '../src/enbx/slide-animations'
import { useElementAnimations } from '../src/components/slide-viewer/useElementAnimations'
import {
  buildRandomizedLinesInKeyframeName, buildRandomizedLinesInKeyframesCss,
  buildRandomizedLinesMask, resolveRandomizedLineOrder
} from '../src/components/slide-viewer/randomized-lines-animation'
import type { SlideData, SlideElement } from '../src/types'

const dom = new Window()
Object.assign(globalThis, { window: dom, document: dom.document, React,
  IS_REACT_ACT_ENVIRONMENT: true })

async function loadPageFive(): Promise<SlideData> {
  const xml = await readFile(new URL('./fixtures/middle-east-page-5-animations.xml', import.meta.url), 'utf8')
  const node = new dom.DOMParser().parseFromString(xml, 'text/xml').documentElement
  const { animations, animationOrders } = parseSlideAnimations(node as unknown as Element)
  const elements: SlideElement[] = []
  function visit(parent: globalThis.Element, ancestorIds: string[] = []) {
    for (const child of Array.from(parent.children)) {
      const id = child.querySelector(':scope > Id')!.textContent!
      if (child.tagName === 'Group') {
        visit(child.querySelector(':scope > Elements')!, [...ancestorIds, id])
      } else {
        elements.push({ type: 'text', id, x: 0, y: 0, width: 200, height: 100,
          groupAncestorIds: ancestorIds, textLines: [] })
      }
    }
  }
  visit(node.querySelector(':scope > Elements')! as unknown as Element)
  return { id: 'middle-east-page-5', width: 1280, height: 720,
    backgroundColor: '#fff', elements, animations, animationOrders, issues: [] }
}

test('第 5 页四段线条动画正文点击前隐藏，保留全部 12 步，回退后可重播', async () => {
  const slide = await loadPageFive()
  assert.equal(slide.animations.length, 16)
  const randomLines = slide.animations.filter(animation => animation.type === 'RandomizedLinesInEffect')
  assert.deepEqual(randomLines.map(animation => animation.number), [5, 8, 9, 16])
  assert.ok(randomLines.every(animation => animation.start === 1 && animation.end === 0))
  let controls: ReturnType<typeof useElementAnimations> | undefined
  function Probe() {
    controls = useElementAnimations({ slide })
    return <>{slide.elements.map(element => controls!.elementRenderStates[element.id] === false
      ? null : <span key={element.id} data-id={element.id}
        style={controls!.elementDisplayStyles[element.id]} />)}</>
  }
  const container = document.createElement('div')
  const root = createRoot(container as unknown as HTMLElement)
  const find = (id: string) => container.querySelector(`[data-id="${id}"]`)
  try {
    await act(async () => root.render(<Probe />))
    assert.equal(controls!.totalClickAnimations, 12)
    randomLines.forEach(animation => {
      assert.equal(controls!.elementRenderStates[animation.targetId], false)
      assert.equal(controls!.elementDisplayStyles[animation.targetId].opacity, 0)
      assert.equal(find(animation.targetId), null)
    })
    const clickNumbers = slide.animations.filter(animation => animation.trigger === 'Click').map(animation => animation.number)
    for (const number of clickNumbers) {
      await act(async () => { assert.equal(controls!.stepForwardElementAnimation(), true) })
      for (const animation of randomLines) {
        assert.equal(Boolean(find(animation.targetId)), animation.number <= number,
          `animation ${animation.number} after click ${number}`)
        if (animation.number === number) {
          assert.ok(controls!.elementDisplayStyles[animation.targetId].animation?.includes(
            buildRandomizedLinesInKeyframeName('Horizontal')))
          assert.equal(controls!.elementDisplayStyles[animation.targetId].transition, 'none')
        }
      }
    }
    assert.equal(controls!.hasRemainingClickAnimations, false)
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 550)) })
    randomLines.forEach(animation => {
      assert.ok(find(animation.targetId))
      assert.equal(controls!.elementDisplayStyles[animation.targetId].opacity, 1)
      assert.equal(controls!.elementDisplayStyles[animation.targetId].animation, undefined)
    })
    await act(async () => { controls!.stepBackwardElementAnimation() })
    const last = randomLines[randomLines.length - 1]
    assert.equal(find(last.targetId), null)
    await act(async () => { controls!.stepForwardElementAnimation() })
    assert.ok(find(last.targetId))
    assert.ok(controls!.elementDisplayStyles[last.targetId].animation?.includes('randomized-lines-in'))
    for (let index = 0; index < 12; index += 1) {
      await act(async () => { controls!.stepBackwardElementAnimation() })
    }
    randomLines.forEach(animation => assert.equal(find(animation.targetId), null))
  } finally {
    await act(async () => root.unmount())
  }
})

test('随机条纹遮罩从全隐藏到完整覆盖，两种方向仅揭示条纹而不移动正文', () => {
  const order = resolveRandomizedLineOrder()
  assert.equal(new Set(order).size, 40)
  assert.notDeepEqual(order, [...order].sort((a, b) => a - b))
  const decode = (mask: string) => decodeURIComponent(mask.slice('url("data:image/svg+xml,'.length, -2))
  for (const direction of ['Horizontal', 'Vertical'] as const) {
    const empty = decode(buildRandomizedLinesMask(direction, 0))
    assert.equal(empty.includes('<rect'), false)
    const half = decode(buildRandomizedLinesMask(direction, 20))
    const full = decode(buildRandomizedLinesMask(direction, 40))
    assert.equal(Array.from(half.matchAll(/<rect /g)).length, 20)
    assert.equal(Array.from(full.matchAll(/<rect /g)).length, 40)
    assert.ok(full.includes(direction === 'Horizontal' ? 'width="40" height="1"' : 'width="1" height="40"'))
  }
  const css = buildRandomizedLinesInKeyframesCss()
  assert.ok(css.includes('@keyframes seewo-element-randomized-lines-in-Horizontal'))
  assert.ok(css.includes('@keyframes seewo-element-randomized-lines-in-Vertical'))
  assert.equal(css.includes('transform:'), false)
  assert.equal(css.includes('filter:'), false)
})
