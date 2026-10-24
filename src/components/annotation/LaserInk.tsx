import { useEffect, useId, useState } from 'react'
import type { InkElement } from '../../types/annotation'
import { laserTiming } from '../../viewer/annotation/ce-brush'

function blend(color: string, amount: number) {
  return '#' + [1, 3, 5].map(i => Math.round(parseInt(color.slice(i, i + 2), 16)
    * (1 - amount) + 255 * amount).toString(16).padStart(2, '0')).join('')
}

/** CE InkFadeManager 的三层激光轮廓与 CubicEase / QuadraticEase 动画。 */
export function LaserInk({ element }: { element: InkElement }) {
  const id = useId().replace(/:/g, '')
  const [now, setNow] = useState(Date.now)
  const { points, brush } = element
  const timing = laserTiming(element.strokeDuration ?? points[points.length - 1].time - points[0].time, brush)
  const progress = element.laserStartedAt === undefined ? 0
    : Math.max(0, Math.min(1, (now - element.laserStartedAt - timing.delay) / timing.duration))
  useEffect(() => {
    if (element.laserStartedAt === undefined || brush.fadeEnabled === false) return
    let frame: number
    const tick = () => {
      const time = Date.now()
      setNow(time)
      if (time < element.laserStartedAt! + timing.delay + timing.duration) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [element.laserStartedAt, timing.delay, timing.duration, brush.fadeEnabled])
  const t = brush.fadeEnabled === false ? 0 : progress
  const eased = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2
  const width = Math.max(0.8 / (brush.inputScale ?? 1), brush.width)
  const glow = Math.max(width * 2.2, width + 4 / (brush.inputScale ?? 1))
  const body = Math.max(1 / (brush.inputScale ?? 1), width * 1.02)
  const core = Math.max(0.85 / (brush.inputScale ?? 1), width * 0.38)
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join('')
    + (points.length === 1 ? `l0.001,0` : '')
  const blur = Math.max(6 / (brush.inputScale ?? 1), glow * 0.55)
  return <g data-laser-ink opacity={1 - eased}
    transform={`translate(${element.sourceWidth / 2} ${element.sourceHeight / 2}) scale(${1 - 0.015 * t * t}) translate(${-element.sourceWidth / 2} ${-element.sourceHeight / 2})`}>
    <defs>
      <filter id={`${id}-glow`} x='-200%' y='-200%' width='500%' height='500%'><feGaussianBlur stdDeviation={blur / 3} /></filter>
      <filter id={`${id}-core`} x='-100%' y='-100%' width='300%' height='300%'><feGaussianBlur stdDeviation={Math.max(0.3 / (brush.inputScale ?? 1), core * 0.12) / 3} /></filter>
    </defs>
    <g fill='none' strokeLinecap='round' strokeLinejoin='round'>
      <path d={line} stroke={brush.color} strokeWidth={glow} opacity={0.22} filter={`url(#${id}-glow)`} />
      <path d={line} stroke={blend(brush.color, 0.08)} strokeWidth={body} opacity={0.92} />
      <path d={line} stroke={blend(brush.color, 0.94)} strokeWidth={core} opacity={0.98} filter={`url(#${id}-core)`} />
    </g>
  </g>
}
