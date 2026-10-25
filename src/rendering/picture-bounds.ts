export interface PictureBounds { x: number; y: number; width: number; height: number }

export function rectanglePoints(bounds: PictureBounds) {
  const { x, y, width, height } = bounds
  return [[x, y], [x + width, y], [x + width, y + height], [x, y + height]]
}

export function rotatePoints(points: number[][], angle: number, cx: number, cy: number) {
  const c = Math.cos(angle * Math.PI / 180)
  const s = Math.sin(angle * Math.PI / 180)
  return points.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c])
}

export function pointsBounds(points: number[][]): PictureBounds {
  const xs = points.map(p => p[0])
  const ys = points.map(p => p[1])
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
}

export function expandPictureBounds(width: number, height: number, outset: number): PictureBounds {
  return { x: -outset, y: -outset, width: width + outset * 2, height: height + outset * 2 }
}

export function rotatePictureBounds(bounds: PictureBounds, angle: number, width: number, height: number) {
  return pointsBounds(rotatePoints(rectanglePoints(bounds), angle, width / 2, height / 2))
}

export function polygonPath(points: number[][]) {
  return `M${points.map(p => p.join(',')).join('L')}Z`
}
