import assert from 'node:assert/strict'
import { test } from 'node:test'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import { SlideRenderer } from '../src/components/SlideRenderer'
import { parseSlideXML } from '../src/enbx/parser'
import { matchingSession } from '../src/viewer/activities/matching-session'

const window = new Window()
Object.assign(globalThis, { window, document: window.document, DOMParser: window.DOMParser,
  XMLSerializer: window.XMLSerializer, HTMLElement: window.HTMLElement, Element: window.Element,
  SVGElement: window.SVGElement, ShadowRoot: window.ShadowRoot, CSS: window.CSS,
  getComputedStyle: window.getComputedStyle.bind(window), IS_REACT_ACT_ENVIRONMENT: true, React })
const element = (id: string, role: string, text: string) => `<ActivityItem><Id>${id}</Id><ActivityId>a</ActivityId><ResourceType>${role}</ResourceType><Width>120</Width><Height>60</Height><RichText><RichText><Text>${text}</Text></RichText></RichText></ActivityItem>`
const slideXml = (key: string, config: string) => `<Slide><Id>s</Id><Width>800</Width><Height>600</Height><Elements>${element('c', 'Container', '题干') + element('m', 'Material', '答案') + element('d', 'Material', '干扰')}</Elements><Activity><Id>a</Id><Key>${key}</Key><Config>${config}</Config></Activity></Slide>`
const pairConfig = '<TextMatchConfig><MatchItems><TextMatchItem><Id>c</Id><Text>题干</Text><MatchId>m</MatchId><MatchText>答案</MatchText><IsInvalid>False</IsInvalid></TextMatchItem><TextMatchItem><MatchId>d</MatchId><MatchText>干扰</MatchText><IsInvalid>True</IsInvalid></TextMatchItem></MatchItems></TextMatchConfig>'
const gapConfig = '<GapFillingConfig><Stem><Id>c</Id><Paragraphs><Paragraph><Contents><PlainContent><Text>请填入</Text></PlainContent><FillingContent><Items><FillingItem><Id>m</Id><Name>答案</Name></FillingItem></Items></FillingContent></Contents></Paragraph></Paragraphs></Stem><InvalidItems><FillingItem><Id>d</Id><Name>干扰</Name></FillingItem></InvalidItems></GapFillingConfig>'

for (const [key, config] of [['TextMatch', pairConfig], ['GapFilling', gapConfig]]) {
  test(`${key} 通过 SlideRenderer 接入：延后判题、重置、跨挂载、选择模式暂停且不写回`, async () => {
    const slide = parseSlideXML(slideXml(key, config))
    assert.equal(slide.activities![0].playable, true)
    const saved = JSON.stringify(slide)
    const host = document.createElement('div')
    document.body.appendChild(host)
    let root = createRoot(host as unknown as HTMLElement)
    const render = (paused = false) => act(async () => root.render(<SlideRenderer slide={slide}
      playbackSelection={{ enabled: paused, onChange() {}, onDuplicate() {}, onCommand() {} }} />))
    const click = async (selector: string) => {
      const node = host.querySelector(selector) as unknown as HTMLElement
      assert.ok(node, selector)
      await act(async () => node.click())
    }
    const clickText = async (text: string) => {
      const node = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.replace(/\s/g, '').includes(text))
      assert.ok(node, text)
      await act(async () => node.click())
    }
    await render()
    assert.ok(host.querySelector('[data-activity-canvas]'))
    assert.equal(host.querySelector('[data-element-id="m"]'), null)
    await click('[data-matching-material="d"]')
    await click('[data-matching-target]')
    assert.ok(host.querySelector('[data-matching-material="d"]'))
    assert.ok(!host.textContent?.includes('正确 0'))
    await clickText('检查答案')
    assert.ok(host.textContent?.includes('正确 0 / 1'))
    if (key === 'TextMatch') assert.ok(host.querySelector('[data-matching-material="d"]'))
    else assert.ok(host.querySelector('[data-matching-material="d"]'))
    await click('[data-matching-material="m"]')
    await click('[data-matching-target]')
    await clickText('检查答案')
    assert.ok(host.textContent?.includes('活动完成'))
    await act(async () => root.unmount())
    root = createRoot(host as unknown as HTMLElement)
    await render()
    assert.ok(host.textContent?.includes('活动完成'))
    await render(true)
    assert.equal(host.querySelector('[data-activity-canvas]'), null)
    assert.ok(host.querySelector('[data-element-id="m"]'))
    await render()
    await clickText('重新开始')
    assert.ok(host.querySelector('[data-matching-material="m"]'))
    assert.equal(JSON.stringify(slide), saved)
    await act(async () => root.unmount())
    host.remove()
  })
}

