import type { PictureElement } from '../types'
import { pictureGeometry } from '../rendering/picture-geometry'

const rectFrameUrl = new URL('../rendering/assets/picture-frame.png', import.meta.url).href

/** 相框在原图之外绘制，不能用 border-box 挤压原图与裁剪区域。 */
export function PictureFrame({ element }: { element: PictureElement }) {
  const { frame, outline } = pictureGeometry(element)
  if (!frame.thickness) return null
  if (frame.type === 'rectframe') {
    const margin = 18 + frame.thickness
    return <div data-picture-frame={frame.type} style={{ position: 'absolute', inset: -margin,
      borderStyle: 'solid', borderColor: 'transparent', borderWidth: 29,
      borderImageSource: `url("${rectFrameUrl}")`, borderImageSlice: '29', borderImageWidth: 1,
      pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: margin - 29 - frame.thickness + 2,
        border: `${Math.max(0, frame.thickness - 2)}px solid white` }} />
    </div>
  }
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
