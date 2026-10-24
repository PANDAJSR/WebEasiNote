import assert from 'node:assert/strict'
import { test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Window } from 'happy-dom'
import { parseSlideElements } from '../src/enbx/slide-elements-parser'
import { ElementRenderer } from '../src/components/slide-renderer/ElementRenderer'
import { layoutView } from '../src/components/view/view-layout'
import { subjectResourcePaths } from '../src/courseware/subject-resources'
import type { SlideData } from '../src/types'

const dom = new Window()
Object.assign(globalThis, { window: dom, document: dom.document, React,
  DOMParser: dom.DOMParser, XMLSerializer: dom.XMLSerializer })
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
