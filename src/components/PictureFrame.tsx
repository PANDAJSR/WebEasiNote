import type { ReactNode } from 'react'
import type { PictureElement } from '../types'
import { pictureGeometry } from '../rendering/picture-geometry'
import { pictureArtFrame } from '../rendering/picture-art-frames'
import { PictureNinePatch } from './PictureNinePatch'
import { PictureStampFrame } from './PictureStampFrame'

/** 相框在原图之外绘制，不能用 border-box 挤压原图与裁剪区域。 */
export function PictureFrame({ element, image }: { element: PictureElement; image?: ReactNode }) {
  const { frame, outline } = pictureGeometry(element)
  if (!frame.thickness) return null
  const art = pictureArtFrame(frame.type, frame.index)
  if (art) {
    return <div data-picture-frame={frame.type} style={{ position: 'absolute', inset: 0 }}>
      <PictureNinePatch spec={art} />
      {frame.type === 'rectoverlapframe' && <div data-picture-overlap='' style={{ position: 'absolute', inset: 0,
        transform: 'rotate(-6deg)', transformOrigin: 'center center' }}>
        {image}<PictureNinePatch spec={art} />
      </div>}
    </div>
  }
  if (frame.type === 'stampphotoframe') return <div data-picture-frame={frame.type}>
    <PictureStampFrame width={element.width} height={element.height} thickness={frame.thickness} />
  </div>
  if (!frame.line && !['roundrectframe', 'ellipseframe', 'curverhombusframe'].includes(frame.type)) return null
  // OutlinePathPanel 使用保存的宽度 + 1，中心线在原图外侧半个线宽。
  const stroke = frame.thickness + 1
  return <svg data-picture-frame={frame.type} width={element.width} height={element.height}
    style={{ position: 'absolute', inset: 0, overflow: 'visible',
      filter: frame.line ? undefined : 'drop-shadow(0px 0px 2px rgba(0, 0, 0, 0.45))' }}>
    <path d={outline} fill='none' stroke={frame.color} strokeWidth={stroke}
      strokeDasharray={frame.dashes.length ? frame.dashes.map(value => value * stroke).join(' ') : undefined} />
  </svg>
}
