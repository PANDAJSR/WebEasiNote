import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = workerUrl

export function openPdf(url: string) {
  const base = `${import.meta.env.BASE_URL}pdfjs/`
  return getDocument({ url, cMapUrl: `${base}cmaps/`, cMapPacked: true,
    standardFontDataUrl: `${base}standard_fonts/`, wasmUrl: `${base}wasm/`,
    disableAutoFetch: true, disableStream: true })
}

/** 可见页优先，最多两个重绘任务同时占用主线程。取消的队列任务不再启动。 */
export class RenderQueue {
  private active = 0
  private pending: { run: () => Promise<void>; cancelled: boolean; priority: number }[] = []
  enqueue(run: () => Promise<void>, priority = 0) {
    const item = { run, cancelled: false, priority }
    this.pending.push(item)
    this.pending.sort((a, b) => a.priority - b.priority)
    this.pump()
    return () => { item.cancelled = true }
  }
  private pump() {
    while (this.active < 2 && this.pending.length) {
      const item = this.pending.shift()!
      if (item.cancelled) continue
      this.active++
      void item.run().catch(error => console.error('[DocumentRender]', error)).finally(() => { this.active--; this.pump() })
    }
  }
}
