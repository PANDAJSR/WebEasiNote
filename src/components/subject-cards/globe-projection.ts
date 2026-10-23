export const normalizeVector = (v: number[]) => {
  const length = Math.hypot(...v) || 1
  return v.map(n => n / length)
}
const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const dot = (a: number[], b: number[]) => a.reduce((sum, n, i) => sum + n * b[i], 0)

/** 与官方透视相机一致使用水平 45° 视角；从屏幕射线求球面纹理坐标。 */
export function globeProjection(camera: number[], up: number[], look: number[]) {
  const forward = normalizeVector(Math.hypot(...look) > 0 ? look : camera.map(n => -n))
  const side = cross(forward, up)
  const right = normalizeVector(Math.hypot(...side) > .00001 ? side : cross(forward, Math.abs(forward[2]) < .9 ? [0, 0, 1] : [0, 1, 0]))
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

/** 双线性采样跨越经度接缝，避免最近邻采样造成海岸线与文字锯齿。 */
export function sampleGlobeTexture(texture: ImageData, u: number, v: number) {
  const x = u * texture.width - .5
  const y = Math.max(0, Math.min(texture.height - 1, v * texture.height - .5))
  const left = Math.floor(x)
  const top = Math.floor(y)
  const fx = x - left
  const fy = y - top
  const pixel = (dx: number, dy: number, channel: number) => texture.data[(Math.min(texture.height - 1, top + dy) * texture.width + ((left + dx) % texture.width + texture.width) % texture.width) * 4 + channel]
  return [0, 1, 2, 3].map(channel => (pixel(0, 0, channel) * (1 - fx) + pixel(1, 0, channel) * fx) * (1 - fy)
    + (pixel(0, 1, channel) * (1 - fx) + pixel(1, 1, channel) * fx) * fy)
}

export function paintGlobe(canvas: HTMLCanvasElement, texture: ImageData, camera: number[], up: number[], look: number[], viewport = false) {
  const context = canvas.getContext('2d')
  if (!context) return
  const projection = globeProjection(camera, up, look)
  const image = context.createImageData(canvas.width, canvas.height)
  const distance = Math.max(1.01, Math.hypot(...camera))
  const extent = viewport ? Math.tan(Math.PI / 8) : 1 / Math.sqrt(distance * distance - 1)
  const aspect = viewport ? canvas.height / canvas.width : 1
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    const uv = projection(((x + .5) / canvas.width * 2 - 1) * extent, (1 - (y + .5) / canvas.height * 2) * extent * aspect)
    if (!uv) continue
    const to = (y * canvas.width + x) * 4
    const rgba = sampleGlobeTexture(texture, uv[0], uv[1])
    for (let channel = 0; channel < 4; channel++) image.data[to + channel] = rgba[channel]
  }
  context.putImageData(image, 0, 0)
}
