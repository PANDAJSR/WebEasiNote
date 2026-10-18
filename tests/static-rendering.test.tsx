import assert from 'node:assert/strict'
import { test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Window } from 'happy-dom'
import { createCanvas, loadImage, Path2D } from '@napi-rs/canvas'
import { Resvg } from '@resvg/resvg-js'
import { getStaticPlan, isStaticRun } from '../src/rendering/staticPlan'
import { getShapeGeometry } from '../src/rendering/shapeGeometry'
import { fingerprintRun, rasterRatio } from '../src/rendering/rasterCache'
import { ShapeRenderer } from '../src/components/ShapeRenderer'
import { parseSlideElements } from '../src/slide-elements-parser'
import type { SlideData, SlideElement } from '../src/types'

const dom = new Window()
Object.assign(globalThis, { DOMParser: dom.DOMParser, XMLSerializer: dom.XMLSerializer, React })
const shape = (id: string, props = {}): SlideElement => ({
  type: 'shape', id, x: 5, y: 8, width: 80, height: 50, path: 'M0 0 L100 0 L70 100 L0 60Z',
  geometryType: 'custom', backgroundColor: '#f5eeeb', foregroundColor: 'transparent',
  staticCacheSafe: true, ...props
})
const slide = (elements: SlideElement[], props = {}): SlideData => ({
  id: 's', width: 160, height: 120, backgroundColor: '#fff',
  animationOrders: [], animations: [], issues: [], elements, ...props
})
const shapes = (prefix: string, props = {}) => Array.from({ length: 32 }, (_, i) => shape(`${prefix}${i}`, props))

test('静态段不跨越文字、动画目标、触发源和祖先引用', () => {
  const dynamic = shape('animated', { groupAncestorIds: ['group'] })
  const page = slide([...shapes('a'), dynamic, ...shapes('b'), shape('trigger'), ...shapes('c')], {
    animations: [{ targetId: 'group', sourceElementId: '', triggerSource: 'trigger' }]
  })
  const plan = getStaticPlan(page)
  assert.deepEqual(plan.map(item => isStaticRun(item) ? item.elements.length : item.id), [32, 'animated', 32, 'trigger', 32])
  assert.equal(getStaticPlan(page), plan)
  assert.equal(getStaticPlan({ ...page, elements: [...page.elements] }), plan)
  assert.notEqual(getStaticPlan({ ...page, elements: [shape('replacement'), ...page.elements.slice(1)] }), plan)
  assert.equal(getStaticPlan(slide(shapes('x', { shadow: {} }))).filter(isStaticRun).length, 0)
  assert.equal(getStaticPlan(slide(shapes('x', { opacity: 0.5 }))).filter(isStaticRun).length, 0)
  assert.equal(getStaticPlan(slide(shapes('x', { staticCacheSafe: false }))).filter(isStaticRun).length, 0)
})

test('内容指纹不含 ID，但区分颜色、路径精度、顺序及翻转', async () => {
  const run = (props = {}) => {
    const item = getStaticPlan(slide(shapes(Math.random().toString(), props)))[0]
    assert.ok(isStaticRun(item))
    return item
  }
  const key = await fingerprintRun(run())
  assert.equal(await fingerprintRun(run()), key)
  for (const props of [{ backgroundColor: '#e1ccc1' }, { path: 'M0 0 L100 0 L70.00001 100 L0 60Z' }, { flipVertical: true }]) {
    assert.notEqual(await fingerprintRun(run(props)), key)
  }
  assert.equal(getShapeGeometry(shape('a') as any).renderWidth, 80)
  assert.ok(rasterRatio(5, 3, 10000, 10000) <= 0.4)
})

test('未知属性、遮罩和组行为向后代传播缓存禁用', () => {
  const xml = '<Elements><Group><Id>g</Id><HasMask>true</HasMask><Elements><Shape><Id>s</Id><Width>20</Width><Height>20</Height><Path>M0 0 L1 0 L1 1Z</Path></Shape></Elements></Group><Shape><Id>x</Id><UnknownEffect/></Shape></Elements>'
  const node = new dom.DOMParser().parseFromString(xml, 'text/xml').documentElement
  const parsed = parseSlideElements(node as unknown as Element, { slideId: 'test' })
  assert.equal(parsed.elements[0].staticCacheSafe, false)
  assert.equal(parsed.elements[1].staticCacheSafe, false)
  assert.deepEqual(parsed.elements[0].groupAncestorIds, ['g'])
  assert.ok(parsed.elements[0].rawXml?.startsWith('<Shape>'))
})

test('Worker 绘制与 SVG 使用相同路径、裁剪、旋转、翻转及填充规则', async () => {
  let result: any
  class Canvas {
    canvas: ReturnType<typeof createCanvas>
    constructor(width: number, height: number) { this.canvas = createCanvas(width, height) }
    getContext() { return this.canvas.getContext('2d') }
    transferToImageBitmap() { return this.canvas }
  }
  Object.assign(globalThis, { OffscreenCanvas: Canvas, Path2D, postMessage: (value: any) => { result = value } })
  await import('../src/rendering/raster.worker')
  for (const variant of [
    {}, { rotation: 25, flipHorizontal: true },
    { flipVertical: true, path: 'M0 0 H100 V100 H0Z M25 25 H75 V75 H25Z', fillRule: 'evenodd' },
    { shapePaths: [{ path: 'M0 0 L100 0 L100 100Z', isFilled: true, isStroke: false, width: 100, height: 100 }] }
  ]) {
    const element = shape('s', variant)
    const item = getStaticPlan(slide(shapes('a', variant)))[0]
    assert.ok(isStaticRun(item))
    const onMessage = (globalThis as any).onmessage
    onMessage({ data: { id: 1, width: 160, height: 120, ratio: 2, drawings: [item.drawings[0]] } })
    assert.ok(!result.error, result.error)
    const markup = renderToStaticMarkup(<ShapeRenderer element={element as any} scale={1} />)
    const svg = markup.match(/<svg[\s\S]*?<\/svg>/)![0]
    const drawing = item.drawings[0]
    const transform = `translate(${drawing.x + drawing.width / 2} ${drawing.y + drawing.height / 2}) rotate(${drawing.rotation}) scale(${drawing.flipX ? -1 : 1} ${drawing.flipY ? -1 : 1}) translate(${-drawing.width / 2} ${-drawing.height / 2})`
    const reference = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 160 120"><g transform="${transform}">${svg.replace(/style="[^"]*"/, 'overflow="hidden"')}</g></svg>`
    const referenceCanvas = createCanvas(320, 240)
    const referenceContext = referenceCanvas.getContext('2d')
    referenceContext.drawImage(await loadImage(new Resvg(reference).render().asPng()), 0, 0)
    const expected = referenceContext.getImageData(0, 0, 320, 240).data
    const actual = result.bitmap.getContext('2d').getImageData(0, 0, 320, 240).data
    let difference = 0
    for (let i = 0; i < expected.length; i++) difference += Math.abs(expected[i] - actual[i])
    assert.ok(difference / expected.length < 1, `平均通道差 ${difference / expected.length}`)
  }
})
