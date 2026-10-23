import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import { parseSlideXML } from '../src/enbx/parser'
import { classificationDrop } from '../src/viewer/activities/classification'
import { SlideRenderer } from '../src/components/SlideRenderer'
import type { ActivityElement } from '../src/types'
import { staticPreview } from '../src/components/slide-viewer/SlidePreview'
import { subjectResourcePaths } from '../src/courseware/subject-resources'

const window = new Window()
Object.assign(globalThis, { window, document: window.document, DOMParser: window.DOMParser,
  XMLSerializer: window.XMLSerializer, HTMLElement: window.HTMLElement, Element: window.Element,
  SVGElement: window.SVGElement, CSS: window.CSS, getComputedStyle: window.getComputedStyle.bind(window),
  IS_REACT_ACT_ENVIRONMENT: true, React })
const captures = new Set<number>()
window.HTMLElement.prototype.setPointerCapture = function (id: number) { captures.add(id) }
window.HTMLElement.prototype.hasPointerCapture = function (id: number) { return captures.has(id) }
window.HTMLElement.prototype.releasePointerCapture = function (id: number) { captures.delete(id) }
const xml = readFileSync(new URL('./fixtures/activity-classify.xml', import.meta.url), 'utf8')

test('活动保存契约：角色、嵌套富文本/内容、ID 关联、旧 JSON 和诊断', () => {
  const slide = parseSlideXML(xml)
  assert.equal(slide.activities?.[0].playable, true)
  assert.deepEqual(slide.issues, [])
  const apple = slide.elements.find(element => element.id === 'apple') as ActivityElement
  assert.equal(apple.role, 'material')
  assert.equal(apple.text?.textLines[0].textRuns[0].text, '苹果')
  assert.equal(apple.contents[0].id, 'decoration')
  assert.equal(apple.contents[0].x, 2)
  assert.ok(apple.rawXml?.includes('<CanClone>true</CanClone>'))
  const json = JSON.stringify({ Classifies: [{ Id: 'fruit', Name: '水果', Items: [{ Id: 'apple', Name: '苹果' }] }] })
  const legacy = parseSlideXML(xml.replace(/<Config>[\s\S]*?<\/Config>/, `<Config>${json}</Config>`))
  assert.equal(legacy.activities?.[0].playable, true)
  const invalid = parseSlideXML(xml.replace('<Id>apple</Id><Name>', '<Id>missing</Id><Name>'))
  assert.equal(invalid.activities?.[0].playable, false)
  assert.ok(invalid.issues.some(issue => issue.value?.includes('无法关联')))
  for (const changed of [xml.replace('Classical', 'Fighting'), xml.replace('<Key>Classify</Key>', '<Key>GapFilling</Key>'),
    xml.replace(/<Config>[\s\S]*?<\/Config>/, '<Config>invalid</Config>')]) {
    assert.equal(parseSlideXML(changed).activities?.[0].playable, false)
  }
})

test('分类按中心和最上层容器判题，ResourceId 相同不影响答案', () => {
  const slide = parseSlideXML(xml)
  const definition = slide.activities![0]
  const apple = slide.elements[2] as ActivityElement
  assert.equal(classificationDrop(definition, slide.elements, apple, 20, 30), 'correct')
  assert.equal(classificationDrop(definition, slide.elements, apple, 300, 30), 'wrong')
  // 指针/素材边缘进入仍不足以接受，必须是中心进入。
  assert.equal(classificationDrop(definition, slide.elements, apple, 210, 30), 'outside')
  const overlapping = [...slide.elements, { ...slide.elements[1], x: 20 }]
  assert.equal(classificationDrop(definition, overlapping, apple, 20, 30), 'wrong')
})

