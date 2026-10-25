import type { ArtFrameSpec } from '../rendering/picture-art-frames'

/** 白边先画、PNG 后画；切片像素与显示边宽独立，保留官方不对称底影。 */
export function PictureNinePatch({ spec }: { spec: ArtFrameSpec }) {
  const slices = spec.slice.join(' ')
  return <>
    {spec.white > 0 && <div data-picture-white-border='' style={{ position: 'absolute', inset: -spec.white,
      border: `${spec.white}px solid white`, pointerEvents: 'none' }} />}
    <div data-picture-nine-patch='' style={{ position: 'absolute', inset: -spec.margin,
      borderStyle: 'solid', borderColor: 'transparent', borderWidth: spec.slice.map(n => `${n}px`).join(' '),
      borderImageSource: `url("${spec.url}")`, borderImageSlice: `${slices} fill`, borderImageWidth: 1,
      borderImageRepeat: 'stretch', pointerEvents: 'none' }} />
  </>
}
