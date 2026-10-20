import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import { parseSlideElements } from '../src/enbx/slide-elements-parser'
import { SlideRenderer } from '../src/components/SlideRenderer'
import { staticPreview } from '../src/components/slide-viewer/SlidePreview'
import { PronounceButton, resolvePronounceUrl } from '../src/components/subject-cards/PronounceButton'
import { pronunciationKey } from '../src/components/subject-cards/chinese-pronunciation'
import { subjectResourcePaths } from '../src/courseware/subject-resources'
import type { SlideData } from '../src/types'

const dom = new Window()
Object.assign(globalThis, { window: dom, document: dom.document, React, HTMLElement: dom.HTMLElement,
  XMLSerializer: dom.XMLSerializer, IS_REACT_ACT_ENVIRONMENT: true })
const xml = (value: string) => new dom.DOMParser().parseFromString(value, 'text/xml').documentElement as unknown as Element
const fixture = readFileSync(new URL('./fixtures/subject-cards.xml', import.meta.url), 'utf8')
const parsed = parseSlideElements(xml(fixture), { slideId: 'subjects' })
const slide: SlideData = { id: 'subjects', width: 1280, height: 720, backgroundColor: '#ffffff',
  animations: [], animationOrders: [], issues: parsed.issues, elements: parsed.elements }

test('学科卡片按保存契约解析，保留原始 XML 和组偏移', () => {
  assert.deepEqual(parsed.issues, [])
  assert.deepEqual(parsed.elements.map(item => item.type), ['englishWordCard', 'hanziCard', 'pinyinCard', 'text'])
  const [word, hanzi, pinyin, paper] = parsed.elements
  assert.equal(word.type, 'englishWordCard')
  if (word.type !== 'englishWordCard' || hanzi.type !== 'hanziCard' || pinyin.type !== 'pinyinCard' || paper.type !== 'text') return
  assert.equal(word.currentContentType, 'Sentence')
  assert.equal(word.synonyms[0].semantics[0].semantic, '闪亮的')
  assert.deepEqual(hanzi.characters[0].pinyinList, ['xíng', 'háng'])
  assert.equal(hanzi.characters[0].strokeCode, '332112')
  assert.equal(pinyin.pinyins[0].tonePinyin, 'lǜ')
  assert.equal(pinyin.lineColor, '#008844')
  assert.deepEqual(paper.textLines.map(line => line.textRuns[0].text), ['Apple', 'Pear'])
  assert.ok(hanzi.rawXml?.includes('<HanziList>'))
  const group = parseSlideElements(xml(`<Elements><Group><Id>g</Id><X>10</X><Y>20</Y>${fixture}</Group></Elements>`), { slideId: 'g' })
  assert.equal(group.elements[0].x, word.x + 10)
  assert.equal(group.elements[0].y, word.y + 20)
  assert.deepEqual([...subjectResourcePaths([slide])].sort(), ['Resources/hang.mp3', 'Resources/lv4.mp3', 'Resources/shining.mp3'])
})

test('兼容旧版汉字拼音、空练习纸和数字栏目，未知字段继续报告', () => {
  const result = parseSlideElements(xml(`<Elements>
    <HanziCard><Character>好</Character><Pinyin>hǎo</Pinyin></HanziCard>
    <PinyinCard><Pinyin>a</Pinyin><TonePinyin>ā</TonePinyin><IsTonePinyinsVisible>True</IsTonePinyinsVisible></PinyinCard>
    <RuledPaper><Id>empty</Id></RuledPaper>
    <EnglishWordCard><Word>word</Word><CurrentContentType>1</CurrentContentType><ResourcePattern><RelativeText>x</RelativeText></ResourcePattern><FutureField>x</FutureField></EnglishWordCard>
  </Elements>`), { slideId: 'old' })
  const [hanzi, pinyin, paper, word] = result.elements
  assert.equal(hanzi.type === 'hanziCard' && hanzi.characters[0].hanzi, '好')
  assert.equal(pinyin.type === 'pinyinCard' && pinyin.pinyins[0].tonePinyin, 'ā')
  assert.ok(paper.type === 'text' && paper.ruledPaper)
  assert.equal(word.type === 'englishWordCard' && word.currentContentType, 'Phrase')
   assert.equal(result.issues[0].name, 'FutureField')
  assert.equal(pronunciationKey('lǜ'), 'lü4')
  assert.equal(pronunciationKey('lv4.mp3'), 'lü4')
  assert.equal(resolvePronounceUrl('id://voice', { voice: 'blob:voice' }), 'blob:voice')
  assert.equal(resolvePronounceUrl('file:///C:/voice.mp3', {}), undefined)
})

