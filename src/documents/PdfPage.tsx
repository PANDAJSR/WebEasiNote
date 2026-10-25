import { memo, useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { InkRenderer } from '../components/annotation/InkRenderer'
import type { InkElement } from '../types/annotation'
import type { PagePlacement } from './model'
import type { RenderQueue } from './pdf-provider'

interface Props {
  pdf: PDFDocumentProxy
  placement: PagePlacement
  scale: number
  inks: InkElement[]
  laserInks: InkElement[]
  draft?: InkElement[]
  queue: RenderQueue
  pixelBudget: number
  priority: number
}

export const PdfPage = memo(function PdfPage({ pdf, placement: p, scale, inks, laserInks, draft, queue, pixelBudget, priority }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false
    let task: RenderTask | undefined
    // 缩放期间保留旧图，静止后再替换，避免画布重设造成闪烁。
    const timer = setTimeout(() => {
      cancelQueue = queue.enqueue(async () => {
        let buffer: HTMLCanvasElement | undefined
        try {
          const page = await pdf.getPage(p.index + 1)
          if (cancelled) return
          const native = page.getViewport({ scale: 1 })
          const resolution = Math.min(devicePixelRatio || 1, 2,
            Math.sqrt(pixelBudget / (p.width * p.height)), 8192 / Math.max(p.width, p.height))
          const viewport = page.getViewport({ scale: scale * resolution })
          buffer = document.createElement('canvas')
          buffer.width = Math.max(1, Math.ceil(viewport.width))
          buffer.height = Math.max(1, Math.ceil(viewport.height))
          task = page.render({ canvas: buffer, viewport })
          await task.promise
          if (cancelled || !canvas.current) return
          canvas.current.width = buffer.width
          canvas.current.height = buffer.height
          canvas.current.getContext('2d')!.drawImage(buffer, 0, 0)
          canvas.current.dataset.rendered = `${native.width}x${native.height}`
          setError('')
        } catch (error) {
          if (!cancelled) setError(`页面绘制失败：${error instanceof Error ? error.message : error}`)
        } finally {
          // 不等 GC 才释放后台大位图，取消和重绘都使用同一路径。
          if (buffer) { buffer.width = 0; buffer.height = 0 }
        }
      }, priority)
    }, 120)
    let cancelQueue = () => {}
    return () => { cancelled = true; clearTimeout(timer); cancelQueue(); task?.cancel() }
  }, [pdf, p.index, scale, pixelBudget, queue])
  useEffect(() => {
    const bitmap = canvas.current!
    return () => { bitmap.width = 0; bitmap.height = 0 }
  }, [])
  return <div data-document-page={p.index} style={{ position: 'absolute', left: p.x, top: p.y,
    width: p.width, height: p.height, background: '#ffffff', overflow: 'hidden', boxShadow: '0 2px 8px #0005' }}>
    <canvas ref={canvas} style={{ width: '100%', height: '100%', pointerEvents: 'none' }} />
    {error && <div role='alert' style={{ position: 'absolute', top: 12, left: 12, color: '#c62828' }}>{error}</div>}
    {(draft ?? inks).map(ink => <InkRenderer key={ink.id} element={ink} scale={scale} />)}
    {laserInks.map(ink => <InkRenderer key={ink.id} element={ink} scale={scale} />)}
  </div>
})