test('活动预览递归去除媒体和答题状态，直接背景路径参与资源加载', () => {
  const slide = parseSlideXML(xml)
  const material = slide.elements[2] as ActivityElement
  material.background = { type: 'image', sourceId: 'Resources/material.png' }
  material.contents.push({ type: 'audio', id: 'sound', sourceId: 'Resources/sound.mp3',
    x: 0, y: 0, width: 100, height: 30 } as any)
  const preview = staticPreview(slide)
  assert.equal(preview.activities, undefined)
  assert.ok((preview.elements[2] as ActivityElement).contents.every(element => element.type !== 'audio'))
  assert.equal(material.contents.length, 2)
  assert.ok(subjectResourcePaths([slide]).has('Resources/material.png'))
})

test('分类拖动缩放、取消、判题、选择切换、重置和跨挂载恢复不修改源数据', async () => {
  const slide = parseSlideXML(xml)
  const snapshot = JSON.stringify(slide)
  const container = document.createElement('div')
  document.body.append(container)
  let root = createRoot(container as unknown as HTMLElement)
  let selecting = false
  let animationClicks = 0
  const selection = () => ({ enabled: selecting, onChange() {}, onDuplicate() {}, onCommand() {} })
  const render = () => act(async () => root.render(<SlideRenderer slide={slide} scale={0.5}
    playbackSelection={selection()} onElementClick={() => { animationClicks++; return true }} />))
  const node = (id = 'apple') => container.querySelector(`[data-element-id="${id}"]`) as unknown as HTMLElement
  const pointer = (type: string, x: number, y: number, id = 1, material = 'apple') => act(async () => node(material).dispatchEvent(
    new window.PointerEvent(type, { bubbles: true, pointerId: id, button: 0, clientX: x, clientY: y }) as unknown as Event))
  await render()
  await pointer('pointerdown', 30, 160)
  await pointer('pointermove', 40, 30)
  assert.equal(node().style.top, '40px')
  await pointer('pointerup', 40, 30, 2)
  assert.equal(node().style.top, '40px')
  await pointer('pointercancel', 40, 30)
  assert.equal(node().style.top, '300px')
  assert.equal(captures.size, 0)
  await pointer('pointerdown', 30, 160)
  await pointer('pointerup', 170, 30)
  assert.ok(container.textContent?.includes('分类不正确'))
  assert.equal(node().style.visibility, '')
  await pointer('pointerdown', 30, 160)
  await pointer('pointermove', 40, 30)
  selecting = true
  await render()
  assert.equal(node().style.top, '300px')
  assert.equal(captures.size, 0)
  assert.ok(container.textContent?.includes('活动已暂停'))
  const surface = container.querySelector('[data-playback-selection]')!
  await act(async () => surface.dispatchEvent(new window.PointerEvent('pointerdown',
    { bubbles: true, pointerId: 1, button: 0, clientX: 170, clientY: 160 })))
  await act(async () => surface.dispatchEvent(new window.PointerEvent('pointerup',
    { bubbles: true, pointerId: 1, button: 0, clientX: 170, clientY: 160 })))
  assert.equal(container.querySelector('[aria-label="旋转"]'), null)
  selecting = false
  await render()
  await pointer('pointerdown', 30, 160)
  await pointer('pointerup', 40, 30)
  assert.equal(node().style.visibility, 'hidden')
  assert.ok(container.textContent?.includes('已分类 1 / 2'))
  await act(async () => node('fruit').dispatchEvent(new window.MouseEvent('click', { bubbles: true }) as unknown as Event))
  assert.equal(animationClicks, 0)
  await act(async () => root.unmount())
  root = createRoot(container as unknown as HTMLElement)
  await render()
  assert.equal(node().style.visibility, 'hidden')
  await pointer('pointerdown', 160, 160, 1, 'cat')
  await pointer('pointerup', 170, 30, 1, 'cat')
  assert.ok(container.textContent?.includes('分类完成！'))
  await act(async () => (container.querySelector('button') as unknown as HTMLButtonElement).click())
  assert.equal(node().style.visibility, '')
  assert.equal(node('cat').style.visibility, '')
  assert.equal(JSON.stringify(slide), snapshot)
  await act(async () => root.unmount())
  container.remove()
})
