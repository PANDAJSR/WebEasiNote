import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { InkBrush, InkElement, InkPoint } from '../types/annotation'
import { CeBrushSampler } from '../viewer/annotation/ce-brush'
import { createInk } from '../viewer/annotation/ink-geometry'
import { eraseInk } from '../viewer/annotation/ink-eraser'
import { inertiaStep, type DocumentLayout, type PagePlacement } from './model'
import type { useDocumentAnnotation } from './useDocumentAnnotation'

interface Contact { x: number; y: number; type: string }
interface Stroke {
  id: number; page: PagePlacement; started: number; last: InkPoint; scale: number
  sampler: CeBrushSampler; brush: InkBrush; erase: boolean; before: InkElement[]; after: InkElement[]
}
interface Options {
  viewport: RefObject<HTMLDivElement>
  layout: DocumentLayout
  scale: number
  fingerInk: boolean
  inertia: boolean
  annotation: ReturnType<typeof useDocumentAnnotation>
  zoomAt: (factor: number, x: number, y: number) => void
  selectPage: (index: number) => void
}

/** 文档视口拥有全部指针，首指笔迹和擦除都在确认前保持可回滚。 */
export function useDocumentGestures(options: Options) {
  const latest = useRef(options)
  latest.current = options
  const stop = useRef(() => {})
  const cancel = useRef(() => {})
  const [draft, setDraft] = useState<{ page: number; inks: InkElement[] } | null>(null)
  useEffect(() => {
    const viewport = options.viewport.current!
    const contacts = new Map<number, Contact>()
    let stroke: Stroke | null = null
    let pan = false
    let blocked = false
    let pinching = false
    let pinchDistance = 0
    let frame = 0, preview = 0, panFrame = 0
    let previousCenter: { x: number; y: number; distance: number } | null = null
    let latestMoveTime = 0
    let vx = 0, vy = 0, movedAt = 0
    const halt = () => { cancelAnimationFrame(frame); frame = 0; vx = vy = 0 }
    stop.current = halt
    const reset = () => {
      halt()
      stroke = null
      pan = blocked = pinching = false
      const ids = [...contacts.keys()]
      contacts.clear()
      for (const id of ids) if (viewport.hasPointerCapture(id)) viewport.releasePointerCapture(id)
      cancelAnimationFrame(preview)
      cancelAnimationFrame(panFrame)
      panFrame = 0
      previousCenter = null
      preview = 0
      setDraft(null)
    }
    cancel.current = reset
    const center = () => {
      const points = [...contacts.values()].filter(p => p.type === 'touch').slice(0, 2)
      if (!points.length) return null
      return { x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
        y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
        distance: points.length === 2 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : 0 }
    }
    const point = (event: PointerEvent, active: Stroke): InkPoint => {
      const rect = viewport.getBoundingClientRect()
      return { x: Math.max(0, Math.min(active.page.width / active.scale,
        (event.clientX - rect.left + viewport.scrollLeft - active.page.x) / active.scale)),
      y: Math.max(0, Math.min(active.page.height / active.scale,
        (event.clientY - rect.top + viewport.scrollTop - active.page.y) / active.scale)),
      pressure: event.pointerType === 'pen' && event.pressure > 0 ? event.pressure : 0.5, time: event.timeStamp }
    }
    const refresh = () => {
      if (preview) return
      preview = requestAnimationFrame(() => {
        preview = 0
        if (!stroke) { setDraft(null); return }
        setDraft({ page: stroke.page.index, inks: stroke.erase ? stroke.after
          : [...stroke.before, createInk(stroke.sampler.points, stroke.brush, 'document-draft')] })
      })
    }
    const collect = (event: PointerEvent) => {
      if (!stroke || stroke.id !== event.pointerId) return
      const samples = event.getCoalescedEvents?.() ?? []
      for (const sample of samples.length ? samples : [event]) {
        const next = point(sample, stroke)
        if (stroke.erase) {
          const state = latest.current.annotation.state
          stroke.after = stroke.after.flatMap(ink => eraseInk(ink, stroke!.last, next,
            state.eraser.width / stroke!.scale, state.eraser.shape, state.tool === 'stroke-eraser'))
        } else stroke.sampler.append(next)
        stroke.last = next
      }
      refresh()
    }
    const down = (event: PointerEvent) => {
      if (event.button !== 0) return
      event.preventDefault()
      halt()
      if (latest.current.annotation.inputBlocked.current) return
      if (contacts.size && (event.pointerType === 'pen' || [...contacts.values()].some(p => p.type === 'pen'))) return
      if (contacts.size && (event.pointerType !== 'touch' || [...contacts.values()].some(p => p.type !== 'touch'))) return
      contacts.set(event.pointerId, { x: event.clientX, y: event.clientY, type: event.pointerType })
      viewport.setPointerCapture(event.pointerId)
      if (contacts.size > 1) {
        if (contacts.size > 2 || blocked) return
        if (stroke && event.timeStamp - stroke.started > 100) { blocked = true; return }
        stroke = null
        setDraft(null)
        pan = true
        pinching = false
        pinchDistance = center()?.distance ?? 0
        previousCenter = center()
        movedAt = event.timeStamp
        return
      }
      const { annotation, fingerInk, layout, scale } = latest.current
      const state = annotation.state
      const inkTool = ['pen', 'eraser', 'stroke-eraser'].includes(state.tool)
      pan = !inkTool || event.pointerType === 'touch' && !fingerInk
      previousCenter = center() ?? { x: event.clientX, y: event.clientY, distance: 0 }
      movedAt = event.timeStamp
      if (pan || !annotation.ready || state.frozen) return
      const rect = viewport.getBoundingClientRect()
      const x = event.clientX - rect.left + viewport.scrollLeft, y = event.clientY - rect.top + viewport.scrollTop
      const page = layout.pages.find(p => x >= p.x && x <= p.x + p.width && y >= p.y && y <= p.y + p.height)
      if (!page) return
      latest.current.selectPage(page.index)
      const brush = { ...state.brush, width: state.brush.width / scale,
        height: (state.brush.height ?? state.brush.width) / scale, inputScale: scale }
      const before = annotation.pages[page.index] ?? []
      const initial = { x: (x - page.x) / scale, y: (y - page.y) / scale,
        pressure: event.pointerType === 'pen' && event.pressure > 0 ? event.pressure : 0.5, time: event.timeStamp }
      stroke = { id: event.pointerId, page, scale, started: event.timeStamp, brush,
        sampler: new CeBrushSampler(brush, initial, event.pointerType), last: initial,
        erase: state.tool !== 'pen', before, after: before }
      collect(event)
    }
    const applyPan = () => {
      panFrame = 0
      const first = contacts.values().next().value
      const after = center() ?? (first ? { ...first, distance: 0 } : null)
      const before = previousCenter
      previousCenter = after
      if (!pan || blocked || !before || !after) return
      const dx = after.x - before.x, dy = after.y - before.y
      viewport.scrollLeft -= dx
      viewport.scrollTop -= dy
      const dt = Math.max(1, latestMoveTime - movedAt)
      const weight = Math.min(1, dt / 30)
      vx = vx * (1 - weight) - dx / dt * weight
      vy = vy * (1 - weight) - dy / dt * weight
      movedAt = latestMoveTime
      if (before.distance > 10 && after.distance > 10) {
        const factor = after.distance / (pinching ? before.distance : pinchDistance || before.distance)
        if (pinching || Math.abs(factor - 1) > 0.04) {
          latest.current.zoomAt(factor, after.x, after.y)
          pinching = true
        }
      }
    }
    const move = (event: PointerEvent) => {
      const contact = contacts.get(event.pointerId)
      if (!contact) return
      event.preventDefault()
      contact.x = event.clientX
      contact.y = event.clientY
      if (stroke) { collect(event); return }
      latestMoveTime = event.timeStamp
      // 同一硬件采样的两个 pointermove 先合并，再计算质心与间距，避免平移误判为捏合。
      if (pan && !blocked && !panFrame) panFrame = requestAnimationFrame(applyPan)
    }
    const startInertia = () => {
      if (!latest.current.inertia || matchMedia('(prefers-reduced-motion: reduce)').matches) return
      vx = Math.max(-3, Math.min(3, vx)); vy = Math.max(-3, Math.min(3, vy))
      let last = performance.now()
      const tick = (time: number) => {
        const x = inertiaStep(vx, time - last), y = inertiaStep(vy, time - last)
        last = time
        const oldX = viewport.scrollLeft, oldY = viewport.scrollTop
        viewport.scrollLeft += x.distance
        viewport.scrollTop += y.distance
        vx = Math.abs(viewport.scrollLeft - oldX) < 0.1 ? 0 : x.velocity
        vy = Math.abs(viewport.scrollTop - oldY) < 0.1 ? 0 : y.velocity
        if (Math.hypot(vx, vy) > 0.015) frame = requestAnimationFrame(tick)
        else halt()
      }
      frame = requestAnimationFrame(tick)
    }
    const up = (event: PointerEvent) => {
      if (!contacts.has(event.pointerId)) return
      if (panFrame) { cancelAnimationFrame(panFrame); applyPan() }
      if (stroke?.id === event.pointerId) {
        collect(event)
        const active = stroke
        stroke = null
        const ink = active.erase ? active.after : [...active.before, createInk(active.sampler.finish(), active.brush)]
        latest.current.annotation.commit(active.page.index, ink)
        setDraft(null)
      }
      contacts.delete(event.pointerId)
      if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId)
      if (contacts.size) {
        // 两指经常分两次上报抬起；保留短间隔的释放速度，但移除质心基线。
        previousCenter = center()
        if (pinching) { vx = vy = 0; pinching = false }
        return
      }
      if (pan && !blocked && event.timeStamp - movedAt < 100 && !pinching) startInertia()
      pan = blocked = pinching = false
    }
    const lost = (event: PointerEvent) => { if (contacts.has(event.pointerId)) reset() }
    const wheel = (event: WheelEvent) => {
      halt()
      if (stroke) { event.preventDefault(); return }
      if (event.ctrlKey) { event.preventDefault(); latest.current.zoomAt(Math.exp(-event.deltaY * 0.002), event.clientX, event.clientY) }
    }
    const hidden = () => { if (document.hidden) reset() }
    viewport.addEventListener('pointerdown', down)
    viewport.addEventListener('pointermove', move)
    viewport.addEventListener('pointerup', up)
    viewport.addEventListener('pointercancel', reset)
    viewport.addEventListener('lostpointercapture', lost)
    viewport.addEventListener('wheel', wheel, { passive: false })
    window.addEventListener('blur', reset)
    document.addEventListener('visibilitychange', hidden)
    return () => {
      reset()
      viewport.removeEventListener('pointerdown', down)
      viewport.removeEventListener('pointermove', move)
      viewport.removeEventListener('pointerup', up)
      viewport.removeEventListener('pointercancel', reset)
      viewport.removeEventListener('lostpointercapture', lost)
      viewport.removeEventListener('wheel', wheel)
      window.removeEventListener('blur', reset)
      document.removeEventListener('visibilitychange', hidden)
    }
  }, [options.viewport])
  useEffect(() => { cancel.current() }, [options.annotation.epoch, options.fingerInk])
  return { draft, stop: () => stop.current(), cancel: () => cancel.current() }
}