test('matching 缺失关联元素降级静态展示，选择题通过页面配置独立运行', () => {
  assert.equal(parseSlideXML(slideXml('TextMatch', pairConfig.replace('<MatchId>m</MatchId>', '<MatchId>missing</MatchId>'))).activities![0].playable, false)
  const choice = '<ChoiceActivityConfig><ChoiceQuestions><ChoiceQuestion><Title><RichText><Text>题目</Text></RichText></Title><OptionItems><OptionItem><Option><RichText><Text>甲</Text></RichText></Option><Answer>True</Answer></OptionItem><OptionItem><Option><RichText><Text>乙</Text></RichText></Option><Answer>False</Answer></OptionItem></OptionItems></ChoiceQuestion></ChoiceQuestions></ChoiceActivityConfig>'
  const slide = parseSlideXML(slideXml('Choice', choice))
  assert.equal(slide.activities![0].playable, true)
  assert.equal(slide.activities![0].questions![0].options.length, 2)
})

test('画布素材在半倍缩放下拖放、取消、错误退回及重新抓取，不修改保存坐标', async () => {
  const slide = parseSlideXML(slideXml('TextMatch', pairConfig))
  const saved = JSON.stringify(slide)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host as unknown as HTMLElement)
  await act(async () => root.render(<SlideRenderer slide={slide} scale={0.5} />))
  const canvas = host.querySelector('[data-activity-canvas]') as unknown as HTMLElement
  assert.equal(canvas.parentElement?.style.transform, 'scale(0.5)')
  assert.equal(host.querySelector('[data-element-id="m"]'), null)
  const target = host.querySelector('[data-matching-target]') as unknown as HTMLElement
  target.getBoundingClientRect = () => ({ left: 100, top: 50, right: 160, bottom: 80,
    width: 60, height: 30, x: 100, y: 50, toJSON() {} })
  const material = (id: string) => host.querySelector(`[data-matching-material="${id}"]`) as unknown as HTMLElement
  const pointer = async (id: string, type: string, x: number, y: number) => act(async () => {
    material(id).dispatchEvent(new window.PointerEvent(type, { bubbles: true, pointerId: 3, button: 0,
      clientX: x, clientY: y }) as unknown as Event)
  })
  await pointer('d', 'pointerdown', 0, 0)
  await pointer('d', 'pointermove', 40, 20)
  assert.equal(material('d').style.left, '80px')
  assert.equal(material('d').style.top, '40px')
  await pointer('d', 'pointercancel', 40, 20)
  assert.equal(material('d').style.left, '0px')
  assert.deepEqual(matchingSession(slide.activities![0]).placements, {})
  await pointer('d', 'pointerdown', 0, 0)
  await pointer('d', 'pointerup', 120, 60)
  // 浏览器拖放后的合成点击不得重新选中已放置素材。
  await act(async () => material('d').click())
  const session = matchingSession(slide.activities![0])
  assert.deepEqual(session.placements, { c: 'd' })
  assert.equal(session.selectedId, null)
  const check = Array.from(host.querySelectorAll('button')).find(button => button.textContent === '检查答案')!
  await act(async () => check.click())
  assert.deepEqual(session.placements, {})
  await pointer('m', 'pointerdown', 0, 0)
  await pointer('m', 'pointerup', 120, 60)
  assert.deepEqual(session.placements, { c: 'm' })
  await pointer('m', 'pointerdown', 120, 60)
  await pointer('m', 'pointerup', 300, 200)
  assert.deepEqual(session.placements, {})
  assert.equal(JSON.stringify(slide), saved)
  await act(async () => root.unmount())
  host.remove()
})
