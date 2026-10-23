import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import { parseSlideXML } from '../src/enbx/parser'
import { SlideRenderer } from '../src/components/SlideRenderer'
import { shuffledMaterialPositions } from '../src/viewer/activities/shuffle'

const window = new Window()
Object.assign(globalThis, { window, document: window.document, DOMParser: window.DOMParser,
  XMLSerializer: window.XMLSerializer, HTMLElement: window.HTMLElement, Element: window.Element,
  SVGElement: window.SVGElement, CSS: window.CSS, getComputedStyle: window.getComputedStyle.bind(window),
  IS_REACT_ACT_ENVIRONMENT: true, React })
const xml = readFileSync(new URL('./fixtures/activity-classify.xml', import.meta.url), 'utf8')
  .replace('<Key>Classify</Key>', '<Key>SuperClassify</Key>')

test('超级分类复用 ClassifyConfig；重排只交换素材位置，保留各自尺寸与容器', () => {
  const slide = parseSlideXML(xml)
  const definition = slide.activities![0]
  assert.equal(definition.playable, true)
  const saved = JSON.stringify(slide)
  const shuffled = shuffledMaterialPositions(definition, slide.elements, () => 0)
  assert.deepEqual([...shuffled], [['apple', { x: 300, y: 300 }], ['cat', { x: 40, y: 300 }]])
  assert.equal(shuffled.has('fruit'), false)
  assert.equal(JSON.stringify(slide), saved)
  const invalid = parseSlideXML(xml.replace('<Id>cat</Id><Name>', '<Id>missing</Id><Name>'))
  assert.equal(invalid.activities![0].playable, false)
})

test('超级分类答错恢复、答对消失、重置显示素材，播放选择暂停拖动', async () => {
  const slide = parseSlideXML(xml)
  const saved = JSON.stringify(slide)
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container as unknown as HTMLElement)
  let selecting = false
  const render = () => act(async () => root.render(<SlideRenderer slide={slide} resourceMap={{}}
    playbackSelection={{ enabled: selecting, onChange() {}, onDuplicate() {}, onCommand() {} }} />))
  const node = () => container.querySelector('[data-element-id="cat"]') as unknown as HTMLElement
  const pointer = (type: string, clientX: number, clientY: number) => act(async () => {
    node().dispatchEvent(new window.PointerEvent(type, { bubbles: true, pointerId: 1, button: 0,
      clientX, clientY }) as unknown as Event)
  })
  await render()
  await pointer('pointerdown', 320, 320)
  await pointer('pointerup', 40, 40)
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 720)) })
  assert.equal(node().style.left, '300px')
  assert.equal(node().style.visibility, '')
  await pointer('pointerdown', 320, 320)
  await pointer('pointerup', 330, 40)
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 420)) })
  assert.equal(node().style.visibility, 'hidden')
  assert.equal(window.getComputedStyle(node().firstElementChild).visibility, 'hidden')
  await act(async () => (container.querySelector('button') as unknown as HTMLButtonElement).click())
  assert.equal(node().style.visibility, '')
  selecting = true
  await render()
  await pointer('pointerdown', 320, 320)
  await pointer('pointerup', 330, 40)
  assert.equal(node().style.visibility, '')
  assert.equal(JSON.stringify(slide), saved)
  await act(async () => root.unmount())
  container.remove()
})
