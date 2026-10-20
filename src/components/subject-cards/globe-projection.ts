export const normalizeVector = (v: number[]) => {
  const length = Math.hypot(...v) || 1
  return v.map(n => n / length)
}
const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const dot = (a: number[], b: number[]) => a.reduce((sum, n, i) => sum + n * b[i], 0)

/** 与官方透视相机一致使用水平 45° 视角；从屏幕射线求球面纹理坐标。 */
export function globeProjection(camera: number[], up: number[], look: number[]) {
  const forward = normalizeVector(look)
  const right = normalizeVector(cross(forward, up))
  const vertical = normalizeVector(cross(right, forward))
  const distanceSquared = dot(camera, camera)
  return (x: number, y: number): [number, number] | null => {
    const ray = normalizeVector(forward.map((n, i) => n + right[i] * x + vertical[i] * y))
    const b = dot(camera, ray)
    const delta = b * b - distanceSquared + 1
    if (delta < 0) return null
    const t = -b - Math.sqrt(delta)
    if (t <= 0) return null
    const normal = camera.map((n, i) => n + ray[i] * t)
    const u = (Math.atan2(normal[1], normal[0]) / (2 * Math.PI) + 1) % 1
    const v = Math.acos(Math.max(-1, Math.min(1, normal[2]))) / Math.PI
    return [u, v]
  }
}

export function paintGlobe(canvas: HTMLCanvasElement, texture: ImageData, camera: number[], up: number[], look: number[]) {
  const context = canvas.getContext('2d')
  if (!context) return
  const projection = globeProjection(camera, up, look)
  const image = context.createImageData(canvas.width, canvas.height)
  const distance = Math.max(1.01, Math.hypot(...camera))
  const extent = 1 / Math.sqrt(distance * distance - 1)
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    const uv = projection(((x + .5) / canvas.width * 2 - 1) * extent, (1 - (y + .5) / canvas.height * 2) * extent)
    if (!uv) continue
    const tx = Math.min(texture.width - 1, Math.floor(uv[0] * texture.width))
    const ty = Math.min(texture.height - 1, Math.floor(uv[1] * texture.height))
    const from = (ty * texture.width + tx) * 4
    const to = (y * canvas.width + x) * 4
    image.data[to] = texture.data[from]
    image.data[to + 1] = texture.data[from + 1]
    image.data[to + 2] = texture.data[from + 2]
    image.data[to + 3] = texture.data[from + 3]
  }
  context.putImageData(image, 0, 0)
}
