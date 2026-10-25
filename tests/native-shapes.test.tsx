import assert from 'node:assert/strict'
import fs from 'node:fs'
import { test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Window } from 'happy-dom'
import { Resvg } from '@resvg/resvg-js'
import { parseShapeElement } from '../src/enbx/shapes'
import { bezierArrowReferences, bezierPathBounds } from '../src/enbx/bezier-path-bounds'
import { getShapeGeometry } from '../src/rendering/shapeGeometry'
import { ShapeRenderer } from '../src/components/ShapeRenderer'
import { getStaticPlan, isStaticRun } from '../src/rendering/staticPlan'
import type { ShapeElement } from '../src/enbx/shapes'
import type { SlideData } from '../src/types'

const dom = new Window()
Object.assign(globalThis, { DOMParser: dom.DOMParser, XMLSerializer: dom.XMLSerializer, React })
const xml = fs.readFileSync(new URL('./fixtures/native-shapes.xml', import.meta.url), 'utf8')
const doc = new dom.DOMParser().parseFromString(xml, 'text/xml')
const shapes = [...doc.querySelectorAll('Elements > Shape')].map(node => parseShapeElement(node as unknown as Element)!)
const find = (type: string) => shapes.find(shape => shape.geometryType === type)!
const render = (element: ShapeElement) => renderToStaticMarkup(<ShapeRenderer element={element} scale={1} />)

function raster(element: ShapeElement) {
  const svg = render(element).match(/<svg[\s\S]*?<\/svg>/)![0]
  return new Resvg(svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')).render()
}

function pixel(element: ShapeElement, x: number, y: number) {
  const image = raster(element)
  const offset = (y * image.width + x) * 4
  return [...image.pixels.subarray(offset, offset + 4)]
}

test('真实课件的 41 个形状完整解析，CustomGeometry 保留 FreeLine 类型', () => {
  assert.equal(shapes.length, 41)
  assert.ok(shapes.every(Boolean))
  assert.equal(shapes.filter(shape => shape.geometryType === 'FreeLine').length, 2)
  assert.ok(shapes.every(shape => !/F[01]/i.test(shape.path)))
})

test('开放线和括号不填充，FreeLine 按曲线实际边界恢复', () => {
  for (const shape of shapes.filter(shape => ['Line', 'FreeLine', 'Brace', 'Bracket'].includes(shape.geometryType))) {
    assert.equal(getShapeGeometry(shape).isFilled, false)
    assert.ok(!render(shape).includes('fill="#166EE1"'))
  }
  const curve = getShapeGeometry(find('FreeLine'))
  assert.ok(Math.abs(curve.pathScaleX - 1) < 1e-6)
  assert.ok(Math.abs(curve.pathScaleY - 1) < 1e-6)
  assert.ok(curve.pathTranslateX < -73 && curve.pathTranslateX > -75)
})

test('二次/三次贝塞尔极值与曲线端部箭头参考点', () => {
  assert.deepEqual(bezierPathBounds('M0 0 Q50 100 100 0'), { minX: 0, minY: 0, maxX: 100, maxY: 50 })
  assert.deepEqual(bezierPathBounds('M0 0 C0 100 100 100 100 0'), { minX: 0, minY: 0, maxX: 100, maxY: 75 })
  const references = bezierArrowReferences('M0 0 C0 100 100 100 100 0')!
  assert.ok(Math.abs(references.start.x - 0.725) < 1e-10)
  assert.ok(Math.abs(references.end.y - 14.25) < 1e-10)
})

test('笑脸眼睛与嘴为白色实心细节，背景颜色保留', () => {
  const face = find('SmilingFace')
  assert.equal(face.shapePaths?.length, 3)
  assert.deepEqual(pixel(face, 21, 33), [255, 255, 255, 255])
  assert.deepEqual(pixel(face, 42, 57), [255, 255, 255, 255])
  assert.deepEqual(pixel(face, 42, 45), [22, 110, 225, 255])
})

test('复合图形恢复官方子路径数量、绘制顺序与叠加色', () => {
  for (const [type, count] of [['Fire', 2], ['Scroll', 5], ['Banner', 5], ['Medal', 7], ['RotationArrow', 3]] as const) {
    assert.equal(find(type).shapePaths?.length, count, type)
    assert.equal((render(find(type)).match(/<path\b/g) || []).length, count, type)
  }
  assert.deepEqual(pixel(find('Fire'), 36, 85), [92, 153, 234, 255])
  // 奖章中心先叠加 50/255 黑，再叠加 25/255 白；旋转箭头后弧只叠加黑。
  assert.deepEqual(pixel(find('Medal'), 50, 40), [42, 105, 188, 255])
  assert.deepEqual(pixel(find('RotationArrow'), 100, 5), [18, 89, 181, 255])
})

test('透明背景不单独显示复合形状明暗层，笑脸仍保留前景细节', () => {
  for (const type of ['Fire', 'Scroll', 'Banner', 'Medal', 'RotationArrow']) {
    const shape = { ...find(type), backgroundColor: 'transparent', backgroundBrush: undefined }
    assert.equal((render(shape).match(/<path\b/g) || []).length, 0, type)
  }
  const face = { ...find('SmilingFace'), backgroundColor: 'transparent', backgroundBrush: undefined }
  assert.deepEqual(pixel(face, 21, 33), [255, 255, 255, 255])
  assert.deepEqual(pixel(face, 42, 45), [0, 0, 0, 0])
})

test('气泡尾部和方框引线不参与元素包围盒归一化，并允许溢出显示', () => {
  for (const type of ['Bubble', 'RectangleMark', 'Banner', 'RectangleBubble']) {
    const shape = find(type)
    const geometry = getShapeGeometry(shape)
    assert.equal(geometry.pathScaleX, 1, type)
    assert.equal(geometry.pathScaleY, 1, type)
    assert.equal(geometry.pathTranslateX, 0, type)
    assert.equal(geometry.pathTranslateY, 0, type)
    assert.ok(render(shape).includes('overflow:visible'), type)
  }
})

test('括号恢复椭圆弧，并读取 Adjust.ScaleY', () => {
  const bracket = find('Bracket')
  assert.ok(bracket.path.startsWith(`M ${bracket.width} 0 A ${bracket.width} ${bracket.width * 0.3}`))
  assert.equal((find('Brace').path.match(/ A /g) || []).length, 4)
})

test('多色复合形状不进入单色静态缓存', () => {
  const source = find('Fire')
  const page = { id: 's', width: 1280, height: 720, animations: [], elements:
    Array.from({ length: 32 }, (_, i) => ({ ...source, id: `fire-${i}`, staticCacheSafe: true })) } as unknown as SlideData
  assert.equal(getStaticPlan(page).filter(isStaticRun).length, 0)
})
