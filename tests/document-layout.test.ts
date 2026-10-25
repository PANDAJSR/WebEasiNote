import assert from 'node:assert/strict'
import { test } from 'node:test'
import { inertiaStep, layoutPages, parseDocumentInk, visiblePages } from '../src/documents/model'

const sizes = [{ width: 600, height: 800 }, { width: 400, height: 600 }, { width: 600, height: 900 }]

test('双列混合纸张按行最高页面计算布局，分页保留真实页码', () => {
  const layout = layoutPages(sizes, 2, 1.5, 1000, true, 0)
  assert.equal(layout.pages[0].y, layout.pages[1].y)
  assert.equal(layout.pages[2].y, 24 + 1200 + 24)
  assert.equal(layout.pages[1].x - layout.pages[0].x, 900 + 24)
  const paged = layoutPages(sizes, 2, 1, 1600, false, 2)
  assert.deepEqual(paged.pages.map(p => p.index), [2])
  assert.equal(paged.pages[0].y, 24)
})

test('惯性按真实时间积分，在不同刷新率下得到相同位移', () => {
  const run = (dt: number) => {
    let v = 2, distance = 0
    for (let t = 0; t < 1000; t += dt) {
      const step = inertiaStep(v, Math.min(dt, 1000 - t))
      v = step.velocity; distance += step.distance
    }
    return distance
  }
  assert.ok(Math.abs(run(16) - run(8)) < 0.0001)
  assert.equal(inertiaStep(0, 16).distance, 0)
})

test('二分虚拟化保留相交的完整行，不扫描或绘制全文', () => {
  const pages = Array.from({ length: 500 }, (_, index) => ({ width: 600, height: index % 2 ? 400 : 800 }))
  const layout = layoutPages(pages, 2, 1, 1400, true, 0)
  const visible = visiblePages(layout, 8300, 9200)
  assert.ok(visible.length < 10)
  assert.ok(visible.every(page => page.y <= 9200 && page.y + page.height >= 8300))
  assert.deepEqual(visiblePages(layout, -800, 0), [])
  const insideFirstRow = visiblePages(layout, 700, 720)
  assert.deepEqual(insideFirstRow.map(page => page.index), [0])
})

test('损坏批注不会被当作空白文件覆盖', () => {
  assert.deepEqual(parseDocumentInk({ version: 1, pages: {} }), {})
  assert.throws(() => parseDocumentInk({ version: 2, pages: {} }))
  assert.throws(() => parseDocumentInk({ version: 1, pages: { 0: [{ type: 'image' }] } }))
})
