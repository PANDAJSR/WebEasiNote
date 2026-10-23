import type { PictureElement } from '../types'
import { rotatePoint } from './selection-geometry'

export interface CropRange { left: number; top: number; right: number; bottom: number }

export function cropSelectionPicture(picture: PictureElement, range: CropRange,
  size: { width: number; height: number }): PictureElement {
  const region = picture.displayRegion || { x: 0, y: 0, ...size }
  const width = picture.width * (range.right - range.left) / 100
  const height = picture.height * (range.bottom - range.top) / 100
  const offset = rotatePoint({ x: picture.width * ((range.left + range.right) / 200 - 0.5),
    y: picture.height * ((range.top + range.bottom) / 200 - 0.5) }, picture.rotation || 0)
  return { ...picture, pictureSize: size, width, height,
    x: picture.x + picture.width / 2 + offset.x - width / 2,
    y: picture.y + picture.height / 2 + offset.y - height / 2,
    displayRegion: { x: region.x + region.width * range.left / 100,
      y: region.y + region.height * range.top / 100,
      width: region.width * (range.right - range.left) / 100,
      height: region.height * (range.bottom - range.top) / 100 } }
}
