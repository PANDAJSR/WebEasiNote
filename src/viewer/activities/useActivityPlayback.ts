import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import type { ActivityDefinition, ActivityElement, SlideData, SlideElement } from '../../types'
import { classificationDrop } from './classification'
import { pointerToSlide } from '../pointer-coordinates'

// 定义随文档解析创建，选择操作只复制页面；WeakMap 在文档释放后自动回收。
const sessions = new WeakMap<ActivityDefinition, Set<string>>()
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
  const gesture = useRef<Gesture | null>(null)
  const definitions = slide.activities || []
  const playable = definitions.filter(definition => definition.playable)
  const clear = () => {
    const current = gesture.current
    gesture.current = null
    if (current?.target.hasPointerCapture?.(current.pointerId)) current.target.releasePointerCapture(current.pointerId)
    setPreview(null)
  }
  useEffect(() => {
    clear()
    setFeedback('')
    const handleCancel = () => clear()
    const handleVisibility = () => { if (document.hidden) clear() }
    window.addEventListener('blur', handleCancel)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      clear()
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
      || gesture.current || event.button !== 0 || !(scale > 0)) return
    if (!definition.categories.some(category => category.items.some(item => item.id === element.id))) return
    // 动画中的坐标由播放器控制，等动画结束后才能抓取。
    if (event.currentTarget.getAnimations?.().some(animation => animation.playState === 'running')) return
    event.preventDefault()
    event.stopPropagation()
    gesture.current = { pointerId: event.pointerId, material: element, definition, target: event.currentTarget,
      clientX: event.clientX, clientY: event.clientY }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setFeedback('')
    setPreview({ id: element.id, x: element.x, y: element.y })
  }
  const handleMove = (event: ReactPointerEvent) => {
    const current = gesture.current
    if (!current || event.pointerId !== current.pointerId) return
    event.preventDefault()
    event.stopPropagation()
    setPreview({ id: current.material.id, ...position(event, current) })
  }
  const handleEnd = (event: ReactPointerEvent) => {
    const current = gesture.current
    if (!current || event.pointerId !== current.pointerId) return
    event.preventDefault()
    event.stopPropagation()
    if (active && available(current.material)) {
      const next = position(event, current)
      const result = classificationDrop(current.definition, slide.elements.filter(available), current.material, next.x, next.y)
      if (result === 'correct') {
        acceptedFor(current.definition).add(current.material.id)
        refresh(value => value + 1)
      }
      setFeedback(result === 'correct' ? '分类正确' : result === 'wrong' ? '分类不正确，请再试一次' : '')
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
    return { touchAction: 'none',
      ...(active && element.role === 'material' && definition ? { cursor: preview?.id === element.id ? 'grabbing' : 'grab' } : {}),
      ...(preview?.id === element.id ? { left: preview.x, top: preview.y, zIndex: 5 } : {}),
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
      acceptedFor(definition).clear()
      setFeedback('')
      refresh(value => value + 1)
    }
  }
}
