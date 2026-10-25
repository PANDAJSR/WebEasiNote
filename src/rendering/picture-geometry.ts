import type { PictureElement } from '../types'

const FRAME_NAMES: Record<string, string> = { '1': 'rectframe', '2': 'roundrectframe', '3': 'ellipseframe',
  '4': 'curverhombusframe', '100': 'normalframe', '101': 'dotdashframe', '102': 'longdashframe',
  ellipse: 'ellipseframe', roundrect: 'roundrectframe' }

export function pictureFrame(element: PictureElement) {
  const value = String(element.pictureRahmenType || '').trim().toLowerCase()
  const type = FRAME_NAMES[value] || value
  const line = ['normalframe', 'dotdashframe', 'longdashframe'].includes(type)
  const index = element.imageRahmenWidthIndex ?? 1
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
  const outset = frame.thickness && (frame.line || shaped || frame.type === 'rectframe') ? frame.thickness : 0
  const { width, height } = element
  return { frame, shape, outset, clip: picturePath(shape, width, height),
    silhouette: picturePath(shape, width + outset * 2, height + outset * 2, -outset, -outset),
    outline: picturePath(shape, width + outset, height + outset, -outset / 2, -outset / 2) }
}

export interface PictureBounds { x: number; y: number; width: number; height: number }

/** 特效在旋转后的页面坐标中构造；不能随主图再旋转一次。 */
export function rotatedPictureBounds(element: PictureElement, outset = 0): PictureBounds {
  const radians = element.rotation * Math.PI / 180
  const c = Math.cos(radians)
  const s = Math.sin(radians)
  const width = (element.width + outset * 2) * Math.abs(c) + (element.height + outset * 2) * Math.abs(s)
  const height = (element.width + outset * 2) * Math.abs(s) + (element.height + outset * 2) * Math.abs(c)
  return { x: (element.width - width) / 2, y: (element.height - height) / 2, width, height }
}

/** 对齐透视阴影的近端到旋转后图片底边，复刻 GetShadowGeometry。 */
export function perspectivePictureMatrix(element: PictureElement, outset = 0) {
  const shadow = element.perspectiveShadow
  if (!shadow) return undefined
  const [a, b, c, d, e, f] = shadow.matrix
  const bounds = rotatedPictureBounds(element, outset)
  const bottom = bounds.y + bounds.height
  const xs = [bounds.x, bounds.x + bounds.width]
  const ys = [bounds.y, bottom]
  const transformedY = xs.flatMap(x => ys.map(y => b * x + d * y + f))
  const edge = d > 0 ? Math.max(...transformedY) : Math.min(...transformedY)
  return [a, b, c, d, e - c * bottom, f + bottom - edge + shadow.offsetY]
}
