import { useId } from 'react'
import type { ReactNode } from 'react'
import type { PictureElement } from '../types'
import { perspectivePictureMatrix, pictureGeometry, rotatedPictureBounds } from '../rendering/picture-geometry'

/** 官方图片阴影来自几何轮廓，不是透明像素的 alpha 投影。 */
export function PictureEffects({ element, content }: { element: PictureElement; content: ReactNode }) {
  const id = `picture-effect-${useId().replace(/:/g, '')}`
  const { width, height, rotation = 0, alpha, shadow, perspectiveShadow, reflection } = element
  if (!shadow && !perspectiveShadow && !reflection) return null
  const { silhouette, outset } = pictureGeometry(element)
  const rotate = `rotate(${rotation} ${width / 2} ${height / 2})`
  const bounds = rotatedPictureBounds(element, outset)
  const matrix = perspectivePictureMatrix(element, outset)
  const shadowInfo = perspectiveShadow || shadow
  const angle = (shadow?.angle || 0) * Math.PI / 180
  const translate = shadow ? `translate(${Math.sin(angle) * shadow.offset} ${-Math.cos(angle) * shadow.offset})` : ''
  return <svg data-picture-effects='' width={width} height={height}
    style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }} aria-hidden='true'>
    <defs>
      {shadowInfo && <filter id={`${id}-blur`} x='-200%' y='-200%' width='500%' height='500%'
        colorInterpolationFilters='sRGB'><feGaussianBlur stdDeviation={shadowInfo.blurRadius / 2} /></filter>}
      {reflection && <>
        <linearGradient id={`${id}-gradient`} x1={reflection.startPoint[0]} y1={reflection.startPoint[1]}
          x2={reflection.endPoint[0]} y2={reflection.endPoint[1]}>
          {reflection.stops.map((stop, index) => <stop key={index} offset={stop.offset}
            stopColor='#ffffff' stopOpacity={stop.opacity * reflection.maskOpacity} />)}
        </linearGradient>
        <mask id={`${id}-mask`} maskUnits='userSpaceOnUse' x={bounds.x} y={bounds.y}
          width={bounds.width} height={bounds.height} style={{ maskType: 'alpha' }}>
          <rect {...bounds} fill={`url(#${id}-gradient)`} />
        </mask>
      </>}
    </defs>
    {shadowInfo && <g opacity={shadowInfo.opacity * alpha} filter={`url(#${id}-blur)`}>
      <g transform={matrix ? `matrix(${matrix.join(' ')})` : translate}>
        <path data-picture-shadow={matrix ? 'perspective' : 'drop'} d={silhouette}
          transform={rotate} fill={shadowInfo.color} />
      </g>
    </g>}
    {reflection && <g data-picture-reflection='' opacity={reflection.opacity * alpha}
      transform={`translate(0 ${2 * (bounds.y + bounds.height) + reflection.offsetY}) scale(1 -1)`}>
      <g mask={`url(#${id}-mask)`}>
        <g transform={rotate}>
          <foreignObject x={-outset - 4} y={-outset - 4} width={width + outset * 2 + 8} height={height + outset * 2 + 8}
            overflow='visible'>
            <div style={{ position: 'relative', width, height, left: outset + 4, top: outset + 4 }}>{content}</div>
          </foreignObject>
        </g>
      </g>
    </g>}
  </svg>
}
