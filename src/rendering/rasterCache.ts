import type { StaticRun } from './staticPlan'

interface CacheEntry {
  bitmap: Promise<ImageBitmap>
  value?: ImageBitmap
  bytes: number
  users: number
  retired?: boolean
}

const budget = 64 * 1024 * 1024
const entries = new Map<string, CacheEntry>()
const fingerprints = new WeakMap<StaticRun, Promise<string>>()
const fingerprintValues = new WeakMap<StaticRun, string>()
const jobs = new Map<number, {
  resolve: (bitmap: ImageBitmap) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}>()
let worker: Worker | null = null
let nextId = 0
let generation = 0

export function rasterRatio(scale: number, dpr: number, width: number, height: number): number {
  const desired = Math.ceil(Math.max(0.5, scale * dpr) * 2) / 2
  // 每幅最多 1600 万像素，避免超大课件/高 DPR 导致显存失控。
  return Math.min(desired, 3, Math.sqrt(16_000_000 / Math.max(1, width * height)))
}

export async function fingerprintRun(run: StaticRun): Promise<string> {
  let fingerprint = fingerprints.get(run)
  if (!fingerprint) {
    fingerprint = crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(run.drawings)))
      .then(hash => {
        const key = Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, '0')).join('')
        fingerprintValues.set(run, key)
        return key
      })
    fingerprints.set(run, fingerprint)
  }
  return fingerprint
}

function cachedEntry(run: StaticRun, width: number, height: number, ratio: number) {
  const hash = fingerprintValues.get(run)
  return hash ? entries.get(`${hash}:${width}:${height}:${ratio}`) : undefined
}

export function hasCachedRaster(run: StaticRun, width: number, height: number, ratio: number) {
  return !!cachedEntry(run, width, height, ratio)?.value
}

/** 热缓存同步复制，在提交阶段避免先挂载整段 SVG。 */
export function copyCachedRaster(run: StaticRun, width: number, height: number, ratio: number, canvas: HTMLCanvasElement) {
  const entry = cachedEntry(run, width, height, ratio)
  if (!entry?.value) return false
  const context = canvas.getContext('2d')
  if (!context) return false
  canvas.width = entry.value.width
  canvas.height = entry.value.height
  context.drawImage(entry.value, 0, 0)
  const key = `${fingerprintValues.get(run)}:${width}:${height}:${ratio}`
  entries.delete(key)
  entries.set(key, entry)
  return true
}

function trimCache() {
  let bytes = Array.from(entries.values()).reduce((sum, entry) => sum + entry.bytes, 0)
  for (const [key, entry] of entries) {
    if (bytes <= budget) break
    if (entry.users || !entry.value) continue
    entries.delete(key)
    entry.value.close()
    bytes -= entry.bytes
  }
}

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('./raster.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<{ id: number; bitmap?: ImageBitmap; error?: string }>) => {
      const job = jobs.get(event.data.id)
      if (!job) {
        event.data.bitmap?.close()
        return
      }
      clearTimeout(job.timer)
      jobs.delete(event.data.id)
      if (event.data.bitmap) job.resolve(event.data.bitmap)
      else job.reject(new Error(event.data.error || '栅格缓存生成失败'))
    }
    worker.onerror = () => clearRasterCache()
  }
  return worker
}

function render(run: StaticRun, width: number, height: number, ratio: number) {
  return new Promise<ImageBitmap>((resolve, reject) => {
    const id = ++nextId
    const rasterWorker = getWorker()
    const timer = setTimeout(() => clearRasterCache(), 15000)
    jobs.set(id, { resolve, reject, timer })
    try {
      rasterWorker.postMessage({ id, width, height, ratio, drawings: run.drawings })
    } catch (error) {
      clearTimeout(timer)
      jobs.delete(id)
      reject(error)
    }
  })
}

export async function acquireRaster(run: StaticRun, width: number, height: number, ratio: number) {
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    throw new Error('浏览器不支持离屏缓存')
  }
  const version = generation
  const key = `${await fingerprintRun(run)}:${width}:${height}:${ratio}`
  if (version !== generation) throw new Error('课件已切换')
  let entry = entries.get(key)
  if (!entry) {
    if (jobs.size >= 8) throw new Error('栅格任务队列已满，保留矢量绘制')
    entry = { bitmap: render(run, width, height, ratio), bytes: 0, users: 0 }
    entries.set(key, entry)
    const created = entry
    entry.bitmap.then(bitmap => {
      created.value = bitmap
      created.bytes = bitmap.width * bitmap.height * 4
      if (created.retired && !created.users) bitmap.close()
      else trimCache()
    }, () => {
      if (entries.get(key) === created) entries.delete(key)
    })
  }
  entries.delete(key)
  entries.set(key, entry)
  entry.users++
  const held = entry
  const release = () => {
    held.users--
    if (held.retired && !held.users) held.value?.close()
    trimCache()
  }
  try {
    const bitmap = await held.bitmap
    return { bitmap, release }
  } catch (error) {
    release()
    throw error
  }
}

/** 文件重载、关闭或卸载时终止任务，迟到结果不再进入缓存。 */
export function clearRasterCache() {
  generation++
  worker?.terminate()
  worker = null
  for (const job of jobs.values()) {
    clearTimeout(job.timer)
    job.reject(new Error('栅格任务已取消'))
  }
  jobs.clear()
  for (const entry of entries.values()) {
    entry.retired = true
    if (!entry.users) entry.value?.close()
  }
  entries.clear()
}
