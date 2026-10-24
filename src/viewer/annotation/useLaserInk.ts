import { useEffect, useRef, useState } from 'react'
import type { InkElement } from '../../types/annotation'
import { laserTiming } from './ce-brush'

/** 激光为会话瞬态视觉，消退不写入撤销栈，也不会被重做复活。 */
export function useLaserInk(resetKey: unknown) {
  const [pages, setPages] = useState<Record<string, InkElement[]>>({})
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())
  useEffect(() => {
    setPages({})
    return () => {
      timers.current.forEach(clearTimeout)
      timers.current.clear()
    }
  }, [resetKey])
  const add = (pageId: string, ink: InkElement) => {
    const visual = { ...ink, laserStartedAt: Date.now() }
    setPages(value => ({ ...value, [pageId]: [...value[pageId] ?? [], visual] }))
    if (ink.brush.fadeEnabled === false) return
    const timing = laserTiming(ink.strokeDuration ?? ink.points[ink.points.length - 1].time - ink.points[0].time, ink.brush)
    const timer = setTimeout(() => {
      timers.current.delete(timer)
      setPages(value => ({ ...value, [pageId]: value[pageId]?.filter(item => item.id !== ink.id) ?? [] }))
    }, timing.delay + timing.duration)
    timers.current.add(timer)
  }
  return { pages, add, clear: (pageId: string) => setPages(value => ({ ...value, [pageId]: [] })) }
}
