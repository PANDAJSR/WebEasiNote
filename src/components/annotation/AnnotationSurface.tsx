import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { InkBrush, InkElement, InkPoint, SlideData, SlideElement } from '../../types'
import type { PlaybackAnnotation } from '../../viewer/usePlaybackSelection'
import { pointerToSlide } from '../../viewer/pointer-coordinates'
import { createInk } from '../../viewer/annotation/ink-geometry'
import { eraseInk } from '../../viewer/annotation/ink-eraser'
import { InkRenderer } from './InkRenderer'
import { annotationStyles as styles } from './styles'

interface PenGesture { kind: 'pen'; points: InkPoint[]; brush: InkBrush }
interface EraseGesture {
  kind: 'erase'
  last: InkPoint
  replacements: Map<string, SlideElement[]>
}
interface Props {
  slide: SlideData
  scale: number
  annotation: PlaybackAnnotation
  onPreview: (elements: SlideElement[] | null) => void
}

/** 采样留在 Web 内；预览按帧刷新，收笔/收擦时提交单条事务。 */
export function AnnotationSurface({ slide, scale, annotation, onPreview }: Props) {
  const surface = useRef<HTMLDivElement>(null)
  const gestures = useRef(new Map<number, PenGesture | EraseGesture>())
  const frame = useRef<number | null>(null)
  const [drafts, setDrafts] = useState<InkElement[]>([])
  const [cursor, setCursor] = useState<InkPoint | null>(null)
  const { state } = annotation
  const erasing = state.tool === 'eraser' || state.tool === 'stroke-eraser'
  const latest = useRef({ onPreview, annotation })
  latest.current = { onPreview, annotation }
  const refresh = () => {
    setDrafts([...gestures.current.entries()].flatMap(([id, gesture]) =>
      gesture.kind === 'pen' ? [createInk(gesture.points, gesture.brush, `draft-${id}`)] : []))
    const erase = [...gestures.current.values()].find((gesture): gesture is EraseGesture => gesture.kind === 'erase')
    onPreview(erase ? slide.elements.flatMap(element => erase.replacements.get(element.id) ?? [element]) : null)
  }
  const schedule = () => {
    if (frame.current !== null) return
    frame.current = requestAnimationFrame(() => { frame.current = null; refresh() })
  }
  const cancelAll = () => {
    const ids = [...gestures.current.keys()]
    gestures.current.clear()
    for (const id of ids) {
      if (surface.current?.hasPointerCapture(id)) surface.current.releasePointerCapture(id)
    }
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
    setDrafts([])
    setCursor(null)
    latest.current.onPreview(null)
  }
  useEffect(() => {
    const hide = () => { if (document.hidden) cancelAll() }
    window.addEventListener('blur', cancelAll)
    document.addEventListener('visibilitychange', hide)
    return () => {
      window.removeEventListener('blur', cancelAll)
      document.removeEventListener('visibilitychange', hide)
      if (frame.current !== null) cancelAnimationFrame(frame.current)
      gestures.current.clear()
      latest.current.onPreview(null)
    }
  }, [])
  const point = (event: PointerEvent): InkPoint => {
    const position = pointerToSlide(event, surface.current!.getBoundingClientRect(), scale)
    return { ...position, time: event.timeStamp,
      pressure: event.pointerType === 'pen' && event.pressure > 0 ? event.pressure : 0.5 }
  }
  const eraseAt = (gesture: EraseGesture, next: InkPoint) => {
    for (const element of slide.elements) {
      if (element.type !== 'ink' || element.isLocked) continue
      const fragments = gesture.replacements.get(element.id) || [element]
      let changed = false
      const replacement = fragments.flatMap<SlideElement>(fragment => {
        if (fragment.type !== 'ink') return [fragment]
        const result = eraseInk(fragment, gesture.last, next, state.eraser.width / scale,
          state.eraser.shape, state.tool === 'stroke-eraser')
        if (result.length !== 1 || result[0] !== fragment) changed = true
        return result
      })
      if (changed) gesture.replacements.set(element.id, replacement)
    }
    gesture.last = next
  }
  const handleStart = (event: ReactPointerEvent) => {
    if (event.button !== 0 || state.frozen) return
    event.preventDefault()
    event.stopPropagation()
    // 擦除独占场景；多指书写则各自拥有笔画。
    if (erasing && gestures.current.size) return
    surface.current?.focus({ preventScroll: true })
    const start = point(event.nativeEvent)
    if (erasing) {
      const gesture: EraseGesture = { kind: 'erase', last: start, replacements: new Map() }
      gestures.current.set(event.pointerId, gesture)
      eraseAt(gesture, start)
      setCursor(start)
    } else gestures.current.set(event.pointerId, { kind: 'pen', points: [start],
      brush: { ...state.brush, width: state.brush.width / scale } })
    surface.current?.setPointerCapture(event.pointerId)
    schedule()
  }
  const collect = (event: ReactPointerEvent) => {
    const gesture = gestures.current.get(event.pointerId)
    if (!gesture) return
    const events = event.nativeEvent.getCoalescedEvents?.() || []
    for (const sample of events.length ? events : [event.nativeEvent]) {
      const next = point(sample)
      if (gesture.kind === 'erase') eraseAt(gesture, next)
      else {
        const last = gesture.points[gesture.points.length - 1]
        if (Math.hypot(last.x - next.x, last.y - next.y) * scale >= 0.25) gesture.points.push(next)
      }
    }
  }
  const finish = (event: ReactPointerEvent, commit: boolean) => {
    const gesture = gestures.current.get(event.pointerId)
    if (!gesture) return
    if (commit) collect(event)
    gestures.current.delete(event.pointerId)
    if (surface.current?.hasPointerCapture(event.pointerId)) surface.current.releasePointerCapture(event.pointerId)
    if (commit) {
      if (gesture.kind === 'pen') annotation.addInk(createInk(gesture.points, gesture.brush))
      else annotation.replaceInk(gesture.replacements)
    }
    refresh()
  }
  return <div ref={surface} tabIndex={0} data-annotation-surface style={styles.surface}
    onPointerDown={handleStart} onPointerMove={event => {
      if (erasing) setCursor(point(event.nativeEvent))
      collect(event)
      schedule()
    }} onPointerUp={event => finish(event, true)} onPointerCancel={event => finish(event, false)}
    onLostPointerCapture={event => finish(event, false)} onPointerLeave={() => setCursor(null)}
    onBlur={cancelAll}
    onClick={event => { event.preventDefault(); event.stopPropagation() }}
    onDoubleClick={event => { event.preventDefault(); event.stopPropagation() }}
    onContextMenu={event => event.preventDefault()}>
    <div style={styles.preview}>{drafts.map(ink => <InkRenderer key={ink.id} element={ink} scale={scale} />)}</div>
    {erasing && cursor && <div data-eraser-cursor style={{ ...styles.eraser,
      left: cursor.x * scale, top: cursor.y * scale, width: state.eraser.width,
      height: state.eraser.width * (state.eraser.shape === 'circle' ? 1 : 56 / 38),
      borderRadius: state.eraser.shape === 'circle' ? '50%' : 3 }} />}
  </div>
}
