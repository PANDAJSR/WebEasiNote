import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { GlobalFonts, createCanvas } from '@napi-rs/canvas'
import { Window } from 'happy-dom'
import { parseRuledPaperElement } from '../src/enbx/ruled-papers'
import { TextElementRenderer } from '../src/components/slide-renderer/TextElementRenderer'
import { getRuledPaperLayout } from '../src/components/slide-renderer/RuledPaperRenderer'
import { ruledPaperFontCss, RULED_PAPER_FONT } from '../src/text/ruled-paper-font'
import { collectMissingFontIssues } from '../src/viewer/viewer-font-issues'
import type { SlideData } from '../src/types'

Object.assign(globalThis, { React })
const dom = new Window()
const parse = (content: string) => parseRuledPaperElement(
  new dom.DOMParser().parseFromString(`<RuledPaper>${content}</RuledPaper>`, 'text/xml')
    .documentElement as unknown as Element)!

test('Words、RichText 和空白纸均使用官方专用字体，保留 RichText 样式', () => {
  const words = parse('<Height>304.6</Height><Words>Apple&#13;&#10;Pear</Words>')
  assert.deepEqual(words.textLines.map(line => line.textRuns[0].text), ['Apple', 'Pear'])
  assert.ok(words.textLines.every(line => line.textRuns[0].fontFamily === 'SeewoEnglishHandwriting'))
  assert.equal(words.textLines[0].textRuns[0].fontSize, 96)
  const rich = parse(`<Words>ignored</Words><RichText><TextLines><TextLine>
    <TextRuns><TextRun><Text>Apple</Text><FontFamily>Arial</FontFamily><FontSize>96</FontSize>
    <Foreground><ColorBrush>#FF336699</ColorBrush></Foreground></TextRun></TextRuns>
    </TextLine></TextLines></RichText>`)
  assert.equal(rich.textLines[0].textRuns[0].text, 'Apple')
  assert.equal(rich.textLines[0].textRuns[0].fontFamily, 'SeewoEnglishHandwriting')
  assert.equal(rich.textLines[0].textRuns[0].fontSize, 96)
  assert.equal(parse('').textLines.length, 1)
  assert.deepEqual(collectMissingFontIssues([{ id: 'paper-slide', elements: [words] } as SlideData]), [])
})

test('打包字体数据通过哈希和独立字体引擎校验，无需安装系统字体', () => {
  const encoded = ruledPaperFontCss.match(/base64,([^)]*)\)/)![1]
  const bytes = Buffer.from(encoded, 'base64')
  assert.equal(bytes.length, 26496)
  assert.equal(createHash('sha256').update(bytes).digest('hex'),
    '433589be26f881d4d745892590bad682f4c2598e092079efc2597d5fce6d5719')
  assert.ok(GlobalFonts.register(bytes, RULED_PAPER_FONT))
  const context = createCanvas(400, 200).getContext('2d')
  context.font = `96px "${RULED_PAPER_FONT}"`
  const handwriting = context.measureText('Apple gyp').width
  context.font = '96px sans-serif'
  assert.ok(handwriting > 0)
  assert.notEqual(handwriting, context.measureText('Apple gyp').width)
})

test('格线按官方周期及粗细渲染，多段不合并边界，背景透明度不影响格线', () => {
  assert.deepEqual(getRuledPaperLayout(304.6, 2), { rows: 2, naturalHeight: 304.6, ratio: 1 })
  const paper = parse('<Width>500</Width><Height>304.6</Height><Opacity>0.2</Opacity><Words>Apple&#10;Pear</Words>')
  const markup = renderToStaticMarkup(<TextElementRenderer element={paper} scale={2} />)
  const document = new dom.DOMParser().parseFromString(markup, 'text/html')
  const svg = document.querySelector('svg')!
  assert.equal(svg.getAttribute('viewBox'), '0 0 500 304.6')
  const background = svg.querySelector('rect')!
  assert.equal(background.getAttribute('opacity'), '0.2')
  const guides = [...svg.querySelector('svg')!.querySelectorAll('rect')]
  assert.deepEqual(guides.map(line => line.getAttribute('y')), ['20', '52', '83', '116', '160', '192', '223', '256'])
  assert.deepEqual(guides.map(line => line.getAttribute('height')), ['1', '1', '3', '1', '1', '1', '3', '1'])
  assert.ok(guides.every(line => !line.hasAttribute('opacity')))
  assert.match(markup, /data:font\/ttf;base64,/)
  assert.match(markup, /WebEasiNote Ruled Paper/)
  const empty = renderToStaticMarkup(<TextElementRenderer element={parse('')} scale={1} />)
  assert.equal((empty.match(/height="3"/g) || []).length, 1)
})
