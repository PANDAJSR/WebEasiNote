import type { PictureElement } from '../types'
import { pictureArtFrame, pictureArtOutset } from './picture-art-frames'
import { expandPictureBounds, pointsBounds, polygonPath, rectanglePoints, rotatePictureBounds, rotatePoints } from './picture-bounds'
import type { PictureBounds } from './picture-bounds'
import { normalizePictureFrameType } from '../enbx/picture-frame-types'

export function pictureFrame(element: PictureElement) {
  const type = normalizePictureFrameType(element.pictureRahmenType)
  const line = ['normalframe', 'dotdashframe', 'longdashframe'].includes(type)
  const index = Math.max(0, element.imageRahmenWidthIndex ?? 1)
  const thickness = line ? element.rahmenThickness || 0 : index * 10
  return { type, line, index, thickness, color: line ? element.rahmenColor || '#000000' : '#ffffff',
    dashes: type === 'dotdashframe' ? [5, 3] : type === 'longdashframe' ? [10, 2, 2, 2] : [] }
}

/** 官方 CurveRhombus 实为左上/右下圆角矩形，不是菱形。 */
export function picturePath(shape: string, width: number, height: number, x = 0, y = 0) {
  const w = Math.max(0, width)
  const h = Math.max(0, height)
  if (shape === 'ellipseframe' || shape === 'ellipse') return `M${x},${y + h / 2}a${w / 2},${h / 2} 0 1 0 ${w},0a${w / 2},${h / 2} 0 1 0 ${-w},0Z`
  const rx = shape === 'curverhombusframe' ? w * 72 / 405
    : shape === 'roundrectframe' ? Math.min(w, h) * 0.14286 : 0
  const ry = shape === 'curverhombusframe' ? h * 72 / 264 : rx
  if (!rx) return `M${x},${y}h${w}v${h}h${-w}Z`
  if (shape === 'curverhombusframe') return `M${x + rx},${y}H${x + w}V${y + h - ry}A${rx},${ry} 0 0 1 ${x + w - rx},${y + h}H${x}V${y + ry}A${rx},${ry} 0 0 1 ${x + rx},${y}Z`
  return `M${x + rx},${y}H${x + w - rx}A${rx},${ry} 0 0 1 ${x + w},${y + ry}V${y + h - ry}A${rx},${ry} 0 0 1 ${x + w - rx},${y + h}H${x + rx}A${rx},${ry} 0 0 1 ${x},${y + h - ry}V${y + ry}A${rx},${ry} 0 0 1 ${x + rx},${y}Z`
}

export function pictureGeometry(element: PictureElement) {
  const frame = pictureFrame(element)
  const shaped = ['ellipseframe', 'roundrectframe', 'curverhombusframe'].includes(frame.type)
  const shape = shaped ? frame.type : (element.clippingShape || '').toLowerCase()
  const art = pictureArtFrame(frame.type, frame.index)
  const hasArt = Boolean(art) || (frame.type === 'stampphotoframe' && frame.thickness > 0)
  const outset = frame.line || shaped ? frame.thickness : hasArt ? pictureArtOutset(frame.type, frame.index) : 0
  const { width, height } = element
  const rigid = rectanglePoints(expandPictureBounds(width, height, outset))
  const overlap = frame.type === 'rectoverlapframe' && frame.thickness > 0
  const rigidPoints = overlap ? [...rigid, ...rotatePoints(rigid, -6, width / 2, height / 2)] : rigid
  const visualOutset = art?.margin ?? (frame.type === 'stampphotoframe' && frame.thickness ? 14 + frame.thickness : outset)
  const visual = rectanglePoints(expandPictureBounds(width, height, visualOutset))
  const visualBounds = pointsBounds(overlap ? [...visual, ...rotatePoints(visual, -6, width / 2, height / 2)] : visual)
  const shadowBounds = hasArt ? artShadowBounds(frame.type, frame.index, visualBounds)
    : expandPictureBounds(width, height, outset)
  const silhouette = overlap ? polygonPath(rigid) + polygonPath(rotatePoints(rigid, -6, width / 2, height / 2))
    : picturePath(shape, width + outset * 2, height + outset * 2, -outset, -outset)
  return { frame, shape, outset, visualBounds, rigidPoints, shadowBounds,
    clip: picturePath(shape, width, height), silhouette,
    shadowPath: hasArt ? picturePath('', shadowBounds.width, shadowBounds.height, shadowBounds.x, shadowBounds.y) : silhouette,
    outline: picturePath(shape, width + outset, height + outset, -outset / 2, -outset / 2) }
}

/** RahmanShadowOffset 从包含 PNG 柔影的视觉边界收回到实框，不重复投影 PNG 阴影。 */
function artShadowBounds(type: string, index: number, bounds: PictureBounds): PictureBounds {
  const slot = index === 2 ? 1 : index === 3 ? 2 : 0
  const offsets: Record<string, number[]> = { rectframe: [19.5], rectoverlapframe: [19.5],
    frameshadowbottom: [11.5, 11.5, 11.5, 14.5], stampphotoframe: [7.5], arrowphotoframe: [15.6],
    frameinnershadowaround: [[17, 12, 17][slot]], flowerphotoframe: [[15.6, 15.6, 10.6][slot]],
    crossphotoframe: slot === 1 ? [32, 30, 32, 32] : [[32, 32, 35][slot]] }
  const values = offsets[type] || [0]
  const [left, top = left, right = left, bottom = top] = values
  if (bounds.width <= left + right || bounds.height <= top + bottom) return bounds
  return { x: bounds.x + left, y: bounds.y + top, width: bounds.width - left - right, height: bounds.height - top - bottom }
}

/** 特效在旋转后的页面坐标中构造；不能随主图再旋转一次。 */
export function rotatedPictureBounds(element: PictureElement, outset = 0): PictureBounds {
  if (pictureFrame(element).type === 'rectoverlapframe' && pictureFrame(element).thickness) {
    const points = rectanglePoints(expandPictureBounds(element.width, element.height, outset))
    return pointsBounds(rotatePoints([...points, ...rotatePoints(points, -6, element.width / 2, element.height / 2)],
      element.rotation, element.width / 2, element.height / 2))
  }
  const radians = element.rotation * Math.PI / 180
  const c = Math.cos(radians)
  const s = Math.sin(radians)
  const width = (element.width + outset * 2) * Math.abs(c) + (element.height + outset * 2) * Math.abs(s)
  const height = (element.width + outset * 2) * Math.abs(s) + (element.height + outset * 2) * Math.abs(c)
  return { x: (element.width - width) / 2, y: (element.height - height) / 2, width, height }
}

/** 对齐透视阴影的近端到旋转后图片底边，复刻 GetShadowGeometry。 */
export function perspectivePictureMatrix(element: PictureElement, outset = 0, localBounds?: PictureBounds) {
  const shadow = element.perspectiveShadow
  if (!shadow) return undefined
  const [a, b, c, d, e, f] = shadow.matrix
  const bounds = localBounds ? rotatePictureBounds(localBounds, element.rotation, element.width, element.height)
    : rotatedPictureBounds(element, outset)
  const bottom = bounds.y + bounds.height
  const xs = [bounds.x, bounds.x + bounds.width]
  const ys = [bounds.y, bottom]
  const transformedY = xs.flatMap(x => ys.map(y => b * x + d * y + f))
  const edge = d > 0 ? Math.max(...transformedY) : Math.min(...transformedY)
  return [a, b, c, d, e - c * bottom, f + bottom - edge + shadow.offsetY]
}
