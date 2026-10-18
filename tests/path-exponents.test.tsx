import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Window } from 'happy-dom'
import { Resvg } from '@resvg/resvg-js'
import { createCanvas, loadImage, Path2D } from '@napi-rs/canvas'
import { estimatePathBounds, inferFillRule } from '../src/path-utils'
import { parseShapeElement } from '../src/shapes'
import { getShapeGeometry } from '../src/rendering/shapeGeometry'
import { getStaticPlan, isStaticRun } from '../src/rendering/staticPlan'
import { ShapeRenderer } from '../src/components/ShapeRenderer'
import type { SlideData } from '../src/types'

Object.assign(globalThis, { React })

test('SVG 数值兼容 E/e 指数、符号、小数及命令相连，保持相同边界和填充规则', () => {
  const expected = { minX: 0, minY: 0, maxX: 20, maxY: 50 }
  for (const path of ['M0 0H2E+1V5E1H0Z', 'M0 0H2e+1V5e1H0Z',
    'M0 0L.2E2,-0E-8 20,5.E+1 0,+50Z']) {
    assert.deepEqual(estimatePathBounds(path), expected)
  }
  assert.equal(inferFillRule('M0 0H2E1V5E1H0Z M1E0 1E0H1E1V2E1H1E0Z'), 'evenodd')
})

test('原课件第 1 页矩形和竖条的 SVG 与 Worker 都完整着色', async () => {
  const dom = new Window()
  const xml = await readFile(new URL('./fixtures/page-1-header-shapes.xml', import.meta.url), 'utf8')
  const node = new dom.DOMParser().parseFromString(xml, 'text/xml').documentElement
  const elements = Array.from(node.children).map(shapeNode => {
    const shape = parseShapeElement(shapeNode as unknown as Element)
    assert.ok(shape)
    return shape
  })
  assert.equal(elements.length, 2)
  let result: { bitmap: ReturnType<typeof createCanvas>; error?: string }
  class Canvas {
    canvas: ReturnType<typeof createCanvas>
    constructor(width: number, height: number) { this.canvas = createCanvas(width, height) }
    getContext() { return this.canvas.getContext('2d') }
    transferToImageBitmap() { return this.canvas }
  }
  Object.assign(globalThis, { OffscreenCanvas: Canvas, Path2D,
    postMessage: (value: typeof result) => { result = value } })
  await import('../src/rendering/raster.worker')
  for (const element of elements) {
    const bounds = estimatePathBounds(element.path)!
    assert.ok(Math.abs(bounds.minX) < 1e-6 && Math.abs(bounds.minY) < 1e-6)
    assert.ok(Math.abs(bounds.maxX - element.width) < 1e-5)
    assert.ok(Math.abs(bounds.maxY - element.height) < 1e-5)
    const geometry = getShapeGeometry(element)
    assert.ok(Math.abs(geometry.pathScaleX - 1) < 1e-6)
    assert.ok(Math.abs(geometry.pathScaleY - 1) < 1e-6)
    const markup = renderToStaticMarkup(<ShapeRenderer element={element} scale={1} />)
    const svg = markup.match(/<svg[\s\S]*?<\/svg>/)![0]
      .replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
    const canvas = createCanvas(140, 100)
    const context = canvas.getContext('2d')
    context.drawImage(await loadImage(new Resvg(svg).render().asPng()), 0, 0)
    const pixel = (x: number, y: number) => Array.from(context.getImageData(x, y, 1, 1).data)
    for (const [x, y] of [[1, 1], [Math.floor(element.width / 2), 25],
      [Math.floor(element.width) - 1, 48]]) {
      assert.deepEqual(pixel(x, y), [13, 153, 161, 255])
    }
    // 复制为足够长的安全段，确保同一几何在栅格缓存中也正确。
    const slide: SlideData = { id: 's', width: 140, height: 100, backgroundColor: '#fff',
      animationOrders: [], animations: [], issues: [],
      elements: Array.from({ length: 32 }, (_, index) => ({ ...element,
        id: `shape-${index}`, x: 0, y: 0, staticCacheSafe: true })) }
    const run = getStaticPlan(slide)[0]
    assert.ok(isStaticRun(run))
    const onMessage = (globalThis as any).onmessage
    onMessage({ data: { id: 1, width: 140, height: 100,
      ratio: 1, drawings: [run.drawings[0]] } })
    assert.ok(!result!.error, result!.error)
    assert.deepEqual(Array.from(result!.bitmap.getContext('2d').getImageData(
      Math.floor(element.width / 2), 25, 1, 1).data), [13, 153, 161, 255])
  }
})
