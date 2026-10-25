/** 官方 PictureStyleGenerator 的九宫格参数；切片顺序为上、右、下、左。 */
export interface ArtFrameSpec {
  url: string
  slice: [number, number, number, number]
  margin: number
  white: number
}

const images = {
  rect: new URL('./assets/picture-frame.png', import.meta.url).href,
  bottom1: new URL('./assets/picture-frames/pictureframe2_10.png', import.meta.url).href,
  bottom2: new URL('./assets/picture-frames/pictureframe2_20.png', import.meta.url).href,
  bottom3: new URL('./assets/picture-frames/pictureframe2_30.png', import.meta.url).href,
  inner1: new URL('./assets/picture-frames/pictureframe3_10.png', import.meta.url).href,
  inner2: new URL('./assets/picture-frames/pictureframe3_20.png', import.meta.url).href,
  inner3: new URL('./assets/picture-frames/pictureframe3_30.png', import.meta.url).href,
  flower1: new URL('./assets/picture-frames/pictureframe07_10.png', import.meta.url).href,
  flower2: new URL('./assets/picture-frames/pictureframe07_20.png', import.meta.url).href,
  flower3: new URL('./assets/picture-frames/pictureframe07_30.png', import.meta.url).href,
  arrow1: new URL('./assets/picture-frames/pictureframe08_10.png', import.meta.url).href,
  arrow2: new URL('./assets/picture-frames/pictureframe08_20.png', import.meta.url).href,
  arrow3: new URL('./assets/picture-frames/pictureframe08_30.png', import.meta.url).href,
  cross1: new URL('./assets/picture-frames/pictureframe09_10.png', import.meta.url).href,
  cross2: new URL('./assets/picture-frames/pictureframe09_20.png', import.meta.url).href,
  cross3: new URL('./assets/picture-frames/pictureframe09_30.png', import.meta.url).href
}

export const stampImages = {
  top: new URL('./assets/picture-frames/stampphotoframe0610top.png', import.meta.url).href,
  right: new URL('./assets/picture-frames/stampphotoframe0610right.png', import.meta.url).href,
  bottom: new URL('./assets/picture-frames/stampphotoframe0610bottom.png', import.meta.url).href,
  left: new URL('./assets/picture-frames/stampphotoframe0610left.png', import.meta.url).href
}

const uniform = (n: number): ArtFrameSpec['slice'] => [n, n, n, n]
const spec = (url: string, slice: number | ArtFrameSpec['slice'], margin: number, white = 8): ArtFrameSpec =>
  ({ url, slice: typeof slice === 'number' ? uniform(slice) : slice, margin, white })

/** 只有 2/3 档使用另一资源，其余非零档沿用官方的第一档分支。 */
export function pictureArtFrame(type: string, index: number): ArtFrameSpec | undefined {
  if (!index) return undefined
  const slot = index === 2 ? 1 : index === 3 ? 2 : 0
  switch (type) {
    case 'rectframe':
    case 'rectoverlapframe': return spec(images.rect, 29, 18 + index * 10, Math.max(0, index * 10 - 2))
    case 'frameshadowbottom': return [
      spec(images.bottom1, [30, 61, 58, 61], 22, 4),
      spec(images.bottom2, [36, 61, 58, 61], 32),
      spec(images.bottom3, [58, 80, 58, 80], 42)
    ][slot]
    case 'frameinnershadowaround': return [
      spec(images.inner1, 39, 27), spec(images.inner2, 49, 32), spec(images.inner3, 64, 47)
    ][slot]
    case 'flowerphotoframe': return [
      spec(images.flower1, 61, 26), spec(images.flower2, 61, 36), spec(images.flower3, 61, 40)
    ][slot]
    case 'arrowphotoframe': return [
      spec(images.arrow1, 89, 26), spec(images.arrow2, 89, 36), spec(images.arrow3, 89, 40)
    ][slot]
    case 'crossphotoframe': return [
      spec(images.cross1, 51, 42), spec(images.cross2, 61, 50), spec(images.cross3, 74, 65)
    ][slot]
  }
}

/** RigidBoundsOffset：倒影底边不包含 PNG 自带的柔和阴影。 */
export function pictureArtOutset(type: string, index: number) {
  if (!index) return 0
  const slot = index === 2 ? 1 : index === 3 ? 2 : 0
  switch (type) {
    case 'frameinnershadowaround': return [11, 21, 31][slot]
    case 'arrowphotoframe': return [15.6, 25.6, 30.6][slot]
    case 'flowerphotoframe': return [17, 27, 32][slot]
    case 'crossphotoframe': return [31, 37, 51][slot]
    default: return index * 10
  }
}
