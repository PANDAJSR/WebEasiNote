import assert from 'node:assert/strict'
import { test } from 'node:test'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import { SlideRenderer } from '../src/components/SlideRenderer'
import { parseSlideXML } from '../src/enbx/parser'
import { advanceJudge, judgeSession } from '../src/viewer/activities/judge'

const window = new Window()
Object.assign(globalThis, { window, document: window.document, DOMParser: window.DOMParser,
  XMLSerializer: window.XMLSerializer, HTMLElement: window.HTMLElement, Element: window.Element,
  SVGElement: window.SVGElement, ShadowRoot: window.ShadowRoot, CSS: window.CSS,
  getComputedStyle: window.getComputedStyle.bind(window), IS_REACT_ACT_ENVIRONMENT: true, React })
window.matchMedia = (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })) as typeof window.matchMedia

test('判断画布双人答题、嵌入内容、失焦/选择/离页暂停与重置', async () => {
  const slide = parseSlideXML(`<Slide><Id>j</Id><Width>1600</Width><Height>900</Height><Elements>
    <ActivityItem><Id>old</Id><ActivityId>a</ActivityId><ResourceType>Material</ResourceType><Width>100</Width><Height>50</Height>
    <RichText><RichText><Text>原始活动角色</Text></RichText></RichText></ActivityItem></Elements>
    <Activity><Id>a</Id><Key>Judge</Key><Config><JudgeConfig><Theme>两组判断</Theme><Interval>1000</Interval><JudgeItems>
    <JudgeItem><Text>不应替代内嵌内容</Text><Contents><Text><Id>q</Id><Width>300</Width><Height>100</Height>
    <RichText><Text>内嵌题目</Text></RichText></Text></Contents><Answer>False</Answer></JudgeItem>
    </JudgeItems></JudgeConfig></Config></Activity></Slide>`)
  const definition = slide.activities![0]
  const saved = JSON.stringify(definition)
  const host = document.createElement('div')
  document.body.append(host)
  let root = createRoot(host)
  const render = async (select = false) => act(async () => root.render(<SlideRenderer slide={slide} scale={0.75}
    playbackSelection={{ enabled: select, selectedElementIds: [] }} />))
  const click = async (label: string, scope: ParentNode = host) => {
    const button = Array.from(scope.querySelectorAll('button')).find(node => node.getAttribute('aria-label') === label || node.textContent?.includes(label))
    assert.ok(button, `missing ${label}`)
    await act(async () => button.click())
  }
  await render()
  assert.ok(host.querySelector('[data-activity-canvas="Judge"]'))
  assert.equal(host.querySelectorAll('[data-judge-player]').length, 2)
  assert.equal(host.querySelectorAll('[data-judge-content]').length, 2)
  assert.ok(!host.textContent?.includes('原始活动角色'))
  assert.ok(!host.textContent?.includes('提交答案'))
  await click('开始')
  await act(async () => { advanceJudge(definition, 3000); await render() })
  await click('错误', host.querySelector('[data-judge-player="0"]')!)
  await click('正确', host.querySelector('[data-judge-player="1"]')!)
  assert.equal(host.querySelectorAll('[aria-pressed="true"]').length, 2)
  await act(async () => window.dispatchEvent(new window.Event('blur')))
  assert.equal(judgeSession(definition).state, 'paused')
  await click('继续')
  await render(true)
  assert.equal(judgeSession(definition).state, 'paused')
  assert.equal(host.querySelector('[data-activity-canvas="Judge"]'), null)
  assert.ok(host.textContent?.includes('原始活动角色'))
  await render()
  await click('继续')
  await act(async () => root.unmount())
  assert.equal(judgeSession(definition).state, 'paused')
  root = createRoot(host)
  await render()
  assert.equal(host.querySelectorAll('[aria-pressed="true"]').length, 2)
  await click('继续')
  await act(async () => { advanceJudge(definition, 1000); await render() })
  assert.deepEqual(judgeSession(definition).players.map(player => player.score), [1, 0])
  assert.ok(host.textContent?.includes('回答正确'))
  assert.ok(host.textContent?.includes('回答错误'))
  await act(async () => { advanceJudge(definition, 2000); await render() })
  assert.ok(host.textContent?.includes('第 1 组获胜'))
  await click('重新开始')
  assert.equal(judgeSession(definition).state, 'ready')
  assert.equal(JSON.stringify(definition), saved)
  await act(async () => root.unmount())
  host.remove()
})
