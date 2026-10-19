import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import React from 'react'
import { Window } from 'happy-dom'

const dom = new Window()
Object.assign(globalThis, {
  window: dom,
  document: dom.document,
  Node: dom.Node,
  Element: dom.Element,
  HTMLElement: dom.HTMLElement,
  SVGElement: dom.SVGElement,
  DOMParser: dom.DOMParser,
  XMLSerializer: dom.XMLSerializer,
  getComputedStyle: dom.getComputedStyle.bind(dom),
  React
})

async function loadFixtureElements() {
  const xml = await readFile(new URL('./fixtures/flash-slide.xml', import.meta.url), 'utf8')
  return dom.DOMParser
    ? new dom.DOMParser().parseFromString(xml, 'text/xml').documentElement
    : new dom.window.DOMParser().parseFromString(xml, 'text/xml').documentElement
}

test('真实课件的 Flash 节点按契约解析（Source 去 id://，FlashWidth/Height 为舞台尺寸）', async () => {
  const elementsNode = await loadFixtureElements()
  const { parseFlashElement } = await import('../src/enbx/flashes')
  const flashes = Array.from(elementsNode.querySelectorAll('Flash'))
    .map(node => parseFlashElement(node as unknown as Element))

  assert.equal(flashes.length, 3)
  const first = flashes[0]
  assert.ok(first)
  assert.equal(first.type, 'flash')
  assert.equal(first.id, '88925594-3843-45ba-876c-d81822c79b84')
  assert.equal(first.sourceId, '7457501f7b8f00fbfc2941868f1b2d52')
  assert.equal(first.flashName, 'Main scene.swf')
  assert.equal(first.flashWidth, 800)
  assert.equal(first.flashHeight, 600)
  // 元素自身尺寸是图标按钮的尺寸，与舞台尺寸无关
  assert.equal(first.width, 64)
  assert.equal(first.height, 64)
  assert.equal(first.x, 1079.872)
  assert.equal(first.y, 253.675)
  assert.equal(first.rotation, 0)

  assert.deepEqual(
    flashes.map(flash => [flash?.flashWidth, flash?.flashHeight]),
    [[800, 600], [700, 492], [320, 240]]
  )
  assert.equal(flashes[1]?.flashName.endsWith('.swf'), true)
  assert.equal(flashes[2]?.flashName, 'unit2chant.swf')
})

test('FlashWidth/FlashHeight 缺省取契约默认值 99，非法值回退且元素尺寸回退 64', async () => {
  const { parseFlashElement } = await import('../src/enbx/flashes')
  const parse = (inner: string) => parseFlashElement(
    new dom.DOMParser().parseFromString(`<Flash>${inner}</Flash>`, 'text/xml').documentElement as unknown as Element
  )

  const minimal = parse('<Source>id://abc</Source>')
  assert.ok(minimal)
  assert.equal(minimal.sourceId, 'abc')
  assert.equal(minimal.flashWidth, 99)
  assert.equal(minimal.flashHeight, 99)
  assert.equal(minimal.width, 64)
  assert.equal(minimal.height, 64)
  assert.equal(minimal.flashName, '')

  const zeroStage = parse('<Source>id://abc</Source><FlashWidth>0</FlashWidth><FlashHeight>0</FlashHeight>')
  assert.equal(zeroStage?.flashWidth, 99)
  assert.equal(zeroStage?.flashHeight, 99)

  // Source 缺失仍返回元素（与视频一致），由渲染层提示资源未加载
  const noSource = parse('<Width>81</Width><Height>81</Height>')
  assert.equal(noSource?.sourceId, '')
  assert.equal(noSource?.width, 81)
})

test('真实 Flash 节点不产生未识别参数问题', async () => {
  const elementsNode = await loadFixtureElements()
  const { parseSlideElements } = await import('../src/enbx/slide-elements-parser')
  const parsed = parseSlideElements(elementsNode as unknown as Element, { slideId: 'flash' })

  assert.equal(parsed.elements.length, 3)
  assert.ok(parsed.elements.every(element => element.type === 'flash'))
  assert.deepEqual(parsed.issues, [])
  assert.ok(parsed.elements[0].rawXml?.startsWith('<Flash>'))
})

test('图标复刻官方红圆规格，字形随悬停切换', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { FlashRenderer } = await import('../src/components/FlashRenderer')
  const { parseFlashElement } = await import('../src/enbx/flashes')
  const elementsNode = await loadFixtureElements()
  const element = parseFlashElement(elementsNode.children[0] as unknown as Element)
  assert.ok(element)

  const html = renderToStaticMarkup(
    React.createElement(FlashRenderer, {
      element,
      scale: 1,
      resourceMap: { [element.sourceId]: 'blob:flash' }
    })
  )
  // 官方 FlashElementContent.xaml 的圆形路径与配色
  assert.ok(html.includes('M0,32 A32,32 0 0 1 64,32A32,32 0 0 1 0,32'))
  assert.ok(html.includes('#E34A4A'))
  assert.ok(html.includes('stroke-width="2"'))
  assert.ok(html.includes('fill-opacity="0.8"'))
  // 默认显示字母 f，鼠标进入才切三角
  assert.ok(html.includes('M16.6533782'))
  assert.ok(!html.includes('M5.2006778603764'))
  // 字形平移量含字形区在 64×64 图标内的居中量（+16），漏掉会让字重整体偏左上
  assert.ok(html.includes('translate(14.167 15.667)'))
  assert.ok(!html.includes('translate(23.285 19.789)'))
  // 未打开时不渲染播放弹窗
  assert.ok(!html.includes('data-flash-stage'))

  const missing = renderToStaticMarkup(
    React.createElement(FlashRenderer, { element, scale: 1, resourceMap: {} })
  )
  assert.ok(missing.includes('Flash 资源未加载'))
})
