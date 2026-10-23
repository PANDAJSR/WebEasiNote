import assert from 'node:assert/strict'
import { test } from 'node:test'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import { SlideRenderer } from '../src/components/SlideRenderer'
import { parseSlideXML } from '../src/enbx/parser'
import { competitionSession } from '../src/viewer/activities/competition'

const window = new Window()
Object.assign(globalThis, { window, document: window.document, DOMParser: window.DOMParser,
  XMLSerializer: window.XMLSerializer, HTMLElement: window.HTMLElement, Element: window.Element,
  SVGElement: window.SVGElement, ShadowRoot: window.ShadowRoot, CSS: window.CSS,
  getComputedStyle: window.getComputedStyle.bind(window), IS_REACT_ACT_ENVIRONMENT: true, React })
window.matchMedia = (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })) as typeof window.matchMedia

test('分组竞争页面启动、计分去重、选择/失焦/离页暂停、恢复会话与重置', async () => {
  const slide = parseSlideXML('<Slide><Id>s</Id><Width>800</Width><Height>600</Height><Elements><ActivityItem><Id>m</Id><ActivityId>a</ActivityId><ResourceType>Material</ResourceType><Width>100</Width><Height>60</Height><RichText><RichText><Text>正确素材</Text></RichText></RichText></ActivityItem></Elements><Activity><Id>a</Id><Key>GroupCompetition</Key><Config><GroupCompetitionConfig><Difficulty>Low</Difficulty><Items><GroupCompetitionItem><Id>m</Id><Text>正确素材</Text><IsCorrect>True</IsCorrect></GroupCompetitionItem></Items></GroupCompetitionConfig></Config></Activity></Slide>')
  const saved = JSON.stringify(slide)
  const definition = slide.activities![0]
  const host = document.createElement('div')
  document.body.appendChild(host)
  let root = createRoot(host as unknown as HTMLElement)
  const render = (paused = false) => act(async () => root.render(<SlideRenderer slide={slide}
    playbackSelection={{ enabled: paused, onChange() {}, onDuplicate() {}, onCommand() {} }} />))
  const clickText = async (label: string) => {
    const button = Array.from(host.querySelectorAll('button')).find(node => node.textContent?.replace(/\s/g, '') === label)
    assert.ok(button, label)
    await act(async () => button.click())
  }
  await render()
  await clickText('分组竞争·开始活动')
  await clickText('开始')
  const item = host.querySelector('[data-competition-item][data-competition-player="0"]') as unknown as HTMLElement
  assert.ok(item)
  await act(async () => { item.click(); item.click() })
  assert.equal(competitionSession(definition).players[0].score, 10)
  assert.equal(competitionSession(definition).players[1].score, 0)
  await render(true)
  assert.equal(competitionSession(definition).state, 'paused')
  await render()
  await clickText('继续')
  await act(async () => window.dispatchEvent(new window.Event('blur')))
  assert.equal(competitionSession(definition).state, 'paused')
  await clickText('继续')
  await act(async () => root.unmount())
  assert.equal(competitionSession(definition).state, 'paused')
  root = createRoot(host as unknown as HTMLElement)
  await render()
  await clickText('分组竞争·开始活动')
  assert.ok(host.textContent?.includes('10 分'))
  await clickText('重新开始')
  assert.equal(competitionSession(definition).players[0].score, 0)
  assert.equal(JSON.stringify(slide), saved)
  await act(async () => root.unmount())
  host.remove()
  await window.happyDOM.close()
})
