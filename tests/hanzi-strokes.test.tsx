import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { test } from 'node:test'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import { decodeHanziStroke, hasHanziStrokes, loadHanziStrokes } from '../src/rendering/hanzi-strokes'
import { HanziStrokePlayer } from '../src/rendering/hanzi-stroke-player'
import type { StrokeFrame } from '../src/rendering/hanzi-stroke-player'
import { HanziStrokeDisplay } from '../src/components/subject-cards/HanziStrokeDisplay'

function clock() {
  let now = 0
  let id = 0
  const callbacks = new Map<number, () => void>()
  return {
    now: () => now,
    request: (callback: () => void) => { callbacks.set(++id, callback); return id },
    cancel: (key: number) => { callbacks.delete(key) },
    advance(ms: number) {
      now += ms
      const pending = [...callbacks.values()]
      callbacks.clear()
      pending.forEach(callback => callback())
    },
    get pending() { return callbacks.size }
  }
}

const strokes = [0, 1, 2].map(() => decodeHanziStroke(['M0,0L10,0Z', 'M0,0 L10,0']))

test('单步忽略运行中点击，写完 1 秒恢复黑字，切换连写与销毁取消旧任务', () => {
  const time = clock()
  let frame!: StrokeFrame
  const player = new HanziStrokePlayer(strokes, value => { frame = value }, time)
  player.play('step')
  time.advance(80)
  assert.equal(frame.progress, .5)
  player.play('step')
  time.advance(80)
  assert.deepEqual(frame.completed, [0])
  player.play('step')
  time.advance(160)
  assert.deepEqual(frame.completed, [0, 1])
  player.play('step')
  time.advance(160)
  assert.deepEqual(frame.completed, [0, 1, 2])
  time.advance(999)
  assert.equal(frame.completed.length, 3)
  time.advance(1)
  assert.deepEqual(frame.completed, [])
  player.play('auto')
  time.advance(160)
  assert.equal(frame.current, 1)
  player.play('step')
  assert.equal(frame.current, 0)
  assert.deepEqual(frame.completed, [])
  player.dispose()
  assert.equal(time.pending, 0)
  time.advance(10000)
  assert.equal(frame.current, 0)
})

test('连写逐笔累计，点笔蓝色强调支持保留多笔和再次点击取消', () => {
  const time = clock()
  let frame!: StrokeFrame
  const player = new HanziStrokePlayer(strokes, value => { frame = value }, time)
  player.play('auto')
  for (let i = 0; i < 3; i++) time.advance(160)
  assert.deepEqual(frame.completed, [0, 1, 2])
  player.highlight(2)
  assert.equal(frame.manual, true)
  assert.deepEqual(frame.completed, [])
  time.advance(160)
  player.highlight(0)
  time.advance(160)
  assert.deepEqual(frame.highlights, [2, 0])
  player.highlight(2)
  assert.deepEqual(frame.highlights, [0])
  player.dispose()
})

test('官方全库资源只包含 4941 个匹配字，轮廓与轨迹有效，三按上中下映射', () => {
  let count = 0
  for (const file of readdirSync(new URL('../public/hanzi-strokes/', import.meta.url)).filter(name => name !== 'manifest.json')) {
    const entries = JSON.parse(readFileSync(new URL(`../public/hanzi-strokes/${file}`, import.meta.url), 'utf8')) as Record<string, [string, string][]>
    for (const [character, entriesForCharacter] of Object.entries(entries)) {
      assert.ok(hasHanziStrokes(character))
      assert.equal((character.codePointAt(0)! >> 8).toString(16), file.replace('.json', ''))
      for (const entry of entriesForCharacter) {
        assert.match(entry[0], /^M[-\d.,L]+Z$/)
        assert.match(entry[1], /^M[\d, L]+$/)
        assert.ok(decodeHanziStroke(entry).duration >= 160)
      }
      count++
    }
  }
  assert.equal(count, 4941)
  assert.equal(hasHanziStrokes('國'), false)
  const three = JSON.parse(readFileSync(new URL('../public/hanzi-strokes/4e.json', import.meta.url), 'utf8'))['三']
  const ys = three.map(([outline]: [string, string]) => {
    const points = [...outline.matchAll(/,(-?\d+(?:\.\d+)?)/g)].map(match => Number(match[1]))
    return points.reduce((sum, value) => sum + value, 0) / points.length
  })
  assert.ok(ys[0] < ys[1] && ys[1] < ys[2])
})

test('资源失败可重试，同分片复用，组件加载、离页及静态回退不触发过期动画', async () => {
  const dom = new Window({ url: 'http://localhost/' })
  const time = clock()
  Object.assign(globalThis, { window: dom, document: dom.document, React, IS_REACT_ACT_ENVIRONMENT: true,
    requestAnimationFrame: time.request, cancelAnimationFrame: time.cancel })
  const originalFetch = globalThis.fetch
  const pending: ((response: Response) => void)[] = []
  globalThis.fetch = async () => new Promise<Response>(resolve => pending.push(resolve))
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const shard = JSON.parse(readFileSync(new URL('../public/hanzi-strokes/6c.json', import.meta.url), 'utf8'))
  try {
    const failed = loadHanziStrokes('永')
    pending.shift()!(new Response('', { status: 500 }))
    await assert.rejects(failed)
    await act(async () => root.render(<HanziStrokeDisplay character="永" active={true}>笔画</HanziStrokeDisplay>))
    assert.equal(container.querySelector('svg[role="img"]'), null)
    const duplicate = loadHanziStrokes('永')
    assert.equal(pending.length, 1)
    await act(async () => { pending.shift()!(Response.json(shard)); await duplicate })
    assert.ok(container.querySelector('svg[aria-label="永 笔顺"]'))
    assert.equal(document.hidden, false)
    assert.equal((container.querySelector('[aria-label="永 单步"]') as HTMLButtonElement).disabled, false)
    await act(async () => container.querySelector('[aria-label="永 单步"]')!.dispatchEvent(
      new dom.MouseEvent('click', { bubbles: true }) as unknown as Event))
    assert.equal(container.querySelector('[data-stroke-index]')?.getAttribute('data-stroke-index'), '0')
    assert.ok(container.querySelector('mask path[stroke-width="40"]'))
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    await act(async () => document.dispatchEvent(new dom.Event('visibilitychange') as unknown as Event))
    assert.equal(container.querySelector('mask'), null)
    assert.equal(time.pending, 0)
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    await act(async () => (container.querySelector('[aria-label="永 连写"]') as HTMLButtonElement).click())
    assert.ok(container.querySelector('mask'))
    await act(async () => root.render(<HanziStrokeDisplay character="永" active={false}>笔画</HanziStrokeDisplay>))
    assert.equal(container.querySelector('mask'), null)
    assert.equal(time.pending, 0)
    assert.equal((container.querySelector('button') as HTMLButtonElement).disabled, true)
    await act(async () => root.render(<HanziStrokeDisplay key="missing" character="國" active={true}>笔画</HanziStrokeDisplay>))
    assert.equal(container.querySelector('svg[role="img"]'), null)
    assert.ok(container.textContent?.includes('國'))
    assert.equal((container.querySelector('button') as HTMLButtonElement).disabled, true)
  } finally {
    await act(async () => root.unmount())
    container.remove()
    globalThis.fetch = originalFetch
    dom.happyDOM.abort()
  }
})
