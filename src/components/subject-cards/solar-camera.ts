import { normalizeVector } from './globe-projection'

const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

/** 围绕保存相机的上方向及右方向旋转，保留课件视角的倾斜与观察目标。 */
function rotate(vector: number[], axis: number[], angle: number) {
  const unit = normalizeVector(axis)
  const perpendicular = cross(unit, vector)
  const dot = vector.reduce((sum, n, i) => sum + n * unit[i], 0)
  return vector.map((n, i) => n * Math.cos(angle) + perpendicular[i] * Math.sin(angle) + unit[i] * dot * (1 - Math.cos(angle)))
}

export function solarCamera(position: number[], look: number[], up: number[], rotation: number[], zoom: number) {
  const right = cross(look, up)
  const transform = (v: number[]) => rotate(rotate(v, right, rotation[1]), up, rotation[0])
  const distance = Math.hypot(...position)
  const ratio = Math.max(1.05, distance / zoom) / (distance || 1)
  return { camera: transform(position).map(n => n * ratio), look: transform(look), up: transform(up) }
}

/** WPF Matrix 与 CSS matrix 使用相同的六项顺序，偏移单位为课件像素。 */
export function solarMapMatrix(matrix: number[], zoom: number, pan: number[]) {
  return matrix.map((n, i) => n * zoom + (i >= 4 ? pan[i - 4] : 0))
}
