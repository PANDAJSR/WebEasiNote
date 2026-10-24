import { useMemo } from 'react'
import type { InkElement } from '../../types/annotation'
import { inkPath } from '../../viewer/annotation/ink-geometry'
import { LaserInk } from './LaserInk'

export function InkRenderer({ element, scale = 1 }: { element: InkElement; scale?: number }) {
  const path = useMemo(() => inkPath(element), [element.points, element.brush])
  return <svg data-ink-id={element.id} width={element.width * scale} height={element.height * scale}
    viewBox={`0 0 ${element.sourceWidth} ${element.sourceHeight}`} preserveAspectRatio='none'
    style={{ position: 'absolute', left: element.x * scale, top: element.y * scale,
      transform: `rotate(${element.rotation}deg)`, overflow: 'visible', pointerEvents: 'none' }}>
    {element.brush.kind === 'laser' ? <LaserInk element={element} />
      : <path d={path} fill={element.brush.color} opacity={element.brush.opacity} fillRule='nonzero' />}
  </svg>
}
