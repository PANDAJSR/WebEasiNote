import assert from 'node:assert/strict'
import { test } from 'node:test'
import React, { act } from 'react'
import { readFileSync } from 'node:fs'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { Window } from 'happy-dom'
import { parseSlideElements } from '../src/enbx/slide-elements-parser'
import { ElementRenderer } from '../src/components/slide-renderer/ElementRenderer'
import { layoutView } from '../src/components/view/view-layout'
import { subjectResourcePaths } from '../src/courseware/subject-resources'
import type { SlideData } from '../src/types'
import type { ViewElement } from '../src/types/view'
import { executeViewLink, parseViewLink } from '../src/components/view/view-actions'
import { resourceBlob } from '../src/courseware/resource-blob'

const dom = new Window()
Object.assign(globalThis, { window: dom, document: dom.document, React,
  DOMParser: dom.DOMParser, XMLSerializer: dom.XMLSerializer, IS_REACT_ACT_ENVIRONMENT: true })
const parse = (xml: string) => parseSlideElements(new dom.DOMParser()
  .parseFromString(`<Elements>${xml}</Elements>`, 'text/xml').documentElement as unknown as Element, { slideId: 'view-test' })
const cell = (id: string, x: number, y = 0) => `<Picture><Id>${id}</Id><X>${x}</X><Y>${y}</Y>
  <Width>40</Width><Height>50</Height><Source>Resources/${id}.png</Source></Picture>`
const viewXml = (layout = 'Default', extra = '') => `<View><Id>periodic</Id><X>120</X><Y>80</Y>
  <Width>200</Width><Height>100</Height><Rotation>15</Rotation><LocalId>table</LocalId>
  <LayoutType>${layout}</LayoutType><PermittedTransforms>RenderTransform</PermittedTransforms>${extra}
  <Elements>${cell('H', 0)}${cell('He', 60)}</Elements></View>`

test('View 保留子元素、原始 XML、内部标识及组偏移，不再报未知元素', () => {
  const result = parse(`<Group><Id>g</Id><X>10</X><Y>20</Y><Elements>${viewXml()}</Elements></Group>`)
  assert.deepEqual(result.issues, [])
  const [view] = result.elements
  assert.equal(view.type, 'view')
  if (view.type !== 'view') return
  assert.equal(view.x, 130)
  assert.equal(view.y, 100)
  assert.equal(view.localId, 'table')
  assert.equal(view.permittedTransforms, 'RenderTransform')
  assert.deepEqual(view.elements.map(e => e.x), [0, 60])
  assert.ok(view.rawXml?.includes('<LocalId>table</LocalId>'))
  assert.deepEqual([...subjectResourcePaths([{ elements: [view] } as SlideData])].sort(),
    ['Resources/H.png', 'Resources/He.png'])
})

test('默认和 Zoom View 统一等比缩放，Grid 和 StackPanel 使用面板坐标', () => {
  for (const layout of ['Default', 'Zoom', '0', 'Grid', '1', 'StackPanel', '2']) {
    const [view] = parse(viewXml(layout)).elements
    assert.ok(view.type === 'view')
    const result = layoutView(view)
    if (['Default', 'Zoom', '0'].includes(layout)) {
      assert.equal(result.scale, 2)
      assert.deepEqual(result.elements.map(e => [e.x, e.y]), [[0, 0], [60, 0]])
    } else {
      assert.equal(result.scale, 1)
      assert.deepEqual(result.elements.map(e => [e.x, e.y]), ['Grid', '1'].includes(layout)
        ? [[80, 25], [80, 25]] : [[80, 0], [80, 50]])
    }
  }
})

