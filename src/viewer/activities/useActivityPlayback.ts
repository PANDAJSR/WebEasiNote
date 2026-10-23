import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import type { ActivityDefinition, ActivityElement, SlideData, SlideElement } from '../../types'
import { classificationContainer, classificationDrop } from './classification'
import { playClassificationFeedback } from './classification-feedback'
import { pointerToSlide } from '../pointer-coordinates'

// 定义随文档解析创建，选择操作只复制页面；WeakMap 在文档释放后自动回收。
const sessions = new WeakMap<ActivityDefinition, Set<string>>()
const positions = new WeakMap<ActivityDefinition, Map<string, { x: number; y: number }>>()
function positionsFor(definition: ActivityDefinition) {
  let saved = positions.get(definition)
  if (!saved) { saved = new Map(); positions.set(definition, saved) }
  return saved
}
function acceptedFor(definition: ActivityDefinition) {
  let accepted = sessions.get(definition)
  if (!accepted) { accepted = new Set(); sessions.set(definition, accepted) }
  return accepted
}
interface Gesture {
  pointerId: number
  target: HTMLDivElement
  material: ActivityElement
  definition: ActivityDefinition
  clientX: number
  clientY: number
}

export function useActivityPlayback(slide: SlideData, scale: number, active: boolean,
  displayStyles: Record<string, CSSProperties>, renderStates: Record<string, boolean>) {
  const [, refresh] = useState(0)
  const [preview, setPreview] = useState<{ id: string; x: number; y: number } | null>(null)
  const [feedback, setFeedback] = useState('')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [settlingId, setSettlingId] = useState<string | null>(null)
  const finishFeedback = useRef<(() => void) | null>(null)
  const gesture = useRef<Gesture | null>(null)
  const definitions = slide.activities || []
  const playable = definitions.filter(definition => definition.playable)
  const clear = () => {
    const current = gesture.current
    gesture.current = null
    if (current?.target.hasPointerCapture?.(current.pointerId)) current.target.releasePointerCapture(current.pointerId)
    setPreview(null)
    setHoveredId(null)
  }
  useEffect(() => {
    clear()
    finishFeedback.current?.()
    setFeedback('')
    const handleCancel = () => { clear(); finishFeedback.current?.() }
    const handleVisibility = () => { if (document.hidden) handleCancel() }
    window.addEventListener('blur', handleCancel)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      clear()
      finishFeedback.current?.()
      window.removeEventListener('blur', handleCancel)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [active, slide.id, slide.activities, scale])
  const available = (element: SlideElement) => renderStates[element.id] !== false
    && displayStyles[element.id]?.display !== 'none' && displayStyles[element.id]?.visibility !== 'hidden'
    && Number(displayStyles[element.id]?.opacity ?? 1) > 0
  const definitionFor = (element: SlideElement) => element.type === 'activity'
    ? playable.find(definition => definition.id === element.activityId) : undefined
  const position = (event: ReactPointerEvent, current: Gesture) => {
    const delta = pointerToSlide(event, { left: current.clientX, top: current.clientY }, scale)
    return { x: current.material.x + delta.x, y: current.material.y + delta.y }
  }
  const handleStart = (event: ReactPointerEvent<HTMLDivElement>, element: SlideElement) => {
    const definition = definitionFor(element)
    if (!active || !definition || element.type !== 'activity' || element.role !== 'material'
      || acceptedFor(definition).has(element.id) || !available(element)
      || gesture.current || finishFeedback.current || event.button !== 0 || !(scale > 0)) return
    if (!definition.categories.some(category => category.items.some(item => item.id === element.id))) return
    // 动画中的坐标由播放器控制，等动画结束后才能抓取。
    if (event.currentTarget.getAnimations?.().some(animation => animation.playState === 'running')) return
    event.preventDefault()
    event.stopPropagation()
    const material = { ...element, ...positionsFor(definition).get(element.id) }
    gesture.current = { pointerId: event.pointerId, material, definition, target: event.currentTarget,
      clientX: event.clientX, clientY: event.clientY }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setFeedback('')
    setPreview({ id: element.id, x: material.x, y: material.y })
  }
  const handleMove = (event: ReactPointerEvent) => {
    const current = gesture.current
    if (!current || event.pointerId !== current.pointerId) return
    event.preventDefault()
    event.stopPropagation()
    const next = position(event, current)
    setPreview({ id: current.material.id, ...next })
    setHoveredId(classificationContainer(current.definition, slide.elements.filter(available), current.material, next.x, next.y)?.id || null)
  }
  const handleEnd = (event: ReactPointerEvent) => {
    const current = gesture.current
    if (!current || event.pointerId !== current.pointerId) return
    event.preventDefault()
    event.stopPropagation()
    if (active && available(current.material)) {
      const next = position(event, current)
      const result = classificationDrop(current.definition, slide.elements.filter(available), current.material, next.x, next.y)
      const container = classificationContainer(current.definition, slide.elements.filter(available), current.material, next.x, next.y)
      if (result === 'outside') {
        positionsFor(current.definition).set(current.material.id, next)
      } else {
        clear()
        setPreview({ id: current.material.id, ...next })
        setSettlingId(current.material.id)
        const containerNode = container && Array.from(current.target.parentElement?.children || [])
          .find(node => (node as HTMLElement).dataset.elementId === container.id) as HTMLElement | undefined
        finishFeedback.current = playClassificationFeedback(current.target, containerNode || null, result === 'correct',
          { x: current.material.x - next.x, y: current.material.y - next.y }, () => {
            finishFeedback.current = null
            if (result === 'correct') acceptedFor(current.definition).add(current.material.id)
            setPreview(null)
            setSettlingId(null)
            refresh(value => value + 1)
          })
      }
      setFeedback(result === 'correct' ? '分类正确' : result === 'wrong' ? '分类不正确，请再试一次' : '')
      if (result !== 'outside') return
    }
    clear()
  }
  const handleCancel = (event: ReactPointerEvent) => {
    if (gesture.current?.pointerId === event.pointerId) clear()
  }
  const style = (element: SlideElement): CSSProperties => {
    if (element.type !== 'activity') return {}
    const definition = definitionFor(element)
    const accepted = !!definition && acceptedFor(definition).has(element.id)
    const saved = definition && positionsFor(definition).get(element.id)
    return { touchAction: 'none',
      transformOrigin: 'center',
      ...(element.role === 'container' ? { scale: hoveredId === element.id ? '1.2' : '1', transition: 'scale 150ms linear' } : {}),
      ...(saved ? { left: saved.x, top: saved.y } : {}),
      ...(active && element.role === 'material' && definition ? { cursor: preview?.id === element.id ? 'grabbing' : 'grab' } : {}),
      ...(preview?.id === element.id ? { left: preview.x, top: preview.y, zIndex: 5 } : {}),
      ...(settlingId === element.id ? { pointerEvents: 'none' } : {}),
      ...(accepted ? { visibility: 'hidden', pointerEvents: 'none' } : {}) }
  }
  return {
    feedback, playable, style,
    handlers: (element: SlideElement) => element.type === 'activity' ? {
      'data-activity-control': 'true', 'data-prevent-swipe': 'true',
      onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => handleStart(event, element),
      onPointerMove: handleMove, onPointerUp: handleEnd, onPointerCancel: handleCancel, onLostPointerCapture: handleCancel
    } : {},
    progress: (definition: ActivityDefinition) => ({ accepted: acceptedFor(definition).size,
      total: definition.categories.reduce((sum, category) => sum + category.items.length, 0) }),
    reset: (definition: ActivityDefinition) => {
      clear()
      finishFeedback.current?.()
      acceptedFor(definition).clear()
      positionsFor(definition).clear()
      setFeedback('')
      refresh(value => value + 1)
    }
  }
}