test('词典切换折叠、多音字和声调操作不会触发元素动画', async () => {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  let animations = 0
  const click = async (selector: string) => act(async () => {
    const target = container.querySelector(selector) as unknown as HTMLButtonElement
    assert.ok(target, selector)
    target.click()
  })
  try {
    await act(async () => root.render(<SlideRenderer slide={slide} onElementClick={() => { animations++; return true }} />))
    assert.match(container.querySelector('[role="tabpanel"]')!.textContent!, /The sun is bright/)
    await click('[role="tab"]:nth-child(2)')
    assert.match(container.querySelector('[role="tabpanel"]')!.textContent!, /光明的未来/)
    await click('[aria-label="收起词典"]')
    assert.equal(container.querySelector('[role="tabpanel"]'), null)
    await click('[aria-label="展开词典"]')
    assert.match(container.querySelector('[role="tabpanel"]')!.textContent!, /bright future/)
    const select = container.querySelector('select') as unknown as HTMLSelectElement
    await act(async () => { select.value = 'háng'; select.dispatchEvent(new dom.Event('change', { bubbles: true }) as unknown as Event) })
    assert.equal(select.value, 'háng')
    const pinyin = container.querySelector('[aria-label="拼音卡片"]')!
    assert.match(pinyin.textContent!, /lǜ/)
    await click('[aria-label="lü 的声调"]')
    assert.ok(container.querySelector('[aria-label="标调 lǜ"]'))
    await click('[aria-label="标调 lǜ"]')
    assert.ok(!pinyin.textContent!.includes('lǜ'))
    assert.match(pinyin.textContent!, /lü/)
    assert.equal(animations, 0)
  } finally {
    await act(async () => root.unmount())
    container.remove()
  }
})

test('静态预览保留学科卡片外观且不挂载音频，返回授课后恢复媒体', async () => {
  const container = document.createElement('div')
  const root = createRoot(container)
  try {
    await act(async () => root.render(<SlideRenderer slide={staticPreview(slide)} currentIndex={-1} />))
    for (const label of ['汉字卡片', '拼音卡片', '英汉词典 bright']) {
      assert.ok(container.querySelector(`[aria-label="${label}"]`))
    }
    assert.equal(container.querySelector('audio'), null)
    await act(async () => root.render(<SlideRenderer slide={slide} />))
    assert.ok(container.querySelector('audio'))
    await act(async () => root.render(<SlideRenderer slide={slide} isEditMode />))
    assert.equal(container.querySelector('audio'), null)
  } finally { await act(async () => root.unmount()) }
})

test('发音暂停、异步播放跨页及卸载清理，资源缺失时禁用', async () => {
  let finish!: () => void
  let pauses = 0
  dom.HTMLMediaElement.prototype.play = function () { return new Promise<void>(resolve => { finish = resolve }) }
  dom.HTMLMediaElement.prototype.pause = function () { pauses++ }
  const container = document.createElement('div')
  const root = createRoot(container)
  const render = async (active: boolean, source = 'id://voice') => act(async () => root.render(
    <PronounceButton source={source} active={active} resourceMap={{ voice: 'blob:voice' }} />))
  try {
    await render(true)
    await act(async () => (container.querySelector('button') as unknown as HTMLButtonElement).click())
    assert.ok(finish)
    await render(false)
    assert.equal(container.querySelector('audio'), null)
    const stopped = pauses
    await act(async () => finish())
    assert.ok(pauses > stopped)
    await render(true, 'id://missing')
    assert.equal((container.querySelector('button') as unknown as HTMLButtonElement).disabled, true)
    const before = pauses
    await act(async () => root.unmount())
    assert.ok(pauses > before)
  } finally { await act(async () => root.unmount()) }
})