test('View 递归渲染资源、旋转及自定义旋转中心，隐藏容器没有可见子树', () => {
  const render = (xml: string) => renderToStaticMarkup(<ElementRenderer element={parse(xml).elements[0]}
    scale={.5} resourceMap={{ 'Resources/H.png': 'blob:h', 'Resources/He.png': 'blob:he' }}
    slideIndex={0} currentIndex={0} />)
  const markup = render(viewXml('Default', '<RotateOrigin>0,1</RotateOrigin>'))
  assert.match(markup, /data-view-id="periodic"/)
  assert.match(markup, /left:60px;top:40px/)
  assert.match(markup, /rotate\(15deg\)/)
  assert.match(markup, /transform-origin:0% 100%/)
  assert.match(markup, /src="blob:h"/)
  assert.match(markup, /src="blob:he"/)
  assert.doesNotMatch(markup, /无法显示/)
  assert.equal(render(viewXml('Default', '<IsHidden>True</IsHidden>')), '')
  const nested = `<View><Id>outer</Id><Width>400</Width><Height>200</Height><Elements>${viewXml()}</Elements></View>`
  assert.equal((render(nested).match(/data-view-id=/g) || []).length, 2)
})

test('隐藏子 View 不参与默认测量和堆叠高度，未知子元素仍有诊断', () => {
  const hidden = '<View><Id>hidden</Id><X>1000</X><Y>1000</Y><Width>500</Width><Height>500</Height><IsHidden>True</IsHidden><Elements /></View>'
  for (const layout of ['Default', 'StackPanel']) {
    const result = parse(`<View><Width>80</Width><Height>100</Height><LayoutType>${layout}</LayoutType>
      <Elements>${hidden}${cell('H', 0)}</Elements></View>`)
    assert.deepEqual(result.issues, [])
    const [view] = result.elements
    assert.ok(view.type === 'view')
    const arranged = layoutView(view)
    if (layout === 'Default') assert.equal(arranged.scale, 2)
    else assert.equal(arranged.elements[1].y, 0)
  }
  assert.equal(parse('<View><Elements><NewElement /></Elements></View>').issues[0].name, 'NewElement')
})

const cardXml = readFileSync(new URL('./fixtures/periodic-card.xml', import.meta.url), 'utf8')
const card = () => parse(cardXml).elements[0] as ViewElement
const panel = (view: ViewElement, index: number) => view.elements[index] as ViewElement
const link = (view: ViewElement, index: number) => panel(view, index).elements[1].hyperlink!

test('实际元素卡链接切换面板、保持祖先缩放和位置，重复收放不改变源数据', () => {
  const source = card()
  const before = JSON.stringify(source)
  for (const scale of [1, .5, 2]) {
    let view = { ...source, width: 96 * scale, height: 96 * scale }
    for (let i = 0; i < 5; i++) {
      const expanded = executeViewLink(view, link(source, 0))
      view = expanded.root
      assert.equal(expanded.front, true)
      assert.deepEqual([view.x, view.y, view.width, view.height], [40, 30, 300 * scale, 458 * scale])
      assert.equal(panel(view, 0).isHidden, true)
      assert.equal(panel(view, 1).isHidden, false)
      const collapsed = executeViewLink(view, link(source, 1))
      view = collapsed.root
      assert.equal(collapsed.front, false)
      assert.deepEqual([view.width, view.height], [96 * scale, 96 * scale])
    }
  }
  assert.equal(JSON.stringify(source), before)
})

test('属性链接支持 self/this、大小写属性、LocalId 中的点和重复解码', () => {
  assert.deepEqual(parseViewLink('view://property?part.one.WIDTH=12%253D3&Front=true'), [
    { localId: 'part.one', property: 'width', value: '12=3' },
    { localId: 'self', property: 'front', value: 'true' }
  ])
  const source = card()
  const changed = executeViewLink(source, 'view://property?this.WIDTH=200&self.HEIGHT=150&Front=false').root
  assert.deepEqual([changed.width, changed.height], [200, 150])
  assert.equal(executeViewLink(source, 'https://example.com').root, source)
  assert.equal(executeViewLink(source, 'view://property?missing.IsHidden=true').root, source)
  assert.equal(parseViewLink('view://property?bad=%zz'), null)
})

