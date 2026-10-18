import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Window } from 'happy-dom'
import { resolveTextMarkers } from '../src/text-markers'
import { parseRichTextNode } from '../src/text-parser'
import { TextElementRenderer } from '../src/components/slide-renderer/TextElementRenderer'
import { ShapeInlineText } from '../src/components/shape-renderer/ShapeInlineText'
import { TopicNodeBox } from '../src/components/topic-renderer/TopicNodeBox'
import type { ShapeElement } from '../src/shapes'
import type { TextElement, TextLine } from '../src/types'

Object.assign(globalThis, { React })
const dom = new Window()

function line(type: string, char?: string, fontFamily?: string, startAt?: number): TextLine {
  return { textAlignment: 'Left', textMarker: type,
    textMarkerStyle: { char, fontFamily, startAt },
    textRuns: [{ text: '正文', fontFamily: 'Arial', fontSize: 56,
      fontWeight: 'normal', fontStyle: 'normal', color: '#262626' }] }
}

function parseMarkup(html: string) {
  const container = dom.document.createElement('div')
  container.innerHTML = html
  return Array.from(container.querySelectorAll('span'))
}

test('Wingdings 按字符转换，保留自定义字符和独立字体变体', () => {
  for (const char of ['l', '\uf06c']) {
    const marker = resolveTextMarkers([line('Circle', char, 'Wingdings')])[0]
    assert.equal(marker?.text, '●')
    assert.ok(!marker?.fontFamily?.toLowerCase().includes('wingdings'))
  }
  for (const char of ['\u00d8', '\uf0d8']) {
    assert.equal(resolveTextMarkers([line('Circle', char, 'Wingdings')])[0]?.text, '➤')
  }
  assert.equal(resolveTextMarkers([line('Circle', 'l', 'pack://font/#WINGDINGS')])[0]?.text, '●')
  for (const [char, font] of [['l', 'Wingdings 2'], ['★', 'Arial'], ['?', 'Wingdings'], ['Ø', 'Arial']]) {
    const marker = resolveTextMarkers([line('Circle', char, font)])[0]
    assert.equal(marker?.text, char)
    assert.ok(marker?.fontFamily?.includes(font))
  }
  assert.equal(resolveTextMarkers([line('None', 'l', 'Wingdings')])[0], null)
  assert.deepEqual(resolveTextMarkers(['Circle', 'Square', 'Tick'].map(type => line(type)))
    .map(marker => marker?.text), ['●', '■', '✓'])
})

test('原课件第 7 页三段列表解析后渲染圆点，保留字号和已保存的换行', async () => {
  const xml = await readFile(new URL('./fixtures/page-7-circle-list.xml', import.meta.url), 'utf8')
  const richText = new dom.DOMParser().parseFromString(xml, 'text/xml').documentElement
  const { textLines } = parseRichTextNode(richText as unknown as Element)
  assert.equal(textLines.length, 3)
  assert.deepEqual(textLines.map(item => [item.textMarker, item.textMarkerStyle?.char,
    item.textMarkerStyle?.fontFamily, item.textMarkerStyle?.fontSize]),
  Array.from({ length: 3 }, () => ['Circle', 'l', 'Wingdings', 56]))
  assert.deepEqual(textLines.map(item => item.lines?.map(part => part.length)), [[15], [13, 14], [15, 4]])
  const element: TextElement = { type: 'text', id: 'list', x: 0, y: 0,
    width: 900, height: 500, textLines }
  const shape = { ...element, type: 'shape', inlineText: textLines } as unknown as ShapeElement
  const renderers = [
    <TextElementRenderer element={element} scale={0.5} />,
    <ShapeInlineText element={shape} scale={0.5} visualPadding={0} />,
    <TopicNodeBox x={0} y={0} width={900} height={500} title="" textLines={textLines}
      fillColor="#fff" strokeColor="#000" textColor="#262626" textAlignment="Left"
      fontFamily="Arial" fontSize={56} scale={0.5} />
  ]
  for (const renderer of renderers) {
    const spans = parseMarkup(renderToStaticMarkup(renderer))
    const markers = spans.filter(span => span.textContent === '●')
    assert.equal(markers.length, 3)
    for (const marker of markers) {
      assert.equal(marker.style.fontSize, '28px')
      assert.ok(!marker.style.fontFamily.toLowerCase().includes('wingdings'))
    }
    assert.ok(!spans.some(span => span.textContent === '➤'))
  }
  const spans = parseMarkup(renderToStaticMarkup(renderers[0]))
  const visualLines = spans.filter(span => span.style.display === 'block')
  assert.deepEqual(visualLines.map(span => span.textContent.replace('●', '').length), [13, 14, 15, 4])
})

test('编号每段递增一次，空段、缩进、重复渲染及倒影不导致跳号', () => {
  const lines = [line('Decimal', undefined, undefined, 3), line('Decimal', undefined, undefined, 3),
    line('Decimal', undefined, undefined, 3)]
  lines[0].textRuns[0].textEffects = { reflection: { depth: 0.5, distance: 5, opacity: 0.5 } }
  lines[1].indent = 40
  lines[2].textRuns[0].text = ''
  const element: TextElement = { type: 'text', id: 'numbers', x: 0, y: 0,
    width: 900, height: 500, textLines: lines }
  const render = () => renderToStaticMarkup(<TextElementRenderer element={element} scale={1} />)
  const first = render()
  assert.equal(render(), first)
  const numbers = parseMarkup(first).filter(span => /^\d+\.$/.test(span.textContent))
  assert.deepEqual(numbers.map(span => span.textContent), ['3.', '4.', '5.', '3.', '4.', '5.'])
  assert.deepEqual(resolveTextMarkers([line('Decimal1'), line('Decimal2'),
    line('UpperLatin', undefined, undefined, 27), line('LowerLatin')]).map(marker => marker?.text),
  ['(1)', '①', 'AA.', 'a.'])
})
