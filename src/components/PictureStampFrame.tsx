import { useId } from 'react'
import { stampImages } from '../rendering/picture-art-frames'
import { pictureStampTiles } from '../rendering/picture-stamp'
import type { StampSide } from '../rendering/picture-stamp'
import { pointsBounds } from '../rendering/picture-bounds'

export function PictureStampFrame({ width, height, thickness }: { width: number; height: number; thickness: number }) {
  const id = `picture-stamp-${useId().replace(/:/g, '')}`
  const margin = 14 + thickness
  const w = width + margin * 2
  const h = height + margin * 2
  return <>
    <div style={{ position: 'absolute', inset: -thickness, border: `${thickness}px solid white` }} />
    {/* VisualBrush 默认将包含右/下越界一片的内容边界映射回目标矩形。 */}
    <svg data-picture-stamp='' width={w} height={h} viewBox={`0 0 ${w + 24} ${h + 24}`}
      preserveAspectRatio='none' style={{ position: 'absolute', left: -margin, top: -margin, overflow: 'visible' }}>
      {(Object.keys(stampImages) as StampSide[]).map(side => <g key={side}>
        <defs><pattern id={`${id}-${side}`} patternUnits='userSpaceOnUse' width='24' height='24'
          x={side === 'right' ? w : 0} y={side === 'bottom' ? h : 0}>
          <image href={stampImages[side]} width='24' height='24' />
        </pattern></defs>
        {pictureStampTiles(side, w, h).map((tile, index) => {
          // ImageBrush 的默认 Stretch.Fill 按裁切多边形边界映射整片资源，末段不延长齿孔周期。
          const brush = tile.points ? pointsBounds(tile.points) : { x: 0, y: 0, width: tile.width, height: tile.height }
          return <g key={index}>
            {tile.points && <defs><clipPath id={`${id}-${side}-${index}`}><polygon
              points={tile.points.map(([x, y]) => `${x + tile.x},${y + tile.y}`).join(' ')} /></clipPath></defs>}
            {tile.repeat ? <rect x={tile.x} y={tile.y} width={tile.width} height={tile.height} fill={`url(#${id}-${side})`} />
              : <image x={tile.x + brush.x} y={tile.y + brush.y} width={brush.width} height={brush.height}
                preserveAspectRatio='none' href={stampImages[side]} clipPath={`url(#${id}-${side}-${index})`} />}
          </g>
        })}
      </g>)}
    </svg>
  </>
}