test('真实卡片 DOM 收放隔离根 LocalId、阻止翻页拖动事件，并在替换课件时复位', async () => {
  const source = card()
  const sibling = { ...source, id: 'second-card', x: 162 }
  const container = document.createElement('div')
  const root = createRoot(container)
  let bubbled = 0
  const fronts: string[] = []
  const render = (value = source, enabled = true, editing = false) => act(async () => root.render(
    <div onClick={() => bubbled++} onMouseDown={() => bubbled++} onPointerDown={() => bubbled++}>
      {[value, sibling].map(element => <ElementRenderer key={element.id} element={element} scale={1}
        resourceMap={{}} slideIndex={0} currentIndex={0} isEditMode={editing}
        viewControlsEnabled={enabled} onViewFront={id => fronts.push(id)} />)}
    </div>))
  const first = () => container.querySelector(`[data-view-id="${source.id}"]`) as HTMLElement
  const button = () => first().querySelector('button') as HTMLButtonElement
  try {
    await render()
    await act(async () => {
      button().dispatchEvent(new dom.PointerEvent('pointerdown', { bubbles: true }) as unknown as Event)
      button().dispatchEvent(new dom.MouseEvent('mousedown', { bubbles: true }) as unknown as Event)
      button().click()
    })
    assert.equal(first().style.width, '300px')
    assert.equal(first().style.height, '458px')
    assert.equal(button().getAttribute('aria-label'), '收起元素卡片')
    assert.equal(button().style.left, '250px')
    assert.equal((container.querySelector('[data-view-id="second-card"]') as HTMLElement).style.width, '96px')
    assert.deepEqual(fronts, [source.id])
    assert.equal(bubbled, 0)
    await act(async () => button().click())
    assert.equal(first().style.width, '96px')
    assert.deepEqual(fronts, [source.id])
    await render(source, true, true)
    await act(async () => button().click())
    assert.equal(first().style.width, '300px')
    await render(card())
    assert.equal(first().style.width, '96px')
    await render(source)
    assert.equal(first().style.width, '96px')
    await render(source, false)
    assert.equal(container.querySelectorAll('button').length, 0)
  } finally { await act(async () => root.unmount()) }
})

test('卡片图片保留阴影与实际裁剪区域，SVG ZIP Blob 声明 MIME 且保持内容', async () => {
  const source = card()
  const picture = panel(source, 0).elements[0]
  assert.ok(picture.type === 'picture')
  assert.deepEqual(picture.shadow, { offset: 1, angle: 360, opacity: .45, blurRadius: 10, color: '#949499' })
  const detailed = panel(source, 1).elements[0]
  assert.ok(detailed.type === 'picture')
  assert.deepEqual(detailed.displayRegion, { x: 0, y: 0, width: 480, height: 736 })
  const markup = renderToStaticMarkup(<ElementRenderer element={picture} scale={1}
    resourceMap={{ [picture.sourceId]: 'blob:card' }} slideIndex={0} currentIndex={0} />)
  const rendered = new dom.DOMParser().parseFromString(markup, 'text/html')
  const shadow = rendered.querySelector('[data-picture-shadow="drop"]')!
  assert.equal(shadow.getAttribute('fill'), '#949499')
  assert.equal(shadow.getAttribute('d'), 'M0,0h96v96h-96Z')
  assert.equal(shadow.parentElement!.parentElement!.getAttribute('opacity'), '0.45')
  assert.equal(rendered.querySelector('feGaussianBlur')!.getAttribute('stdDeviation'), '5')
  const image = rendered.querySelector('[data-picture-image]')!
  assert.match(image.getAttribute('style')!, /overflow:hidden/)
  assert.equal(image.closest('[data-picture-effects]'), null)
  assert.ok(markup.indexOf('data-picture-shadow') < markup.indexOf('data-picture-image'))
  const translucent = renderToStaticMarkup(<ElementRenderer element={{ ...picture,
    shadow: { ...picture.shadow!, color: 'rgba(148, 148, 153, 0.5)' } }} scale={1}
    resourceMap={{ [picture.sourceId]: 'blob:card' }} slideIndex={0} currentIndex={0} />)
  assert.match(translucent, /fill="rgba\(148, 148, 153, 0.5\)"/)
  assert.match(translucent, /opacity="0.45"/)
  const blob = new Blob(['<svg>钙</svg>'])
  const svg = resourceBlob(blob, 'Resources/card.SVG')
  assert.equal(svg.type, 'image/svg+xml')
  assert.equal(await svg.text(), await blob.text())
  assert.equal(resourceBlob(blob, 'Resources/card.png'), blob)
})
