import { useLayoutEffect, useRef } from 'react'

interface Point { x: number; y: number }

/** 使用画布坐标播放位移动画；拖动、卸载时取消，动画不参与保存。 */
export function useMatchingMotion(points: Record<string, Point>, draggingId: string | null, checked: boolean,
  placedIds: string[]) {
  const nodes = useRef(new Map<string, HTMLDivElement>())
  const previous = useRef(points)
  const animations = useRef(new Map<string, Animation>())
  useLayoutEffect(() => {
    for (const [id, point] of Object.entries(points)) {
      const before = previous.current[id]
      const node = nodes.current.get(id)
      if (id === draggingId) { animations.current.get(id)?.cancel(); animations.current.delete(id); continue }
      if (!before || !node?.animate || (before.x === point.x && before.y === point.y)) continue
      animations.current.get(id)?.cancel()
      const animation = node.animate([
        { transform: `translate(${before.x - point.x}px, ${before.y - point.y}px)` },
        { transform: 'translate(0, 0)' }
      ], { duration: checked ? 300 : 200, easing: placedIds.includes(id)
        ? 'cubic-bezier(.3, .1, .8, .2)' : 'cubic-bezier(0, .7, .7, 1)' })
      void animation.finished?.catch(() => {})
      animations.current.set(id, animation)
      animation.onfinish = () => { if (animations.current.get(id) === animation) animations.current.delete(id) }
    }
    previous.current = points
  })
  useLayoutEffect(() => () => { animations.current.forEach(animation => animation.cancel()); animations.current.clear() }, [])
  return nodes
}
