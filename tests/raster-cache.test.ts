import assert from 'node:assert/strict'
import { test } from 'node:test'
import { acquireRaster, clearRasterCache } from '../src/rendering/rasterCache'
import type { StaticRun } from '../src/rendering/staticPlan'

const sent: { worker: FakeWorker; id: number }[] = []
class FakeWorker {
  onmessage: ((event: any) => void) | null = null
  onerror: (() => void) | null = null
  terminated = false
  postMessage(message: any) { sent.push({ worker: this, id: message.id }) }
  terminate() { this.terminated = true }
}
class Bitmap {
  closed = 0
  constructor(public width = 100, public height = 100) {}
  close() { this.closed++ }
}
Object.assign(globalThis, { Worker: FakeWorker, OffscreenCanvas: class {} })
const run = { kind: 'static', id: 'r', drawings: [], elements: [] } as StaticRun
async function tick() {
  // SHA-256 在线程池中执行；等待实际请求，避免并行测试负载下固定 10ms 超时。
  for (let attempt = 0; sent.length === 0 && attempt < 500; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  assert.ok(sent.length > 0, '栅格任务未提交到 Worker')
}
function reply(bitmap = new Bitmap()) {
  const request = sent.shift()!
  request.worker.onmessage?.({ data: { id: request.id, bitmap } })
  return bitmap
}

test('相同内容并发去重、重用，清理后释放引用及拒绝迟到任务', async () => {
  const first = acquireRaster(run, 100, 100, 1)
  const second = acquireRaster({ ...run, id: 'different' }, 100, 100, 1)
  await tick()
  assert.equal(sent.length, 1)
  const bitmap = reply()
  const [a, b] = await Promise.all([first, second])
  assert.equal(a.bitmap, b.bitmap)
  a.release()
  const warm = await acquireRaster(run, 100, 100, 1)
  assert.equal(sent.length, 0)
  warm.release()
  clearRasterCache()
  assert.equal(bitmap.closed, 0)
  b.release()
  assert.equal(bitmap.closed, 1)

  const pending = acquireRaster(run, 100, 100, 2)
  const rejection = assert.rejects(pending, /取消/)
  await tick()
  const stale = sent.shift()!
  clearRasterCache()
  await rejection
  assert.equal(stale.worker.terminated, true)
  const late = new Bitmap()
  stale.worker.onmessage?.({ data: { id: stale.id, bitmap: late } })
  assert.equal(late.closed, 1)
})

test('LRU 字节预算回收闲置 ImageBitmap，失败可重试', async () => {
  clearRasterCache()
  const pendingA = acquireRaster(run, 4096, 4096, 1)
  await tick()
  const large = reply(new Bitmap(4096, 4096))
  const a = await pendingA
  a.release()
  const pendingB = acquireRaster(run, 4097, 4096, 1)
  await tick()
  reply(new Bitmap(4096, 4096))
  const b = await pendingB
  b.release()
  assert.equal(large.closed, 1)
  clearRasterCache()

  const failure = acquireRaster(run, 200, 200, 1)
  const rejection = assert.rejects(failure, /测试失败/)
  await tick()
  const request = sent.shift()!
  request.worker.onmessage?.({ data: { id: request.id, error: '测试失败' } })
  await rejection
  const retry = acquireRaster(run, 200, 200, 1)
  await tick()
  reply()
  const retried = await retry
  retried.release()
  clearRasterCache()
})
