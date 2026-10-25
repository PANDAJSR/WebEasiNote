import { useId } from 'react'
import type { ReactNode } from 'react'
import type { PictureElement } from '../types'
import { pictureGeometry } from '../rendering/picture-geometry'

/** Glow 使用真实像素 alpha，而非普通阴影的矩形/椭圆几何。 */
export function PictureGlow({ element, children }: { element: PictureElement; children: ReactNode }) {
  const id = `picture-glow-${useId().replace(/:/g, '')}`
  const glow = element.glow
  if (!glow || !glow.opacity) return <>{children}</>
  // 官方 TrySetGlow：DropShadowEffect 半径为保存值 × 2，上限 255，深度 0。
  const sigma = Math.min(glow.blurRadius, 127.5)
  const bounds = pictureGeometry(element).visualBounds
  const padding = Math.max(1, sigma * 3)
  return <>
    <svg width='0' height='0' style={{ position: 'absolute' }} aria-hidden='true'><defs>
      <filter id={id} filterUnits='userSpaceOnUse' x={bounds.x - padding} y={bounds.y - padding}
        width={bounds.width + padding * 2} height={bounds.height + padding * 2} colorInterpolationFilters='sRGB'>
        <feGaussianBlur in='SourceAlpha' stdDeviation={sigma} result='blur' />
        <feFlood floodColor={glow.color} floodOpacity={glow.opacity} result='color' />
        <feComposite in='color' in2='blur' operator='in' result='glow' />
        <feMerge><feMergeNode in='glow' /><feMergeNode in='SourceGraphic' /></feMerge>
      </filter>
    </defs></svg>
    <div data-picture-glow='' style={{ position: 'absolute', inset: 0, filter: `url(#${id})` }}>{children}</div>
  </>
}
